interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Paleobiology Database (PBDB) MCP — the global fossil record. Keyless.
 *
 * Find fossil occurrences of a taxon (with locations + geologic ages), look up a
 * taxon's first/last appearance and attribution, and list child taxa. Ages are in
 * millions of years (Ma).
 */


const BASE = 'https://paleobiodb.org/data1.2';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

interface PbdbResponse {
  records?: Record<string, unknown>[];
  warnings?: unknown;
}

const tools: McpToolExport['tools'] = [
  {
    name: 'find_fossils',
    description:
      'Find fossil occurrences for a taxon from the Paleobiology Database (the global fossil record). Returns occurrences with collection locations (lat/lng, country) and geologic ages. base_name matching includes the taxon and all of its subtaxa. Ages are in millions of years (Ma). Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        taxon: { type: 'string', description: 'Taxon name, e.g. "Tyrannosaurus" or "Mammalia". Matches the taxon and all subtaxa.' },
        interval: { type: 'string', description: 'Geologic time interval (period/epoch) to filter by, e.g. "Cretaceous".' },
        country: { type: 'string', description: 'Two-letter country code to filter by, e.g. "US".' },
        limit: { type: 'number', description: 'Max occurrences to return (default 20, max 100).' },
      },
      required: ['taxon'],
    },
  },
  {
    name: 'get_taxon',
    description:
      "Look up a single taxon in the Paleobiology Database: its taxonomic rank, attribution (author + year), first/last appearance intervals and ages (in millions of years, Ma), and number of subtaxa. Keyless.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Taxon name to look up, e.g. "Tyrannosaurus rex".' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_subtaxa',
    description:
      'List the direct child taxa (subtaxa) of a taxon from the Paleobiology Database, with each child\'s rank and number of its own subtaxa. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        taxon: { type: 'string', description: 'Parent taxon name, e.g. "Tyrannosauridae".' },
        limit: { type: 'number', description: 'Max subtaxa to return (default 30).' },
      },
      required: ['taxon'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'find_fossils':
        return await findFossils(args);
      case 'get_taxon':
        return await getTaxon(args);
      case 'list_subtaxa':
        return await listSubtaxa(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function findFossils(args: Record<string, unknown>): Promise<unknown> {
  const taxon = reqStr(args, 'taxon');
  if (!taxon) return { error: 'Required argument "taxon" is missing. Pass a taxon name like "Tyrannosaurus".' };

  let limit = typeof args.limit === 'number' ? Math.floor(args.limit) : 20;
  if (!Number.isFinite(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;

  const params = new URLSearchParams();
  params.set('base_name', taxon);
  params.set('limit', String(limit));
  params.set('show', 'coords,loc,time');
  if (typeof args.interval === 'string' && args.interval.trim()) params.set('interval', args.interval.trim());
  if (typeof args.country === 'string' && args.country.trim()) params.set('cc', args.country.trim());

  const data = await pbdbGet(`/occs/list.json?${params.toString()}`);
  const records = data.records ?? [];
  const occurrences = records.map((r) => ({
    occurrence_id: r.oid,
    taxon: r.tna,
    early_interval: r.oei,
    late_interval: r.oli,
    early_age_ma: r.eag,
    late_age_ma: r.lag,
    lat: r.lat,
    lng: r.lng,
    country: r.cc2,
  }));
  return { count: occurrences.length, occurrences };
}

async function getTaxon(args: Record<string, unknown>): Promise<unknown> {
  const name = reqStr(args, 'name');
  if (!name) return { error: 'Required argument "name" is missing. Pass a taxon name like "Tyrannosaurus rex".' };

  const params = new URLSearchParams();
  params.set('name', name);
  params.set('show', 'attr,app,size');

  const data = await pbdbGet(`/taxa/single.json?${params.toString()}`);
  const rec = (data.records ?? [])[0];
  if (!rec) return { error: 'taxon not found', name };
  return {
    taxon_id: rec.oid,
    name: rec.nam,
    rank: rec.rnk,
    attribution: rec.att,
    first_appearance: rec.tei,
    last_appearance: rec.tli,
    first_age_ma: rec.fea,
    last_age_ma: rec.lla,
    n_subtaxa: rec.siz,
  };
}

async function listSubtaxa(args: Record<string, unknown>): Promise<unknown> {
  const taxon = reqStr(args, 'taxon');
  if (!taxon) return { error: 'Required argument "taxon" is missing. Pass a taxon name like "Tyrannosauridae".' };

  let limit = typeof args.limit === 'number' ? Math.floor(args.limit) : 30;
  if (!Number.isFinite(limit) || limit < 1) limit = 30;

  const params = new URLSearchParams();
  params.set('base_name', taxon);
  params.set('rel', 'children');
  params.set('show', 'size');

  const data = await pbdbGet(`/taxa/list.json?${params.toString()}`);
  const records = (data.records ?? []).slice(0, limit);
  const subtaxa = records.map((r) => ({
    taxon_id: r.oid,
    name: r.nam,
    rank: r.rnk,
    n_subtaxa: r.siz,
  }));
  return { count: subtaxa.length, subtaxa };
}

async function pbdbGet(path: string): Promise<PbdbResponse> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    throw new Error(`PBDB: ${res.status} ${body}`);
  }
  const json = (await res.json()) as PbdbResponse;
  return json;
}

function reqStr(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  return typeof v === 'string' ? v.trim() : '';
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;

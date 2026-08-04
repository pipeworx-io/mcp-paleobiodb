# mcp-paleobiodb

Paleobiology Database (PBDB) MCP — the global fossil record. Keyless.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `find_fossils` | Find fossil occurrences for a taxon from the Paleobiology Database (the global fossil record). Returns occurrences with collection locations (lat/lng, country) and geologic ages. base_name matching includes the taxon and all of its subtaxa. Ages are in millions of years (Ma). Keyless. |
| `get_taxon` | Look up a single taxon in the Paleobiology Database: its taxonomic rank, attribution (author + year), first/last appearance intervals and ages (in millions of years, Ma), and number of subtaxa. Keyless. |
| `list_subtaxa` | List the direct child taxa (subtaxa) of a taxon from the Paleobiology Database, with each child's rank and number of its own subtaxa. Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "paleobiodb": {
      "url": "https://gateway.pipeworx.io/paleobiodb/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Paleobiodb data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT

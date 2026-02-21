# Taiwanese Law MCP

Taiwanese law database for cybersecurity compliance via Model Context Protocol (MCP).

## Features

- **Full-text search** across legislation provisions (FTS5 with BM25 ranking)
- **Article-level retrieval** for specific legal provisions
- **Citation validation** to prevent hallucinated references
- **Currency checks** to verify if laws are still in force

## Quick Start

### Claude Code (Remote)
```bash
claude mcp add taiwanese-law --transport http https://taiwanese-law-mcp.vercel.app/mcp
```

### Local (npm)
```bash
npx @ansvar/taiwanese-law-mcp
```

## Data Sources

Official Taiwan Laws & Regulations Database OpenAPI (`https://law.moj.gov.tw/api/ch/law/json`), ingested into 10 real statute seed files.

## License

Apache-2.0

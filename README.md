# Taiwanese Law MCP Server

**The Laws & Regulations Database alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Ftaiwanese-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/taiwanese-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Taiwanese-law-mcp?style=social)](https://github.com/Ansvar-Systems/Taiwanese-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Taiwanese-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Taiwanese-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/Taiwanese-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/Taiwanese-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](docs/INTERNATIONAL_INTEGRATION_GUIDE.md)
[![Provisions](https://img.shields.io/badge/provisions-221%2C082-blue)](docs/INTERNATIONAL_INTEGRATION_GUIDE.md)

Query **11,747 Taiwanese laws** -- from 個人資料保護法 (Personal Data Protection Act) and 刑法 (Criminal Code) to 民法 (Civil Code), 公司法 (Company Act), and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Taiwanese legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Taiwanese legal research means navigating the Laws & Regulations Database (law.moj.gov.tw), the Judicial Yuan database, and scattered ministry publications. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking obligations under the Personal Data Protection Act or cybersecurity regulations
- A **legal tech developer** building tools on Taiwanese or Asia-Pacific law
- A **researcher** tracing legislative provisions across 11,747 Taiwanese laws

...you shouldn't need dozens of browser tabs and manual cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Taiwanese law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://mcp.ansvar.eu/law-tw/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add taiwanese-law --transport http https://mcp.ansvar.eu/law-tw/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "taiwanese-law": {
      "type": "url",
      "url": "https://mcp.ansvar.eu/law-tw/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "taiwanese-law": {
      "type": "http",
      "url": "https://mcp.ansvar.eu/law-tw/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/taiwanese-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "taiwanese-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/taiwanese-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "taiwanese-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/taiwanese-law-mcp"]
    }
  }
}
```

## Example Queries

Once connected, just ask naturally (in Traditional Chinese or English):

- *"個人資料保護法第十五條關於個人資料蒐集的規定是什麼？"*
- *"刑法目前是否有效？"*
- *"搜尋台灣法律中關於個人資料保護的規定"*
- *"民法關於契約成立的要件為何？"*
- *"資通安全管理法對於政府機關的資安義務有哪些規定？"*
- *"公司法關於董事責任的規定是什麼？"*
- *"驗證引用「個人資料保護法第二十二條」是否正確"*
- *"建立台灣電子商務法規的法律立場"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Laws** | 11,747 laws | Comprehensive Taiwanese legislation from law.moj.gov.tw |
| **Provisions** | 221,082 sections | Full-text searchable with FTS5 |
| **Preparatory Works** | 67,682 documents | Legislative yuan records and explanatory materials |
| **Database Size** | Optimized SQLite | Portable, pre-built |
| **Daily Updates** | Automated | Freshness checks against official sources |

**Verified data only** -- every citation is validated against official sources (Ministry of Justice, Taiwan). Zero LLM-generated content.

---

## See It In Action

### Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from the Laws & Regulations Database (law.moj.gov.tw), maintained by the Ministry of Justice
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by law identifier + article number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
law.moj.gov.tw --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                    ^                        ^
             Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search law.moj.gov.tw by law name | Search by plain Chinese: *"個人資料 同意"* |
| Navigate multi-chapter laws manually | Get the exact provision with context |
| Manual cross-referencing between laws | `build_legal_stance` aggregates across sources |
| "這部法律還有效嗎？" -> check manually | `check_currency` tool -> answer in seconds |
| Find international alignment -> dig through WTO/APEC | `get_eu_basis` -> linked frameworks instantly |
| No API, no integration | MCP protocol -> AI-native |

**Traditional:** Search MOJ database -> Download PDF -> Ctrl+F -> Cross-reference between codes -> Check Judicial Yuan for rulings -> Repeat

**This MCP:** *"個人資料保護法第十五條如何與GDPR的合法性基礎比較？"* -> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 221,082 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by law identifier + article number |
| `check_currency` | Check if a law is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple laws for a legal topic |
| `format_citation` | Format citations per Taiwanese legal conventions |
| `list_sources` | List all available laws with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Alignment Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get international frameworks (WTO, APEC CBPR, GDPR-aligned) that a Taiwanese law aligns with |
| `get_taiwanese_implementations` | Find Taiwanese laws aligning with a specific international framework |
| `search_eu_implementations` | Search international documents with Taiwanese alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Taiwanese laws against international frameworks |

---

## International Law Alignment

Taiwan is not an EU member state or WTO member under its own name (it participates as "Chinese Taipei"). International alignment for Taiwanese law is anchored in:

- **GDPR alignment** -- Taiwan's Personal Data Protection Act (個人資料保護法, PDPA) was substantially revised to align with GDPR principles. Taiwan's National Development Council has been working toward an EU adequacy decision
- **APEC CBPR** -- Taiwan ("Chinese Taipei") participates in the APEC Cross-Border Privacy Rules framework, enabling data transfers within APEC economies
- **WTO (as Chinese Taipei)** -- Taiwan participates in the WTO as "Chinese Taipei," meaning WTO agreements on IP (TRIPS), services (GATS), and goods shape domestic legislation
- **Cybersecurity frameworks** -- Taiwan's Cybersecurity Management Act (資通安全管理法) draws on NIST frameworks and international best practices
- **US-Taiwan economic frameworks** -- The US-Taiwan Initiative on 21st-Century Trade informs commercial law alignment

The international alignment tools allow you to explore these relationships -- identifying where Taiwanese provisions correspond to international standards.

> **Note:** International cross-references reflect alignment and framework relationships, not direct transposition. Taiwan adopts its own legislative approach and the tools identify analogous provisions rather than formal implementing legislation.

---

## Data Sources & Freshness

All content is sourced from authoritative Taiwanese legal databases:

- **[Laws & Regulations Database](https://law.moj.gov.tw/)** -- Ministry of Justice, Taiwan (primary source)

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Ministry of Justice, Taiwan (法務部) |
| **Retrieval method** | Official MOJ API and database ingestion |
| **Language** | Traditional Chinese |
| **Coverage** | 11,747 laws across all legal domains |
| **Last ingested** | 2026-02-25 |

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors official sources for changes:

| Source | Check | Method |
|--------|-------|--------|
| **Law amendments** | MOJ database comparison | All 11,747 laws checked |
| **New laws** | MOJ publications (90-day window) | Diffed against database |
| **Preparatory works** | Legislative Yuan records | New materials detected |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from the Laws & Regulations Database (Ministry of Justice, Taiwan). However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research
> - **Verify critical citations** against primary sources for court filings
> - **International cross-references** reflect alignment relationships, not formal transposition
> - **Administrative regulations** (行政規則) may have partial coverage; check official sources for subsidiary legislation

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. See [PRIVACY.md](PRIVACY.md) for guidance on professional use in accordance with 台灣律師聯合會 (Taiwan Bar Association) standards.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Taiwanese-law-mcp
cd Taiwanese-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest                    # Ingest laws from MOJ database
npm run build:db                  # Rebuild SQLite database
npm run check-updates             # Check for amendments and new laws
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Reliability:** 100% ingestion success rate across 11,747 laws

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, Colombia, Denmark, Finland, France, Germany, Ireland, Italy, Japan, Netherlands, Norway, Serbia, Slovenia, South Korea, Sweden, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Judicial Yuan case law coverage (司法院裁判書)
- Administrative regulations (行政規則) expansion
- Historical statute versions and amendment tracking
- English translations for key statutes

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full corpus ingestion (11,747 laws, 221,082 provisions)
- [x] Preparatory works (67,682 documents)
- [x] International law alignment tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Judicial Yuan case law expansion
- [ ] Administrative regulations (行政規則)
- [ ] Historical statute versions (amendment tracking)
- [ ] English translations for key statutes

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{taiwanese_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Taiwanese Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Taiwanese-law-mcp},
  note = {11,747 Taiwanese laws with 221,082 provisions and 67,682 preparatory works}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Ministry of Justice, Taiwan (public domain -- government open data)
- **International Framework Metadata:** WTO, APEC (public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool -- turns out everyone building compliance tools has the same research frustrations.

So we're open-sourcing it. Navigating 11,747 Taiwanese laws shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>

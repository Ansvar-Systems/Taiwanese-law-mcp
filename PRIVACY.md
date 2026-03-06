# Privacy & Client Confidentiality

**IMPORTANT READING FOR LEGAL PROFESSIONALS**

This document addresses privacy and confidentiality considerations when using this Tool, with particular attention to professional obligations under Taiwanese bar association rules.

---

## Executive Summary

**Key Risks:**
- Queries through Claude API flow via Anthropic cloud infrastructure
- Query content may reveal client matters and privileged information
- Taiwan Bar Association (台灣律師聯合會) rules require strict confidentiality (保密義務) and data processing controls

**Safe Use Options:**
1. **General Legal Research**: Use Tool for non-client-specific queries
2. **Local npm Package**: Install `@ansvar/taiwanese-law-mcp` locally — database queries stay on your machine
3. **Remote Endpoint**: Vercel Streamable HTTP endpoint — queries transit Vercel infrastructure
4. **On-Premise Deployment**: Self-host with local LLM for privileged matters

---

## Data Flows and Infrastructure

### MCP (Model Context Protocol) Architecture

This Tool uses the **Model Context Protocol (MCP)** to communicate with AI clients:

```
User Query -> MCP Client (Claude Desktop/Cursor/API) -> Anthropic Cloud -> MCP Server -> Database
```

### Deployment Options

#### 1. Local npm Package (Most Private)

```bash
npx @ansvar/taiwanese-law-mcp
```

- Database is local SQLite file on your machine
- No data transmitted to external servers (except to AI client for LLM processing)
- Full control over data at rest

#### 2. Remote Endpoint (Vercel)

```
Endpoint: https://taiwanese-law-mcp.vercel.app/mcp
```

- Queries transit Vercel infrastructure
- Tool responses return through the same path
- Subject to Vercel's privacy policy

### What Gets Transmitted

When you use this Tool through an AI client:

- **Query Text**: Your search queries and tool parameters
- **Tool Responses**: Statute text (法律條文), provision content, search results
- **Metadata**: Timestamps, request identifiers

**What Does NOT Get Transmitted:**
- Files on your computer
- Your full conversation history (depends on AI client configuration)

---

## Professional Obligations (Taiwan)

### Taiwan Bar Association Rules

Lawyers (律師) in Taiwan are bound by strict confidentiality rules under the Attorney Regulation Act (律師法) and the Attorney Ethics Rules (律師倫理規範), administered by the Taiwan Bar Association (台灣律師聯合會) and regional bar associations.

#### Duty of Confidentiality (保密義務)

- All client communications are privileged under Article 38 of the Attorney Regulation Act
- Client identity may be confidential in sensitive matters
- Case strategy and legal analysis are protected
- Information that could identify clients or matters must be safeguarded
- Breach of confidentiality may result in disciplinary proceedings (懲戒程序)

### Taiwan Personal Data Protection Act (個人資料保護法)

Under the **Personal Data Protection Act (個人資料保護法 — PDPA)**, when using services that process client data:

- You are the **data controller** (個人資料管理者)
- AI service providers (Anthropic, Vercel) may be **data processors** on your behalf
- A **data processing agreement** may be required
- Ensure adequate technical and organizational measures (技術性及組織性安全措施) are in place
- The Personal Data Protection Commission (個人資料保護委員會) oversees compliance

---

## Risk Assessment by Use Case

### LOW RISK: General Legal Research

**Safe to use through any deployment:**

```
Example: "What does Article 184 of Taiwan's Civil Code say about tortious liability?"
```

- No client identity involved
- No case-specific facts
- Publicly available legal information

### MEDIUM RISK: Anonymized Queries

**Use with caution:**

```
Example: "What are the penalties under Taiwan's Money Laundering Control Act (洗錢防制法)?"
```

- Query pattern may reveal you are working on a money laundering matter
- Anthropic/Vercel logs may link queries to your API key

### HIGH RISK: Client-Specific Queries

**DO NOT USE through cloud AI services:**

- Remove ALL identifying details
- Use the local npm package with a self-hosted LLM
- Or use commercial legal databases (月旦法學知識庫, 法源法律網) with proper data processing agreements

---

## Data Collection by This Tool

### What This Tool Collects

**Nothing.** This Tool:

- Does NOT log queries
- Does NOT store user data
- Does NOT track usage
- Does NOT use analytics
- Does NOT set cookies

The database is read-only. No user data is written to disk.

### What Third Parties May Collect

- **Anthropic** (if using Claude): Subject to [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- **Vercel** (if using remote endpoint): Subject to [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)

---

## Recommendations

### For Solo Practitioners / Small Firms (個人律師事務所 / 小型事務所)

1. Use local npm package for maximum privacy
2. General research: Cloud AI is acceptable for non-client queries
3. Client matters: Use commercial legal databases (月旦法學知識庫, 法源法律網) with proper agreements

### For Large Firms / Corporate Legal Departments (大型事務所 / 法務部門)

1. Negotiate Data Processing Agreements with AI service providers consistent with PDPA requirements
2. Consider on-premise deployment with self-hosted LLM
3. Train staff on safe vs. unsafe query patterns
4. Document AI tool usage policies for professional compliance

### For Government / Public Sector (政府機關)

1. Use self-hosted deployment, no external APIs
2. Follow Taiwan government IT security requirements and Executive Yuan guidelines
3. Air-gapped option available for classified matters

---

## Questions and Support

- **Privacy Questions**: Open issue on [GitHub](https://github.com/Ansvar-Systems/Taiwanese-law-mcp/issues)
- **Anthropic Privacy**: Contact privacy@anthropic.com
- **Bar Guidance**: Consult Taiwan Bar Association (台灣律師聯合會) ethics guidance on AI tool use

---

**Last Updated**: 2026-03-06
**Tool Version**: 1.0.0

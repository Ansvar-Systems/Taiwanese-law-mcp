#!/usr/bin/env tsx
/**
 * Taiwan Legislative Yuan API (LYAPI v2) Ingestion Script
 *
 * Downloads bills and interpellations from the LYAPI v2 REST API
 * and inserts them into the Taiwan Law MCP premium database.
 *
 * Data source:
 *   API:      https://ly.govapi.tw/v2/
 *   Swagger:  https://ly.govapi.tw/v2/swagger
 *   Auth:     None required
 *   License:  CC BY 4.0 (OpenFun / g0v civic tech)
 *   Coverage: All Legislative Yuan terms, ~143K bills + ~11.7K interpellations
 *
 * Tables populated:
 *   - preparatory_works      (one row per bill/interpellation)
 *   - preparatory_works_fts  (via triggers)
 *
 * Usage:
 *   npx tsx scripts/premium-ingestion/taiwanese/ingest-lyapi.ts
 *   npx tsx scripts/premium-ingestion/taiwanese/ingest-lyapi.ts --resume
 *   npx tsx scripts/premium-ingestion/taiwanese/ingest-lyapi.ts --limit 500
 *   npx tsx scripts/premium-ingestion/taiwanese/ingest-lyapi.ts --dry-run
 *   npx tsx scripts/premium-ingestion/taiwanese/ingest-lyapi.ts --db /path/to/db
 *   npx tsx scripts/premium-ingestion/taiwanese/ingest-lyapi.ts --bills-only
 *   npx tsx scripts/premium-ingestion/taiwanese/ingest-lyapi.ts --interpellations-only
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://ly.govapi.tw/v2';
const USER_AGENT = 'Taiwan-Law-MCP/1.0.0 (https://github.com/Ansvar-Systems/Taiwanese-law-mcp; premium-ingestion)';
const DEFAULT_DB_PATH = path.resolve(__dirname, '../../../Taiwanese-law-mcp/data/database.db');
const BATCH_SIZE = 200;
const PAGE_SIZE = 5;
const REQUEST_DELAY_MS = 300;
const TERMS = [5, 6, 7, 8, 9, 10, 11]; // Legislative terms with bills

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  resume: boolean;
  dryRun: boolean;
  limit: number;
  dbPath: string;
  billsOnly: boolean;
  interpellationsOnly: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const opts: CliArgs = {
    resume: false,
    dryRun: false,
    limit: 0,
    dbPath: DEFAULT_DB_PATH,
    billsOnly: false,
    interpellationsOnly: false,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--resume': opts.resume = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--limit': opts.limit = parseInt(args[++i], 10); break;
      case '--db': opts.dbPath = path.resolve(args[++i]); break;
      case '--bills-only': opts.billsOnly = true; break;
      case '--interpellations-only': opts.interpellationsOnly = true; break;
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(endpoint: string, page: number, filter?: Record<string, string | number>): Promise<any> {
  const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
  if (filter) {
    for (const [k, v] of Object.entries(filter)) params.set(k, String(v));
  }
  const url = `${API_BASE}/${endpoint}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Record mapping
// ---------------------------------------------------------------------------

interface PrepWorkRecord {
  document_id: string;
  type: string;
  title: string;
  bill_number: string | null;
  legislative_period: string | null;
  summary: string | null;
  full_text: string | null;
  date_introduced: string | null;
  date_enacted: string | null;
  status: string | null;
  voting_result: string | null;
  related_statute_id: string | null;
  url: string | null;
  term_no: number | null;
  session_no: number | null;
  meeting_no: number | null;
  category: string | null;
  proposer: string | null;
  source: string;
}

function mapBill(bill: any): PrepWorkRecord {
  const billNo = String(bill['議案編號'] || '').trim();
  const docId = `twbill-${billNo}`;
  const title = String(bill['議案名稱'] || '').trim();
  const proposer = String(bill['提案單位/提案委員'] || '').trim();
  const status = String(bill['議案狀態'] || '').trim();
  const category = String(bill['議案類別'] || '').trim();
  const term = bill['屆'] ? Number(bill['屆']) : null;
  const session = bill['會期'] ? Number(bill['會期']) : null;
  const dateStr = String(bill['最新進度日期'] || '').trim();

  // Build summary from available fields
  let summary = '';
  if (category) summary += `[${category}] `;
  if (proposer) summary += `Proposed by: ${proposer}. `;
  if (status) summary += `Status: ${status}`;
  summary = summary.trim() || null as any;

  // Get related law codes
  const lawCodes = bill['法律編號:str'];
  const relatedLaw = Array.isArray(lawCodes) ? lawCodes.join(', ') : null;

  return {
    document_id: docId,
    type: 'bill',
    title: title || `Bill ${billNo}`,
    bill_number: billNo || null,
    legislative_period: bill['會議代碼:str'] || null,
    summary: summary || null,
    full_text: null,
    date_introduced: dateStr || null,
    date_enacted: null,
    status: status || null,
    voting_result: null,
    related_statute_id: relatedLaw,
    url: bill['url'] || null,
    term_no: term,
    session_no: session,
    meeting_no: null,
    category: category || null,
    proposer: proposer || null,
    source: 'lyapi',
  };
}

function mapInterpellation(interp: any): PrepWorkRecord {
  const interpNo = String(interp['質詢編號'] || '').trim();
  const docId = `twinterp-${interpNo.replace(/\s+/g, '-')}`;
  const members = String(interp['質詢委員'] || '').trim();
  const subject = String(interp['事由'] || '').trim();
  const description = String(interp['說明'] || '').trim();
  const pubDate = String(interp['刊登日期'] || '').trim();
  const term = interp['屆'] ? Number(interp['屆']) : null;
  const session = interp['會期'] ? Number(interp['會期']) : null;

  const title = subject || `Interpellation ${interpNo}`;
  const summary = members ? `Interpellated by: ${members}` : null;
  const fullText = description || null;

  return {
    document_id: docId,
    type: 'interpellation',
    title,
    bill_number: interpNo || null,
    legislative_period: interp['會議代碼:str'] || null,
    summary,
    full_text: fullText,
    date_introduced: pubDate || null,
    date_enacted: null,
    status: 'published',
    voting_result: null,
    related_statute_id: null,
    url: null,
    term_no: term,
    session_no: session,
    meeting_no: interp['會次'] ? Number(interp['會次']) : null,
    category: 'interpellation',
    proposer: members || null,
    source: 'lyapi',
  };
}

// ---------------------------------------------------------------------------
// Ingestion loop
// ---------------------------------------------------------------------------

async function ingestEndpoint(
  db: Database.Database,
  insertStmt: Database.Statement,
  endpoint: string,
  label: string,
  mapper: (record: any) => PrepWorkRecord,
  existingIds: Set<string>,
  opts: CliArgs,
  globalCounts: { inserted: number; skipped: number; errors: number },
): Promise<number> {
  console.log(`\n  Ingesting ${label} from ${API_BASE}/${endpoint}...`);

  // Use term-based pagination to stay under 10K page limit per query
  const useTerm = endpoint === 'bills';
  const termList = useTerm ? TERMS : [0]; // 0 = no filter

  let totalDiscovered = 0;
  let batch: PrepWorkRecord[] = [];

  for (const term of termList) {
    const filter = useTerm && term > 0 ? { '屆': term } : undefined;
    const termLabel = useTerm && term > 0 ? ` [Term ${term}]` : '';

    // Get first page to determine total for this term/segment
    let firstPage: any;
    try {
      firstPage = await fetchPage(endpoint, 1, filter);
    } catch (err: any) {
      console.log(`    ${termLabel} First page error: ${err.message}`);
      continue;
    }
    const total = firstPage.total || 0;
    const totalPages = firstPage.total_page || 0;
    console.log(`    ${termLabel} ${total.toLocaleString()} records, ${totalPages.toLocaleString()} pages`);

    if (total === 0) continue;

    for (let page = 1; page <= totalPages; page++) {
      let data: any;
      try {
        data = page === 1 ? firstPage : await fetchPage(endpoint, page, filter);
        await sleep(REQUEST_DELAY_MS);
      } catch (err: any) {
        // On 413, try with limit=1 for this single page
        if (err.message.includes('413')) {
          try {
            const params = new URLSearchParams({ page: String(page), limit: '1' });
            if (filter) for (const [k, v] of Object.entries(filter)) params.set(k, String(v));
            const url = `${API_BASE}/${endpoint}?${params.toString()}`;
            const res = await fetch(url, {
              headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
              signal: AbortSignal.timeout(30_000),
            });
            if (res.ok) { data = await res.json(); }
            else { globalCounts.errors++; continue; }
          } catch { globalCounts.errors++; continue; }
        } else {
          if (page % 500 === 0) console.log(`    ${termLabel} Page ${page}: ${err.message}`);
          globalCounts.errors++;
          continue;
        }
      }

      const records = Array.isArray(data) ? data :
        (data.bills || data.interpellations || data.data || data.records || []);
      const items = records.length > 0 ? records : (Array.isArray(data) ? data : []);

      for (const record of items) {
        totalDiscovered++;
        const mapped = mapper(record);

        if (opts.resume && existingIds.has(mapped.document_id)) {
          globalCounts.skipped++;
          continue;
        }

        batch.push(mapped);
        globalCounts.inserted++;

        if (batch.length >= BATCH_SIZE) {
          if (!opts.dryRun) {
            const tx = db.transaction(() => {
              for (const rec of batch) {
                try { insertStmt.run(rec); } catch (e: any) {
                  if (!e.message.includes('UNIQUE constraint')) globalCounts.errors++;
                }
              }
            });
            tx();
          }
          batch.length = 0;
        }

        if (opts.limit && globalCounts.inserted >= opts.limit) break;
      }

      if (page % 500 === 0) {
        console.log(`    ${termLabel} Page ${page}/${totalPages} — ${globalCounts.inserted.toLocaleString()} inserted`);
      }

      if (opts.limit && globalCounts.inserted >= opts.limit) break;
    }

    if (opts.limit && globalCounts.inserted >= opts.limit) break;
  }

  // Flush remaining batch
  if (batch.length > 0 && !opts.dryRun) {
    const tx = db.transaction(() => {
      for (const rec of batch) {
        try { insertStmt.run(rec); } catch (e: any) {
          if (!e.message.includes('UNIQUE constraint')) globalCounts.errors++;
        }
      }
    });
    tx();
  }

  return totalDiscovered;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  console.log('Taiwan Legislative Yuan API (LYAPI v2) Ingestion');
  console.log('='.repeat(55));
  console.log(`  Database:  ${opts.dbPath}`);
  console.log(`  Mode:      ${opts.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Resume:    ${opts.resume}`);
  console.log(`  Limit:     ${opts.limit || 'none'}`);
  console.log(`  Scope:     ${opts.billsOnly ? 'bills only' : opts.interpellationsOnly ? 'interpellations only' : 'bills + interpellations'}`);
  console.log(`  Source:    ${API_BASE}`);
  console.log();

  if (!fs.existsSync(opts.dbPath)) {
    console.error('ERROR: No database found at ' + opts.dbPath);
    process.exit(1);
  }

  const db = new Database(opts.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 10000');

  const hasPW = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='preparatory_works'").get();
  if (!hasPW) {
    console.error('ERROR: Missing preparatory_works table. Run build-db-paid.ts first.');
    db.close();
    process.exit(1);
  }

  let existingIds = new Set<string>();
  if (opts.resume) {
    const rows = db.prepare("SELECT document_id FROM preparatory_works WHERE source='lyapi'").all() as { document_id: string }[];
    existingIds = new Set(rows.map(r => r.document_id));
    console.log(`  Resume mode: ${existingIds.size} existing lyapi records\n`);
  }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO preparatory_works
      (document_id, type, title, bill_number, legislative_period,
       summary, full_text, date_introduced, date_enacted, status,
       voting_result, related_statute_id, url,
       term_no, session_no, meeting_no, category, proposer, source)
    VALUES
      (@document_id, @type, @title, @bill_number, @legislative_period,
       @summary, @full_text, @date_introduced, @date_enacted, @status,
       @voting_result, @related_statute_id, @url,
       @term_no, @session_no, @meeting_no, @category, @proposer, @source)
  `);

  const startTime = Date.now();
  const counts = { inserted: 0, skipped: 0, errors: 0 };
  let totalDiscovered = 0;

  // Ingest bills
  if (!opts.interpellationsOnly) {
    totalDiscovered += await ingestEndpoint(
      db, insertStmt, 'bills', 'Bills', mapBill, existingIds, opts, counts,
    );
  }

  // Ingest interpellations
  if (!opts.billsOnly && (!opts.limit || counts.inserted < opts.limit)) {
    totalDiscovered += await ingestEndpoint(
      db, insertStmt, 'interpellations', 'Interpellations', mapInterpellation, existingIds, opts, counts,
    );
  }

  // Final stats
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  const pwCount = (db.prepare('SELECT COUNT(*) as c FROM preparatory_works').get() as any).c;
  const dbSize = fs.statSync(opts.dbPath).size;

  console.log();
  console.log('='.repeat(55));
  console.log('COMPLETE');
  console.log(`  Discovered:       ${totalDiscovered.toLocaleString()}`);
  console.log(`  Inserted:         ${counts.inserted.toLocaleString()}`);
  console.log(`  Skipped:          ${counts.skipped.toLocaleString()}`);
  console.log(`  Errors:           ${counts.errors}`);
  console.log(`  Total prep_works: ${pwCount.toLocaleString()}`);
  console.log(`  DB size:          ${(dbSize / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Elapsed:          ${elapsed} minutes`);

  db.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

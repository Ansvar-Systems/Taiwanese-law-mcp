/**
 * Golden contract tests for Taiwanese Law MCP.
 * Validates core tool functionality against seed data.
 *
 * Requires data/database.db — skipped automatically in CI
 * or any environment where the DB file is absent.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../data/database.db');

const DB_EXISTS = fs.existsSync(DB_PATH);

let db: InstanceType<typeof Database>;

beforeAll(() => {
  if (!DB_EXISTS) return;
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = DELETE');
});

describe.skipIf(!DB_EXISTS)('Database integrity', () => {
  it('should have at least 11000 legal documents (excluding EU cross-refs)', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_documents WHERE id != 'eu-cross-references'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(11000);
  });

  it('should have at least 200000 provisions', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_provisions').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(200000);
  });

  it('should have FTS index', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH '個人資料'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(0);
  });
});

describe.skipIf(!DB_EXISTS)('Article retrieval', () => {
  it('should retrieve a provision by document_id and section', () => {
    const row = db.prepare(
      "SELECT content FROM legal_provisions WHERE document_id = 'tw-criminal-code' AND section = '358'"
    ).get() as { content: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.content.length).toBeGreaterThan(50);
  });

  it('should retrieve an order provision by document_id and section', () => {
    const row = db.prepare(
      "SELECT content FROM legal_provisions WHERE document_id = 'tw-a0000006' AND section = '1'"
    ).get() as { content: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.content.length).toBeGreaterThan(20);
  });
});

describe.skipIf(!DB_EXISTS)('Search', () => {
  it('should find results via FTS search', () => {
    const rows = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH '個人資料'"
    ).get() as { cnt: number };
    expect(rows.cnt).toBeGreaterThan(0);
  });
});

describe.skipIf(!DB_EXISTS)('Negative tests', () => {
  it('should return no results for fictional document', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'fictional-law-2099'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });

  it('should return no results for invalid section', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'tw-criminal-code' AND section = '999ZZZ-INVALID'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });
});

describe.skipIf(!DB_EXISTS)('Key laws are present', () => {
  const expectedDocs = [
    'tw-criminal-code',
    'tw-csma',
    'tw-cssa',
    'tw-epia',
    'tw-esa',
    'tw-fintech-sandbox',
    'tw-fgia',
    'tw-pdpa',
    'tw-tma',
    'tw-trade-secrets',
  ];

  for (const docId of expectedDocs) {
    it(`should contain document: ${docId}`, () => {
      const row = db.prepare(
        'SELECT id FROM legal_documents WHERE id = ?'
      ).get(docId) as { id: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.id).toBe(docId);
    });
  }
});

describe.skipIf(!DB_EXISTS)('list_sources', () => {
  it('should have db_metadata table', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM db_metadata').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });
});

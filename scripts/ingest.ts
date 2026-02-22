#!/usr/bin/env tsx
/**
 * Taiwanese Law MCP — Real legislation ingestion.
 *
 * Official source:
 *   - Taiwan Laws & Regulations Database OpenAPI
 *   - https://law.moj.gov.tw/api/swagger
 *   - Chinese law dataset:   https://law.moj.gov.tw/api/ch/law/json
 *   - Chinese order dataset: https://law.moj.gov.tw/api/ch/order/json
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBinaryWithRateLimit } from './lib/fetcher.js';
import {
  parseLawToSeed,
  parseOpenApiLawDataset,
  pcodeFromLawUrl,
  type TargetLawConfig,
  type OpenApiLawRecord,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

interface DatasetConfig {
  label: string;
  url: string;
  zipPath: string;
  jsonPath: string;
  zipEntryName: string;
}

const LAW_DATASET: DatasetConfig = {
  label: 'law',
  url: 'https://law.moj.gov.tw/api/ch/law/json',
  zipPath: path.join(SOURCE_DIR, 'ch-law-json.zip'),
  jsonPath: path.join(SOURCE_DIR, 'ChLaw.json'),
  zipEntryName: 'ChLaw.json',
};

const ORDER_DATASET: DatasetConfig = {
  label: 'order',
  url: 'https://law.moj.gov.tw/api/ch/order/json',
  zipPath: path.join(SOURCE_DIR, 'ch-order-json.zip'),
  jsonPath: path.join(SOURCE_DIR, 'ChOrder.json'),
  zipEntryName: 'ChOrder.json',
};

const KEY_TARGET_LAWS: TargetLawConfig[] = [
  { id: 'tw-pdpa', pcode: 'I0050021', shortName: 'PDPA', fileName: '01-personal-data-protection.json' },
  { id: 'tw-csma', pcode: 'A0030297', shortName: 'CSMA', fileName: '02-cybersecurity-management.json' },
  { id: 'tw-tma', pcode: 'K0060111', shortName: 'TMA', fileName: '03-telecommunications-management.json' },
  { id: 'tw-esa', pcode: 'J0080037', shortName: 'ESA', fileName: '04-electronic-signatures.json' },
  { id: 'tw-fgia', pcode: 'I0020026', shortName: 'FGIA', fileName: '05-freedom-of-government-information.json' },
  { id: 'tw-criminal-code', pcode: 'C0000001', shortName: 'Criminal Code', fileName: '06-criminal-code.json' },
  { id: 'tw-fintech-sandbox', pcode: 'G0380254', shortName: 'FinTech Sandbox Act', fileName: '07-fintech-sandbox.json' },
  { id: 'tw-trade-secrets', pcode: 'J0080028', shortName: 'TSA', fileName: '08-trade-secrets.json' },
  { id: 'tw-cssa', pcode: 'K0060044', shortName: 'CSSA', fileName: '09-communication-security-surveillance.json' },
  { id: 'tw-epia', pcode: 'G0380237', shortName: 'AEPI', fileName: '10-electronic-payment-institutions.json' },
];

interface IngestArgs {
  skipFetch: boolean;
  fullCorpus: boolean;
}

function parseArgs(): IngestArgs {
  const args = process.argv.slice(2);
  return {
    skipFetch: args.includes('--skip-fetch'),
    fullCorpus: !args.includes('--targeted'),
  };
}

function ensureDirectories(): void {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });
}

function clearSeedDirectory(): void {
  for (const name of fs.readdirSync(SEED_DIR)) {
    if (name.endsWith('.json')) {
      fs.unlinkSync(path.join(SEED_DIR, name));
    }
  }
}

function extractJsonFromZip(zipPath: string, zipEntryName: string): string {
  return execFileSync('unzip', ['-p', zipPath, zipEntryName], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });
}

async function loadOpenApiDataset(skipFetch: boolean, config: DatasetConfig): Promise<string> {
  ensureDirectories();

  if (skipFetch && fs.existsSync(config.jsonPath)) {
    console.log(`Using cached ${config.label} dataset: ${config.jsonPath}`);
    return fs.readFileSync(config.jsonPath, 'utf8');
  }

  console.log(`Fetching ${config.label} dataset: ${config.url}`);
  const response = await fetchBinaryWithRateLimit(config.url);
  if (response.status !== 200) {
    throw new Error(`OpenAPI download failed (${config.label}): HTTP ${response.status}`);
  }

  fs.writeFileSync(config.zipPath, response.body);
  console.log(`  Saved ZIP cache: ${config.zipPath} (${(response.body.length / 1024 / 1024).toFixed(1)} MB)`);

  const jsonText = extractJsonFromZip(config.zipPath, config.zipEntryName);
  fs.writeFileSync(config.jsonPath, jsonText);
  console.log(`  Extracted JSON: ${config.jsonPath}`);

  return jsonText;
}

function buildTargets(records: OpenApiLawRecord[], fullCorpus: boolean): TargetLawConfig[] {
  if (!fullCorpus) {
    return KEY_TARGET_LAWS;
  }

  const keyOverrides = new Map(KEY_TARGET_LAWS.map(target => [target.pcode, target]));
  const targets: TargetLawConfig[] = [];

  for (const record of records) {
    const pcode = pcodeFromLawUrl(record.LawURL ?? '');
    if (!pcode) continue;

    const override = keyOverrides.get(pcode);
    if (override) {
      targets.push(override);
      continue;
    }

    const fallbackShortName = (record.EngLawName?.trim() || record.LawName || pcode).slice(0, 80);
    targets.push({
      id: `tw-${pcode.toLowerCase()}`,
      pcode,
      shortName: fallbackShortName,
      fileName: `${pcode.toLowerCase()}.json`,
    });
  }

  targets.sort((a, b) => a.pcode.localeCompare(b.pcode, 'en', { sensitivity: 'base' }));
  return targets;
}

async function main(): Promise<void> {
  const { skipFetch, fullCorpus } = parseArgs();

  console.log('Taiwanese Law MCP — Real Data Ingestion');
  console.log('=======================================\n');
  console.log(`Source (law):   ${LAW_DATASET.url}`);
  console.log(`Source (order): ${ORDER_DATASET.url}`);
  if (skipFetch) console.log('Mode: --skip-fetch');
  console.log(`Scope: ${fullCorpus ? 'full-corpus' : 'targeted (10 key laws)'}`);
  console.log('');

  const lawJsonText = await loadOpenApiDataset(skipFetch, LAW_DATASET);
  const orderJsonText = await loadOpenApiDataset(skipFetch, ORDER_DATASET);

  const lawDataset = parseOpenApiLawDataset(lawJsonText);
  const orderDataset = parseOpenApiLawDataset(orderJsonText);
  const mergedRecords = [...lawDataset.Laws, ...orderDataset.Laws];

  const targets = buildTargets(mergedRecords, fullCorpus);
  const recordsByPcode = new Map<string, OpenApiLawRecord>();
  for (const record of mergedRecords) {
    const pcode = pcodeFromLawUrl(record.LawURL ?? '');
    if (pcode) recordsByPcode.set(pcode, record);
  }

  clearSeedDirectory();

  let written = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;
  const missing: TargetLawConfig[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const record = recordsByPcode.get(target.pcode);
    if (!record) {
      missing.push(target);
      console.log(`  [${i + 1}/${targets.length}] MISSING ${target.pcode} -> ${target.fileName}`);
      continue;
    }

    const seed = parseLawToSeed(record, target);
    const outputPath = path.join(SEED_DIR, target.fileName);
    fs.writeFileSync(outputPath, `${JSON.stringify(seed, null, 2)}\n`);

    totalProvisions += seed.provisions.length;
    totalDefinitions += seed.definitions.length;
    written++;

    if (!fullCorpus || i < 20 || (i + 1) % 250 === 0 || i === targets.length - 1) {
      console.log(
        `  [${i + 1}/${targets.length}] ${record.LawName} (${target.pcode}) -> ${target.fileName} ` +
        `(${seed.provisions.length} provisions, ${seed.definitions.length} definitions)`,
      );
    }
  }

  console.log('\nIngestion summary');
  console.log('-----------------');
  console.log(`Law dataset update date:   ${lawDataset.UpdateDate}`);
  console.log(`Order dataset update date: ${orderDataset.UpdateDate}`);
  console.log(`Law records loaded:        ${lawDataset.Laws.length}`);
  console.log(`Order records loaded:      ${orderDataset.Laws.length}`);
  console.log(`Seed files written:        ${written}/${targets.length}`);
  console.log(`Total provisions:          ${totalProvisions}`);
  console.log(`Total definitions:         ${totalDefinitions}`);
  console.log(`Seed output dir:           ${SEED_DIR}`);

  if (missing.length > 0) {
    console.log('\nSkipped laws (not found in source dataset):');
    for (const target of missing) {
      console.log(`  - ${target.pcode} (${target.fileName})`);
    }
  }
}

main().catch(error => {
  console.error('Fatal ingestion error:', error);
  process.exit(1);
});

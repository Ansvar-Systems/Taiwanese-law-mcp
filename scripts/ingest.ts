#!/usr/bin/env tsx
/**
 * Taiwanese Law MCP — Real legislation ingestion.
 *
 * Official source:
 *   - Taiwan Laws & Regulations Database OpenAPI
 *   - https://law.moj.gov.tw/api/swagger
 *   - Chinese law dataset: https://law.moj.gov.tw/api/ch/law/json (ZIP)
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
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

const CH_LAW_JSON_ZIP_URL = 'https://law.moj.gov.tw/api/ch/law/json';
const CH_LAW_ZIP_PATH = path.join(SOURCE_DIR, 'ch-law-json.zip');
const CH_LAW_JSON_PATH = path.join(SOURCE_DIR, 'ChLaw.json');

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

function extractJsonFromZip(zipPath: string): string {
  return execFileSync('unzip', ['-p', zipPath, 'ChLaw.json'], {
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
}

async function loadOpenApiDataset(skipFetch: boolean): Promise<string> {
  ensureDirectories();

  if (skipFetch && fs.existsSync(CH_LAW_JSON_PATH)) {
    console.log(`Using cached dataset: ${CH_LAW_JSON_PATH}`);
    return fs.readFileSync(CH_LAW_JSON_PATH, 'utf8');
  }

  console.log(`Fetching OpenAPI dataset: ${CH_LAW_JSON_ZIP_URL}`);
  const response = await fetchBinaryWithRateLimit(CH_LAW_JSON_ZIP_URL);
  if (response.status !== 200) {
    throw new Error(`OpenAPI download failed: HTTP ${response.status}`);
  }

  fs.writeFileSync(CH_LAW_ZIP_PATH, response.body);
  console.log(`  Saved ZIP cache: ${CH_LAW_ZIP_PATH} (${(response.body.length / 1024 / 1024).toFixed(1)} MB)`);

  const jsonText = extractJsonFromZip(CH_LAW_ZIP_PATH);
  fs.writeFileSync(CH_LAW_JSON_PATH, jsonText);
  console.log(`  Extracted JSON: ${CH_LAW_JSON_PATH}`);

  return jsonText;
}

function buildTargets(datasetText: string, fullCorpus: boolean): TargetLawConfig[] {
  if (!fullCorpus) {
    return KEY_TARGET_LAWS;
  }

  const dataset = parseOpenApiLawDataset(datasetText);
  const keyOverrides = new Map(KEY_TARGET_LAWS.map(target => [target.pcode, target]));
  const targets: TargetLawConfig[] = [];

  for (const law of dataset.Laws) {
    const pcode = pcodeFromLawUrl(law.LawURL ?? '');
    if (!pcode) continue;

    const override = keyOverrides.get(pcode);
    if (override) {
      targets.push(override);
      continue;
    }

    const fallbackShortName = (law.EngLawName?.trim() || law.LawName || pcode).slice(0, 80);
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
  console.log(`Source: ${CH_LAW_JSON_ZIP_URL}`);
  if (skipFetch) console.log('Mode: --skip-fetch');
  console.log(`Scope: ${fullCorpus ? 'full-corpus' : 'targeted (10 key laws)'}`);
  console.log('');

  const jsonText = await loadOpenApiDataset(skipFetch);
  const dataset = parseOpenApiLawDataset(jsonText);
  const targets = buildTargets(jsonText, fullCorpus);
  const lawsByPcode = new Map<string, (typeof dataset.Laws)[number]>();
  for (const law of dataset.Laws) {
    const pcode = pcodeFromLawUrl(law.LawURL ?? '');
    if (pcode) lawsByPcode.set(pcode, law);
  }

  clearSeedDirectory();

  let written = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;
  const missing: TargetLawConfig[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const lawRecord = lawsByPcode.get(target.pcode);
    if (!lawRecord) {
      missing.push(target);
      console.log(`  [${i + 1}/${targets.length}] MISSING ${target.pcode} -> ${target.fileName}`);
      continue;
    }

    const seed = parseLawToSeed(lawRecord, target);
    const outputPath = path.join(SEED_DIR, target.fileName);
    fs.writeFileSync(outputPath, `${JSON.stringify(seed, null, 2)}\n`);

    totalProvisions += seed.provisions.length;
    totalDefinitions += seed.definitions.length;
    written++;

    if (!fullCorpus || i < 20 || (i + 1) % 100 === 0 || i === targets.length - 1) {
      console.log(
        `  [${i + 1}/${targets.length}] ${lawRecord.LawName} (${target.pcode}) -> ${target.fileName} ` +
        `(${seed.provisions.length} provisions, ${seed.definitions.length} definitions)`
      );
    }
  }

  console.log('\nIngestion summary');
  console.log('-----------------');
  console.log(`Dataset update date: ${dataset.UpdateDate}`);
  console.log(`Seed files written: ${written}/${targets.length}`);
  console.log(`Total provisions:   ${totalProvisions}`);
  console.log(`Total definitions:  ${totalDefinitions}`);
  console.log(`Seed output dir:    ${SEED_DIR}`);

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

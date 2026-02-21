/**
 * Rate-limited HTTP client for Taiwan's Laws & Regulations Database OpenAPI.
 *
 * Official source:
 *   https://law.moj.gov.tw/api/swagger
 *
 * We enforce a conservative request delay (1.2s) per assignment guidance.
 */

const USER_AGENT = 'Ansvar-Law-MCP/1.0 (real-legislation-ingestion)';
const MIN_DELAY_MS = 1200;

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

export interface FetchBinaryResult {
  status: number;
  body: Buffer;
  contentType: string;
  url: string;
}

export async function fetchBinaryWithRateLimit(url: string, maxRetries = 3): Promise<FetchBinaryResult> {
  await waitForRateLimit();

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': '*/*',
        },
        redirect: 'follow',
      });

      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}; retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      return {
        status: response.status,
        body: Buffer.from(arrayBuffer),
        contentType: response.headers.get('content-type') ?? '',
        url: response.url,
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt + 1) * 1000;
        console.log(`  Network error for ${url}; retrying in ${backoffMs}ms...`);
        await sleep(backoffMs);
      }
    }
  }

  try {
    console.log(`  Falling back to curl for ${url}`);
    const body = execFileSync(
      'curl',
      ['-fL', '--retry', '3', '--retry-delay', '2', '-A', USER_AGENT, url],
      { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024 },
    );
    return {
      status: 200,
      body: Buffer.from(body),
      contentType: '',
      url,
    };
  } catch (curlError) {
    lastError = curlError;
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries: ${detail}`);
}
import { execFileSync } from 'node:child_process';

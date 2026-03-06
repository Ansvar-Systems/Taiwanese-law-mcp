/**
 * Response metadata utilities for Taiwanese Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Laws & Regulations Database (law.moj.gov.tw) — Ministry of Justice, Republic of China (Taiwan)',
    jurisdiction: 'TW',
    disclaimer:
      'This data is sourced from the Laws & Regulations Database of the Republic of China (Taiwan). ' +
      'The authoritative versions are maintained by the Ministry of Justice. ' +
      'Always verify with the official portal (law.moj.gov.tw).',
    freshness,
  };
}

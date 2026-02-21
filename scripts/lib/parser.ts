/**
 * Parser helpers for Taiwan Laws & Regulations Database OpenAPI payloads.
 *
 * Source format:
 *   - /api/ch/law/json (ZIP containing ChLaw.json)
 *   - JSON root: { UpdateDate, Laws[] }
 */

export interface OpenApiLawArticle {
  ArticleType: string;
  ArticleNo: string;
  ArticleContent: string;
}

export interface OpenApiLawRecord {
  LawName: string;
  EngLawName?: string;
  LawURL: string;
  LawCategory?: string;
  LawModifiedDate?: string;
  LawEffectiveDate?: string;
  LawEffectiveNote?: string;
  LawAbandonNote?: string;
  LawArticles: OpenApiLawArticle[];
}

export interface OpenApiLawDataset {
  UpdateDate: string;
  Laws: OpenApiLawRecord[];
}

export interface TargetLawConfig {
  id: string;
  pcode: string;
  shortName: string;
  fileName: string;
}

export interface ParsedProvision {
  provision_ref: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date?: string;
  in_force_date?: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

const ARTICLE_NUMBER_REGEX = /第\s*([0-9]+(?:-[0-9]+)*)\s*條/;
const SECTION_ENUM_REGEX = /[一二三四五六七八九十百千]+、\s*([^：\n]+)：\s*([\s\S]*?)(?=(?:\n|\s)[一二三四五六七八九十百千]+、\s*[^：\n]+：|$)/g;

function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim();
}

function normalizeLooseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function parseDateToIso(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim();
  if (!/^\d{8}$/.test(cleaned)) return undefined;
  const year = Number.parseInt(cleaned.slice(0, 4), 10);
  const month = Number.parseInt(cleaned.slice(4, 6), 10);
  const day = Number.parseInt(cleaned.slice(6, 8), 10);

  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}`;
}

function parseDate(raw: string | undefined): Date | undefined {
  const iso = parseDateToIso(raw);
  if (!iso) return undefined;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function deriveStatus(record: OpenApiLawRecord): ParsedAct['status'] {
  if (record.LawAbandonNote && record.LawAbandonNote.trim()) {
    return 'repealed';
  }

  if (record.LawEffectiveDate?.trim() === '99991231') {
    return 'amended';
  }

  const effectiveDate = parseDate(record.LawEffectiveDate);
  if (effectiveDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (effectiveDate > today) {
      return 'not_yet_in_force';
    }
  }

  return 'in_force';
}

function parseSection(articleNo: string, ordinal: number): string {
  const direct = articleNo.match(ARTICLE_NUMBER_REGEX)?.[1];
  if (direct) return direct;

  const fallback = articleNo.replace(/\s+/g, '').replace(/[^0-9-]/g, '');
  if (fallback) return fallback;

  return String(ordinal + 1);
}

function extractDefinitions(articleContent: string, sourceProvision: string): ParsedDefinition[] {
  if (!articleContent.includes('定義如下')) return [];

  const found: ParsedDefinition[] = [];
  const seen = new Set<string>();
  SECTION_ENUM_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SECTION_ENUM_REGEX.exec(articleContent)) !== null) {
    const term = normalizeLooseWhitespace(match[1]);
    const definition = normalizeLooseWhitespace(match[2]);
    if (!term || !definition) continue;

    const key = `${term}::${definition}`;
    if (seen.has(key)) continue;
    seen.add(key);

    found.push({
      term,
      definition,
      source_provision: sourceProvision,
    });
  }

  return found;
}

export function pcodeFromLawUrl(url: string): string | undefined {
  const match = url.match(/[?&]pcode=([A-Z0-9]+)/i);
  return match?.[1]?.toUpperCase();
}

export function parseOpenApiLawDataset(jsonText: string): OpenApiLawDataset {
  const clean = jsonText.replace(/^\uFEFF/, '');
  const parsed = JSON.parse(clean) as OpenApiLawDataset;

  if (!parsed || !Array.isArray(parsed.Laws)) {
    throw new Error('Unexpected OpenAPI payload: missing Laws[]');
  }

  return parsed;
}

export function indexLawsByPcode(dataset: OpenApiLawDataset): Map<string, OpenApiLawRecord> {
  const map = new Map<string, OpenApiLawRecord>();
  for (const law of dataset.Laws) {
    const pcode = pcodeFromLawUrl(law.LawURL ?? '');
    if (pcode) map.set(pcode, law);
  }
  return map;
}

export function parseLawToSeed(record: OpenApiLawRecord, target: TargetLawConfig): ParsedAct {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  const provisionRefCount = new Map<string, number>();
  const articleRows = (record.LawArticles ?? []).filter(article => article.ArticleType === 'A');

  for (let i = 0; i < articleRows.length; i++) {
    const article = articleRows[i];
    const section = parseSection(article.ArticleNo ?? '', i);
    const rawRef = `art${section}`.replace(/[^0-9A-Za-z-]/g, '');
    const seen = provisionRefCount.get(rawRef) ?? 0;
    provisionRefCount.set(rawRef, seen + 1);
    const provisionRef = seen === 0 ? rawRef : `${rawRef}-${seen + 1}`;

    const content = normalizeText(article.ArticleContent ?? '');
    if (!content) continue;

    provisions.push({
      provision_ref: provisionRef,
      section,
      title: normalizeLooseWhitespace(article.ArticleNo ?? `第 ${section} 條`),
      content,
    });

    definitions.push(...extractDefinitions(content, provisionRef));
  }

  const issuedDate = parseDateToIso(record.LawModifiedDate);
  const inForceDate = record.LawEffectiveDate?.trim() === '99991231'
    ? undefined
    : parseDateToIso(record.LawEffectiveDate);

  const descriptionParts = [
    'Official legislation text from Taiwan Laws & Regulations Database.',
    record.LawCategory ? `Category: ${record.LawCategory}.` : undefined,
    `Articles extracted: ${provisions.length}.`,
  ].filter(Boolean);

  return {
    id: target.id,
    type: 'statute',
    title: record.LawName,
    title_en: record.EngLawName?.trim() || record.LawName,
    short_name: target.shortName,
    status: deriveStatus(record),
    issued_date: issuedDate,
    in_force_date: inForceDate,
    url: record.LawURL,
    description: descriptionParts.join(' '),
    provisions,
    definitions,
  };
}

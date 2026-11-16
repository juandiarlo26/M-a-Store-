import type { ProductCategory } from '../types/store';

const CATEGORY_PREFIX: Record<ProductCategory, string> = {
  Vestidos: 'VES',
  Blusas: 'BLU',
  Shorts: 'SHR',
  Pantalones: 'PAN',
  Faldas: 'FAL',
  Conjuntos: 'CNJ',
  Blazers: 'BLZ',
  Calzado: 'CAL',
  Bolsos: 'BOL',
  Accesorios: 'ACC',
};

export function normalizeSku(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function generateSuggestedSku(
  category: ProductCategory,
  existingSkus: Array<string | undefined>
): string {
  const catPrefix = CATEGORY_PREFIX[category] || 'PRN';
  const normalizedSet = new Set(
    existingSkus.map((s) => (s ? normalizeSku(s) : '')).filter(Boolean)
  );

  for (let i = 1; i <= 999; i++) {
    const candidate = `MIA-${catPrefix}-${String(i).padStart(3, '0')}`;
    if (!normalizedSet.has(candidate)) {
      return candidate;
    }
  }

  const fallbackSuffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MIA-${catPrefix}-${fallbackSuffix}`;
}

// Deterministic Code 39 barcode encoding (uppercase alphanumeric + '-')
const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '*': 'nwnnwnwnn',
};

export interface BarcodeBar {
  x: number;
  width: number;
}

export function encodeCode39Bars(rawCode: string): {
  bars: BarcodeBar[];
  totalWidth: number;
  encodedText: string;
} {
  const safe = normalizeSku(rawCode) || 'MIA-001';
  const full = `*${safe}*`;
  const narrow = 1.6;
  const wide = 3.8;
  const gap = 1.8;

  const bars: BarcodeBar[] = [];
  let cursor = 0;

  for (let cIdx = 0; cIdx < full.length; cIdx++) {
    const ch = full[cIdx];
    const pattern = CODE39_PATTERNS[ch] || CODE39_PATTERNS['-'];
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern[i] === 'w' ? wide : narrow;
      if (i % 2 === 0) {
        bars.push({ x: cursor, width: w });
      }
      cursor += w;
    }
    if (cIdx < full.length - 1) {
      cursor += gap;
    }
  }

  return {
    bars,
    totalWidth: Math.ceil(cursor),
    encodedText: safe,
  };
}

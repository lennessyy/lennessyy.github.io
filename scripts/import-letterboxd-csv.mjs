/**
 * One-time import of Letterboxd reviews CSV export.
 * Usage: node scripts/import-letterboxd-csv.mjs /path/to/reviews.csv
 *
 * Only imports entries with Watched Date >= CUTOFF.
 * Existing reviews.json entries win on slug collisions (RSS data preserved).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '../src/data/reviews.json');
const CUTOFF = '2024-12-13';
const CSV_PATH = process.argv[2];

if (!CSV_PATH) {
  console.error('Usage: node scripts/import-letterboxd-csv.mjs /path/to/reviews.csv');
  process.exit(1);
}

// --- CSV parser (handles quoted fields with embedded newlines/commas) ---
function parseCSV(text) {
  const rows = [];
  let field = '';
  let fields = [];
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (ch === '"') {
        inQuotes = false;
        i++;
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        fields.push(field);
        field = '';
        i++;
      } else if (ch === '\r' && text[i + 1] === '\n') {
        fields.push(field);
        rows.push(fields);
        fields = [];
        field = '';
        i += 2;
      } else if (ch === '\n') {
        fields.push(field);
        rows.push(fields);
        fields = [];
        field = '';
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }
  if (field || fields.length) {
    fields.push(field);
    rows.push(fields);
  }
  return rows;
}

function slugify(title, year) {
  const base = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return year ? `${base}-${year}` : base;
}

function textToHtml(text) {
  if (!text) return null;
  return text
    .split(/\n{2,}/)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join(' ');
}

// --- Parse CSV ---
const csvText = readFileSync(CSV_PATH, 'utf-8');
const rows = parseCSV(csvText);
const [header, ...dataRows] = rows;

// Map header names to indices
const idx = {};
header.forEach((col, i) => { idx[col.trim()] = i; });

console.log('CSV columns:', Object.keys(idx).join(', '));

const csvReviews = dataRows
  .filter(row => row.length > 1) // skip blank trailing rows
  .map(row => {
    const watchedDate = (row[idx['Watched Date']] || '').trim();
    const name = (row[idx['Name']] || '').trim();
    const year = row[idx['Year']] ? Number(row[idx['Year']]) : null;
    const rating = row[idx['Rating']] ? Number(row[idx['Rating']]) : null;
    const reviewText = (row[idx['Review']] || '').trim() || null;
    const letterboxdUrl = (row[idx['Letterboxd URI']] || '').trim();

    return {
      filmTitle: name,
      filmYear: year,
      rating,
      watchedDate,
      reviewHtml: textToHtml(reviewText),
      reviewText,
      letterboxdUrl,
      slug: slugify(name, year),
    };
  })
  .filter(r => r.watchedDate >= CUTOFF);

console.log(`CSV entries after ${CUTOFF}: ${csvReviews.length}`);

// --- Load existing reviews.json ---
let existing = [];
if (existsSync(OUTPUT)) {
  try {
    existing = JSON.parse(readFileSync(OUTPUT, 'utf-8'));
  } catch {
    existing = [];
  }
}
console.log(`Existing reviews.json entries: ${existing.length}`);

// Merge: CSV as base, existing wins on collision (preserves RSS HTML reviews/URLs)
const map = new Map();
for (const r of csvReviews) map.set(r.slug, r);
for (const r of existing) map.set(r.slug, r);

const merged = [...map.values()];
merged.sort((a, b) => (b.watchedDate || '').localeCompare(a.watchedDate || ''));

writeFileSync(OUTPUT, JSON.stringify(merged, null, 2));
console.log(`Done. Wrote ${merged.length} reviews to ${OUTPUT}`);

import { XMLParser } from 'fast-xml-parser';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '../src/data/reviews.json');
const FEED_URL = 'https://letterboxd.com/lennessy/rss/';

function decodeEntities(str) {
  return String(str)
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function fetchReviews() {
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Feed fetch failed: ${res.status}`);
  const xml = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    processEntities: true,
  });
  const feed = parser.parse(xml);
  const items = feed.rss.channel.item;
  if (!items) {
    console.log('No items found in feed.');
    return;
  }

  const reviews = (Array.isArray(items) ? items : [items]).map((item) => {
    // Strip HTML tags from description for plain text excerpt
    const rawDesc = item.description || '';
    const reviewHtml = rawDesc
      .replace(/<img [^>]*>/g, '')  // remove poster images
      .replace(/<p>Watched on .*?<\/p>/g, '') // remove "Watched on" line
      .trim();

    const reviewText = reviewHtml
      .replace(/<[^>]+>/g, '')
      .trim();

    return {
      filmTitle: decodeEntities(item['letterboxd:filmTitle'] || ''),
      filmYear: item['letterboxd:filmYear'] || null,
      rating: item['letterboxd:memberRating'] || null,
      watchedDate: item['letterboxd:watchedDate'] || '',
      reviewHtml: reviewHtml || null,
      reviewText: reviewText || null,
      letterboxdUrl: item.link || '',
      slug: slugify(decodeEntities(item['letterboxd:filmTitle'] || ''), item['letterboxd:filmYear']),
    };
  });

  // Merge with existing reviews to accumulate over time (RSS only has ~50)
  let existing = [];
  if (existsSync(OUTPUT)) {
    try {
      existing = JSON.parse(readFileSync(OUTPUT, 'utf-8'));
    } catch {
      existing = [];
    }
  }

  const merged = mergeReviews(existing, reviews);
  // Sort by watched date descending
  merged.sort((a, b) => (b.watchedDate || '').localeCompare(a.watchedDate || ''));

  writeFileSync(OUTPUT, JSON.stringify(merged, null, 2));
  console.log(`Wrote ${merged.length} reviews to ${OUTPUT}`);
}

function slugify(title, year) {
  const base = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return year ? `${base}-${year}` : base;
}

function mergeReviews(existing, fresh) {
  const map = new Map();
  // Existing first, then fresh overwrites
  for (const r of existing) map.set(r.slug, r);
  for (const r of fresh) map.set(r.slug, r);
  return [...map.values()];
}

fetchReviews().catch((err) => {
  console.error(err);
  process.exit(1);
});

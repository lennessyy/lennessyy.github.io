import { AtpAgent, RichText } from '@atproto/api';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../src/data');
const REVIEWS_FILE = resolve(DATA_DIR, 'reviews.json');
const POSTED_FILE = resolve(DATA_DIR, 'bluesky-posted.json');

const { BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD } = process.env;
if (!BLUESKY_IDENTIFIER || !BLUESKY_APP_PASSWORD) {
  console.error('BLUESKY_IDENTIFIER and BLUESKY_APP_PASSWORD must be set');
  process.exit(1);
}

const reviews = JSON.parse(readFileSync(REVIEWS_FILE, 'utf-8'));

let postedSlugs;
try {
  postedSlugs = new Set(JSON.parse(readFileSync(POSTED_FILE, 'utf-8')));
} catch {
  postedSlugs = new Set();
}

const toPost = reviews.filter(r => r.reviewText && !postedSlugs.has(r.slug));

if (toPost.length === 0) {
  console.log('No new reviews to post.');
  process.exit(0);
}

const agent = new AtpAgent({ service: 'https://bsky.social' });
await agent.login({ identifier: BLUESKY_IDENTIFIER, password: BLUESKY_APP_PASSWORD });

const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

function buildChunks(text, firstCap, restCap) {
  const sentences = [...segmenter.segment(text)].map(s => s.segment.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  let cap = firstCap;

  for (const sentence of sentences) {
    const candidate = current ? current + ' ' + sentence : sentence;
    if (candidate.length <= cap) {
      current = candidate;
    } else {
      if (current) {
        chunks.push(current);
        cap = restCap;
      }
      // Single sentence exceeds cap: fall back to word splitting
      if (sentence.length <= cap) {
        current = sentence;
      } else {
        let rem = sentence;
        while (rem.length > cap) {
          let cut = rem.lastIndexOf(' ', cap);
          if (cut === -1) cut = cap;
          chunks.push(rem.slice(0, cut).trimEnd());
          rem = rem.slice(cut).trimStart();
          cap = restCap;
        }
        current = rem;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildPostTexts(review) {
  const LIMIT = 300;
  const urlSuffix = `\n\n${review.letterboxdUrl} 📽️`;
  const text = review.reviewText.trim().replace(/\s+/g, ' ');

  const chunks = buildChunks(text, LIMIT - urlSuffix.length, LIMIT);

  return chunks.map((chunk, i) =>
    i === 0 ? `${chunk}${urlSuffix}` : chunk
  );
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

async function fetchEmbed(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const html = await res.text();

    const ogMeta = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`, 'i'))
        ?? html.match(new RegExp(`<meta[^>]+content="([^"]+)"[^>]+property="${prop}"`, 'i'));
      return m ? decodeEntities(m[1]) : null;
    };

    const title = ogMeta('og:title');
    const description = ogMeta('og:description');
    const image = ogMeta('og:image');

    if (!title) return null;

    let thumb;
    if (image) {
      const imgRes = await fetch(image);
      if (imgRes.ok) {
        const bytes = new Uint8Array(await imgRes.arrayBuffer());
        const encoding = imgRes.headers.get('content-type') ?? 'image/jpeg';
        const { data } = await agent.uploadBlob(bytes, { encoding });
        thumb = data.blob;
      }
    }

    return {
      $type: 'app.bsky.embed.external',
      external: { uri: url, title, description: description ?? '', ...(thumb && { thumb }) },
    };
  } catch {
    return null;
  }
}

async function postThread(postTexts, url) {
  const embed = await fetchEmbed(url);
  let root = null;
  let parent = null;

  for (let i = 0; i < postTexts.length; i++) {
    const rt = new RichText({ text: postTexts[i] });
    await rt.detectFacets(agent);

    const record = {
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date(Date.now() + i * 1000).toISOString(),
    };

    if (i === 0 && embed) record.embed = embed;

    if (parent) {
      record.reply = {
        root: { uri: root.uri, cid: root.cid },
        parent: { uri: parent.uri, cid: parent.cid },
      };
    }

    const response = await agent.post(record);
    if (!root) root = response;
    parent = response;

    if (i < postTexts.length - 1) await new Promise(r => setTimeout(r, 500));
  }
}

for (const review of toPost) {
  const postTexts = buildPostTexts(review);
  await postThread(postTexts, review.letterboxdUrl);
  postedSlugs.add(review.slug);
  console.log(`Posted: ${review.filmTitle} (${postTexts.length} post${postTexts.length > 1 ? 's' : ''})`);
  await new Promise(r => setTimeout(r, 1000));
}

writeFileSync(POSTED_FILE, JSON.stringify([...postedSlugs], null, 2));
console.log(`Done. Posted ${toPost.length} review(s).`);

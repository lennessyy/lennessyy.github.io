// Run after `npm run build`. Check the published artifacts, including every
// content URL, rather than only testing the functions that generate them.
import assert from 'node:assert/strict';
import { readFile, access, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const index = JSON.parse(await read('dist/content.json'));
const feed = JSON.parse(await read('dist/reviews.json'));
const sourceReviews = JSON.parse(await read('src/data/reviews.json'));
const origin = new URL(index.url).origin;
const localPath = (url) => {
  const parsed = new URL(url);
  assert.equal(parsed.origin, origin);
  assert.equal(parsed.search, '');
  assert.equal(parsed.hash, '');
  return `dist${parsed.pathname}${parsed.pathname.endsWith('/') ? 'index.html' : ''}`;
};
const graph = (html) => {
  const match = html.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(match, 'Page must contain JSON-LD');
  return JSON.parse(match[1])['@graph'];
};
const checkPage = async (url) => {
  const html = await read(localPath(url));
  const canonical = html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/);
  assert.equal(canonical?.[1], url, `Canonical URL for ${url}`);
  const entities = graph(html);
  assert.equal(entities[0]['@type'], 'Person');
  assert.equal(entities[0].name, 'Lenny Chen');
  assert.ok(html.includes(`${origin}/rss.xml`), 'RSS discovery link');
  assert.ok(html.includes(`${origin}/content.json`), 'Content index discovery link');
  return { html, entities };
};

const parser = new XMLParser();
const rss = await read('dist/rss.xml');
assert.equal(XMLValidator.validate(rss), true, 'RSS must be valid XML');
const rssItems = [parser.parse(rss).rss.channel.item].flat().filter(Boolean);
const posts = index.entries.filter((entry) => entry.type === 'blog');
assert.equal(rssItems.length, posts.length);
// A count from source files also catches accidentally omitted collection entries.
const markdownFiles = (await readdir(resolve(root, 'src/content/blog'), { recursive: true }))
  .filter((path) => path.endsWith('.md'));
assert.equal(posts.length, markdownFiles.length);
for (const post of posts) {
  const { html, entities } = await checkPage(post.url);
  const article = entities.find((entity) => entity['@type'] === 'BlogPosting');
  assert.equal(article.headline, post.title);
  assert.equal(article.datePublished, post.publishedAt);
  assert.equal(article.author['@id'], entities[0]['@id']);
  assert.ok(html.includes(`href="${post.markdownUrl}"`));
  const markdown = await read(localPath(post.markdownUrl));
  assert.ok(markdown.startsWith(`# ${post.title}\n`));
  assert.ok(markdown.includes(`Canonical URL: ${post.url}`));
  const source = await read(`src/content/blog/${new URL(post.markdownUrl).pathname.split('/blog/')[1]}`);
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
  assert.ok(markdown.includes(body), 'Markdown export must preserve the full post');
  const item = rssItems.find((item) => item.link === post.url);
  assert.equal(item?.title, post.title);
  assert.equal(item.description, post.description.trim());
}

assert.equal(feed.reviews.length, sourceReviews.length);
assert.equal(index.entries.filter((entry) => entry.type === 'review').length, sourceReviews.length);
for (const source of sourceReviews) {
  const review = feed.reviews.find((entry) => entry.sourceUrl === source.letterboxdUrl && entry.watchedDate === source.watchedDate);
  assert.ok(review, `Review feed includes ${source.filmTitle}`);
  assert.equal(review.rating, source.rating);
  assert.equal(review.reviewText, source.reviewText || null);
  assert.equal(review.watchedDate, source.watchedDate);
  assert.equal(review.ratingScale.max, 5);
  assert.equal(review.ratingScale.min, 0.5);
  if (!source.reviewText) {
    assert.equal(review.url, source.letterboxdUrl);
    continue;
  }
  const { entities } = await checkPage(review.url);
  const metadata = entities.find((entity) => entity['@type'] === 'Review');
  assert.equal(metadata.itemReviewed.name, source.filmTitle);
  assert.equal(metadata.reviewBody, source.reviewText);
  assert.equal(metadata.author['@id'], entities[0]['@id']);
  assert.equal(metadata.datePublished, undefined, 'Watch dates are not publication dates');
  if (source.rating == null) assert.equal(metadata.reviewRating, undefined);
  else {
    assert.equal(metadata.reviewRating.ratingValue, source.rating);
    assert.equal(metadata.reviewRating.worstRating, 0.5);
    assert.equal(metadata.reviewRating.bestRating, 5);
  }
}

for (const entry of index.entries) {
  if (new URL(entry.url).origin === origin) await access(resolve(root, localPath(entry.url)));
}
const sitemap = await read('dist/sitemap-0.xml');
assert.equal(XMLValidator.validate(sitemap), true);
const sitemapPages = parser.parse(sitemap).urlset.url;
for (const { loc } of sitemapPages) await checkPage(loc);
assert.ok((await read('dist/chooser/index.html')).includes(`rel="canonical" href="${origin}/chooser/"`));
const robots = await read('dist/robots.txt');
assert.ok(robots.includes('User-agent: *\nAllow: /'));
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap-index.xml`));
assert.equal(XMLValidator.validate(await read('dist/sitemap-index.xml')), true);
console.log(`Verified ${sitemapPages.length} canonical pages, ${posts.length} Markdown exports and RSS entries, ${feed.reviews.length} reviews, and robots.txt.`);

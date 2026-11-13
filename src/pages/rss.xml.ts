import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { absoluteUrl, pageUrl, xmlEscape as xml } from '../lib/metadata';

export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection('blog'))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  const items = posts.map((post) => {
    const url = xml(pageUrl(`/blog/${post.id}`, site));
    return `<item>
      <title>${xml(post.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${xml(post.data.description)}</description>
      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>
      ${post.data.tags.map((tag) => `<category>${xml(tag)}</category>`).join('\n')}
    </item>`;
  }).join('\n');
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Lenny Chen — Blog</title>
    <link>${xml(pageUrl('/blog', site))}</link>
    <description>Personal and technical writing by Lenny Chen.</description>
    <language>en</language>
    <atom:link href="${xml(absoluteUrl('/rss.xml', site))}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;
  return new Response(feed, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};

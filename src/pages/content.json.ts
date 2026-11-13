import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { absoluteUrl, pageUrl, siteDescription } from '../lib/metadata';
import { reviewFeed } from '../lib/review-feed';

export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection('blog'))
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  const pages = [
    { path: '/', title: 'Lenny Chen', description: siteDescription },
    { path: '/about', title: 'About', description: 'About Lenny Chen, a technical documentarian and film reviewer.' },
    { path: '/work', title: 'Work', description: 'Technical writing samples and documentation tooling.' },
    { path: '/blog', title: 'Blog', description: 'Personal and technical writing by Lenny Chen.' },
    { path: '/reviews', title: 'Film reviews', description: 'Film ratings and reviews by Lenny Chen, pulled from Letterboxd.' },
    { path: '/chooser', title: 'Fingies', description: 'A random finger chooser: put your fingers down and let fate pick one.' },
  ];
  return Response.json({
    version: 1,
    title: 'Lenny Chen — Content index',
    url: pageUrl('/', site),
    feeds: {
      blog: absoluteUrl('/rss.xml', site),
      reviews: absoluteUrl('/reviews.json', site),
      sitemap: absoluteUrl('/sitemap-index.xml', site),
    },
    entries: [
      ...pages.map(({ path, ...page }) => ({ ...page, type: 'page', url: pageUrl(path, site) })),
      ...posts.map((post) => ({
        type: 'blog',
        title: post.data.title,
        description: post.data.description,
        url: pageUrl(`/blog/${post.id}`, site),
        markdownUrl: absoluteUrl(`/blog/${post.id}.md`, site),
        publishedAt: post.data.pubDate.toISOString(),
        tags: post.data.tags,
      })),
      ...reviewFeed(site).map(({ reviewText, ...review }) => ({
        ...review,
        description: reviewText ? reviewText.slice(0, 240) : 'Film rating on Letterboxd.',
      })),
    ],
  });
};

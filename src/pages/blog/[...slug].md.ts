import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection, type CollectionEntry } from 'astro:content';
import { pageUrl } from '../../lib/metadata';

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('blog');
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
};

export const GET: APIRoute = ({ props, site }) => {
  const post = props.post as CollectionEntry<'blog'>;
  const content = [
    `# ${post.data.title}`,
    'Author: Lenny Chen',
    `Published: ${post.data.pubDate.toISOString().slice(0, 10)}`,
    `Canonical URL: ${pageUrl(`/blog/${post.id}`, site)}`,
    post.data.description,
    post.data.tags.length ? `Tags: ${post.data.tags.join(', ')}` : '',
    post.body,
  ].filter(Boolean).join('\n\n');
  return new Response(`${content}\n`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};

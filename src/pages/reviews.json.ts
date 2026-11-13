import type { APIRoute } from 'astro';
import { absoluteUrl } from '../lib/metadata';
import { reviewFeed } from '../lib/review-feed';

export const GET: APIRoute = ({ site }) => Response.json({
  version: 1,
  author: 'Lenny Chen',
  description: 'Film ratings and reviews. watchedDate is the viewing date, not a publication date. Null ratings mean unrated.',
  url: absoluteUrl('/reviews.json', site),
  reviews: reviewFeed(site),
});

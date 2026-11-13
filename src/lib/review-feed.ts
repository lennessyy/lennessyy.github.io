import reviews from '../data/reviews.json';
import { pageUrl } from './metadata';

export function reviewFeed(site: URL | undefined) {
  return reviews.map((review) => ({
    type: 'review',
    title: review.filmYear ? `${review.filmTitle} (${review.filmYear})` : review.filmTitle,
    url: review.reviewText ? pageUrl(`/reviews/${review.slug}`, site) : review.letterboxdUrl,
    sourceUrl: review.letterboxdUrl,
    filmTitle: review.filmTitle,
    filmYear: review.filmYear,
    rating: review.rating,
    ratingScale: { min: 0.5, max: 5 },
    watchedDate: review.watchedDate,
    reviewText: review.reviewText || null,
  }));
}

# Content discovery

The site generates these public files during `npm run build`. No server or
separate publishing step is needed beyond the existing GitHub Pages deployment.

| URL | Contents |
| --- | --- |
| `/content.json` | Main pages, blog summaries, review summaries, canonical URLs, and links to feeds |
| `/reviews.json` | All film ratings and full review text from `src/data/reviews.json` |
| `/rss.xml` | Blog RSS feed with descriptions, publication dates, tags, and links to full posts |
| `/blog/<slug>.md` | Full Markdown post with title, author, publication date, and canonical HTML URL |
| `/robots.txt` | Allows crawling and points to `/sitemap-index.xml` |

The JSON files include a `version` field for their format. Review ratings use a
0.5–5 scale; `null` means unrated. A watch date is not a publication date. Reviews
without written text link to Letterboxd rather than a nonexistent local page.

The shared layout adds canonical URLs and Person JSON-LD. Blog pages also expose
BlogPosting JSON-LD and film review pages expose Review/Movie JSON-LD. Unknown
publication and modification dates are omitted. Canonical HTML URLs use trailing
slashes to match the GitHub Pages directory layout and the existing sitemap.
The standalone chooser app has its own canonical link.

RSS and content index links appear in the site footer. Blog posts include a
Markdown link and an alternate representation link in the document head. The
reviews listing links to its JSON data. The shared head also advertises RSS and
the content index.

## Update and verify

Add or edit posts in `src/content/blog/` and reviews in `src/data/reviews.json` as
usual. The next build regenerates the exports automatically.

```sh
npm run build
node scripts/check-content-discovery.mjs
```

The verification script checks generated URLs, canonical links, JSON-LD, complete
Markdown bodies, RSS XML, review data, and crawler discovery files against the
source content. It does not contact external sites.

`robots.txt` permits all crawlers, including AI crawlers; it does not distinguish
search from model training. Hosting or CDN restrictions must be managed outside
this repository. A future domain change should update `site` in
`astro.config.mjs` and the canonical URL in `apps/chooser/index.html`.

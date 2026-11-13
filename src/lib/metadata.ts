export const siteDescription = "I'm Lenny Chen, an SF Bay Area-based writer, developer, and amateur film reviewer.";

export function absoluteUrl(path: string, site: URL | undefined): string {
  if (!site) throw new Error('The Astro site URL must be configured.');
  return new URL(path, site).href;
}

// GitHub Pages serves HTML pages from directories with trailing slashes.
export function pageUrl(path: string, site: URL | undefined): string {
  const url = new URL(absoluteUrl(path, site));
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  url.search = '';
  url.hash = '';
  return url.href;
}

export function person(site: URL | undefined) {
  return {
    '@type': 'Person',
    '@id': absoluteUrl('/#person', site),
    name: 'Lenny Chen',
    url: pageUrl('/', site),
    image: absoluteUrl('/images/me.jpeg', site),
    description: siteDescription,
    sameAs: [
      'https://github.com/lennessyy',
      'https://www.linkedin.com/in/lenny-jiaxi-chen/',
      'https://letterboxd.com/lennessy/',
    ],
  };
}

// JSON-LD is embedded in HTML: prevent content from ending the script element.
export function jsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function xmlEscape(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[character]!);
}

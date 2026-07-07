import type { Site } from '@/types/site';

/** Site logos in /public — filename stem must match site_key where possible. */
const SITE_LOGO_PATHS: Record<string, string> = {
  studiely: '/studiely.jpeg',
  mml: '/mml.png',
  makemylesson: '/mml.png',
  'make-my-lesson': '/mml.png',
  'skyen-systems': '/skyen-systems.png',
  'skyen-solutions': '/skyen-solutions.jpg',
  linguatude: '/linguatude.jpg',
};

function normalizeToken(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function domainStem(domain: string): string | null {
  const normalized = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  const stem = normalized.split('.')[0];
  return stem || null;
}

/** Resolve a /public logo path for a site, or null if none is configured. */
export function getSiteLogoPath(site: Pick<Site, 'site_key' | 'domain' | 'name'>): string | null {
  const candidates = [
    normalizeToken(site.site_key),
    domainStem(normalizeToken(site.domain) ?? ''),
    normalizeToken(site.name)?.replace(/\s+/g, '-'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (SITE_LOGO_PATHS[candidate]) {
      return SITE_LOGO_PATHS[candidate];
    }
  }

  for (const candidate of candidates) {
    const match = Object.entries(SITE_LOGO_PATHS).find(
      ([slug]) => candidate.includes(slug) || slug.includes(candidate),
    );
    if (match) {
      return match[1];
    }
  }

  return null;
}

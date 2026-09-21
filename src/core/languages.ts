/**
 * Language tag handling.
 *
 * Two rules drive this file:
 *
 * 1. Tags are BCP-47. FormLingo invented its own codes and ended up with a
 *    permanent collision: it used `kk` for Karakalpak, which is Google's code
 *    for Kazakh, so Kazakh had to be written `kz` and remapped internally.
 *    We use `kaa` for Karakalpak and `kk` for Kazakh, as the standard says.
 *
 * 2. The set of languages is open-ended. There is no allowlist here that a
 *    provider must appear in — an unknown-but-valid tag is passed through to
 *    the provider rather than rejected. This table exists to give known tags a
 *    display name and to normalise the ones people actually mistype.
 */

import type { LangTag } from './types';

/** Tags we can show a friendly name for. Not a limit on what may be used. */
export const KNOWN_LANGUAGES: Record<LangTag, string> = {
  'uz-Latn': "O'zbekcha (Lotin)",
  'uz-Cyrl': 'Ўзбекча (Кирилл)',
  kaa: 'Qaraqalpaqsha',
  kk: 'Қазақша',
  ky: 'Кыргызча',
  tg: 'Тоҷикӣ',
  tk: 'Türkmençe',
  az: 'Azərbaycanca',
  ru: 'Русский',
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  pl: 'Polski',
  nl: 'Nederlands',
  uk: 'Українська',
  ar: 'العربية',
  fa: 'فارسی',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
};

/**
 * Aliases accepted on input and normalised away.
 *
 * The FormLingo codes are here on purpose: a page already marked up for
 * FormLingo should work against this extension without being edited.
 */
const ALIASES: Record<string, LangTag> = {
  // FormLingo's codes.
  uz: 'uz-Latn',
  uzc: 'uz-Cyrl',
  kz: 'kk', // FormLingo's Kazakh
  // Common informal spellings.
  ua: 'uk',
  cn: 'zh',
  'zh-cn': 'zh',
  'uz-latin': 'uz-Latn',
  'uz-cyrillic': 'uz-Cyrl',
  kaa_latn: 'kaa',
  uzn_latn: 'uz-Latn',
};

/**
 * A tag written for FormLingo whose meaning changes under BCP-47.
 *
 * `kk` meant Karakalpak to FormLingo and means Kazakh to us. We cannot silently
 * reinterpret it, so callers that detect a legacy page surface this as a
 * warning and let the user confirm which language was meant.
 */
export const AMBIGUOUS_LEGACY_TAGS: Record<string, { legacy: LangTag; standard: LangTag }> = {
  kk: { legacy: 'kaa', standard: 'kk' },
};

/** Normalise a written tag to its canonical form. Unknown tags pass through. */
export function normalizeTag(raw: string): LangTag {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const direct = ALIASES[trimmed] ?? ALIASES[trimmed.toLowerCase()];
  if (direct) return direct;
  // Canonicalise casing: "UZ-latn" -> "uz-Latn", "EN" -> "en".
  const [lang, ...rest] = trimmed.split('-');
  const script = rest.map((p) =>
    p.length === 4 ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p.toUpperCase(),
  );
  return [lang.toLowerCase(), ...script].join('-');
}

/** Display name for a tag, falling back to the tag itself. */
export function displayName(tag: LangTag): string {
  return KNOWN_LANGUAGES[tag] ?? KNOWN_LANGUAGES[normalizeTag(tag)] ?? tag;
}

/** True when the tag is at least shaped like a valid BCP-47 tag. */
export function isPlausibleTag(tag: string): boolean {
  return /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(normalizeTag(tag));
}

/**
 * Field discovery.
 *
 * Two paths, in priority order:
 *
 * 1. Explicit attributes — `data-multifill` / `data-multifill-group`, plus
 *    FormLingo's `data-translate` / `data-formlingo-field` as aliases so pages
 *    already marked up for it work here unchanged. Reliable, requires editing
 *    the page.
 *
 * 2. Inference from names the page already has — `title_en`, `title[ru]`,
 *    `description.uz-Latn`, `formControlName="nameKk"`. This is what makes the
 *    extension useful the moment it is installed, on forms nobody prepared.
 *    Inferred groups are marked `inferred: true` so the UI can show them
 *    differently and let the user confirm or reject the guess.
 *
 * Nothing here mutates the page. Discovery reads; the overlay draws elsewhere.
 */

import { isPlausibleTag, normalizeTag } from '../core/languages';
import type { LangTag } from '../core/types';

export type FieldElement = HTMLInputElement | HTMLTextAreaElement;

export interface DiscoveredField {
  el: FieldElement;
  lang: LangTag;
  /** Identifies the set this field belongs to. Fields sharing a key fill each other. */
  groupKey: string;
  inferred: boolean;
}

export interface FieldGroup {
  key: string;
  inferred: boolean;
  /**
   * One field per language. A language can only appear once in a group — if a
   * page has two Russian inputs in one group we cannot know which to fill, so
   * the later one is reported as a conflict rather than silently ignored.
   * FormLingo silently keeps the last one.
   */
  fields: Map<LangTag, FieldElement>;
  conflicts: DiscoveredField[];
}

const EXPLICIT_LANG_ATTRS = ['data-multifill', 'data-translate'] as const;
const EXPLICIT_GROUP_ATTRS = ['data-multifill-group', 'data-formlingo-field'] as const;

const DEFAULT_GROUP = '__default__';

/** Inputs whose value is never natural-language text. */
const IGNORED_INPUT_TYPES = new Set([
  'password', 'hidden', 'file', 'checkbox', 'radio', 'submit', 'reset',
  'button', 'image', 'range', 'color', 'date', 'datetime-local', 'month',
  'week', 'time', 'number', 'email', 'tel', 'url',
]);

export function isEligible(el: Element): el is FieldElement {
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
  return !IGNORED_INPUT_TYPES.has(type);
}

// ── Explicit attributes ──────────────────────────────────────────────────────

function readExplicit(el: FieldElement): DiscoveredField | null {
  let raw: string | null = null;
  for (const attr of EXPLICIT_LANG_ATTRS) {
    raw = el.getAttribute(attr);
    if (raw) break;
  }
  if (!raw) return null;

  const lang = normalizeTag(raw);
  if (!isPlausibleTag(lang)) return null;

  let group: string | null = null;
  for (const attr of EXPLICIT_GROUP_ATTRS) {
    group = el.getAttribute(attr);
    if (group) break;
  }

  return { el, lang, groupKey: group ?? DEFAULT_GROUP, inferred: false };
}

// ── Inference from field names ───────────────────────────────────────────────

/**
 * Patterns that split a field name into a base (the property) and a language.
 *
 * Ordered most to least specific. Each must capture `base` and `lang`.
 */
const NAME_PATTERNS: RegExp[] = [
  // title[ru], translations[uz-Latn]
  /^(?<base>.+?)\[(?<lang>[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*)\]$/,
  // title.ru, translations.uz_Latn
  /^(?<base>.+?)\.(?<lang>[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*)$/,
  // title_ru, title-uz-latn, title_uz_cyrl
  /^(?<base>.+?)[_-](?<lang>[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*)$/,
  // titleRu, descriptionUzLatn — camelCase with a capitalised tag at the end
  /^(?<base>.+?)(?<lang>[A-Z][a-z]{1,2}(?:[A-Z][a-z]{2,4})?)$/,
];

/**
 * A base name must look like a real property, not the leftover of a bad split.
 * Without this, `user_id` reads as base "user", lang "id" (Indonesian).
 */
const MIN_BASE_LENGTH = 2;

/** Bare tags that are far more likely to be a field-name suffix than a language. */
const SUSPICIOUS_SUFFIXES = new Set(['id', 'in', 'is', 'it', 'no', 'so', 'to', 'at', 'as', 'be', 'by', 'do', 'he', 'my', 'of', 'on', 'or']);

function fieldName(el: FieldElement): string | null {
  return (
    el.getAttribute('formcontrolname') ??
    el.getAttribute('name') ??
    el.getAttribute('id') ??
    null
  );
}

function splitName(name: string): { base: string; lang: LangTag } | null {
  for (const pattern of NAME_PATTERNS) {
    const m = pattern.exec(name);
    const base = m?.groups?.['base'];
    const rawLang = m?.groups?.['lang'];
    if (!base || !rawLang) continue;
    if (base.length < MIN_BASE_LENGTH) continue;

    const lang = normalizeTag(rawLang.replace(/_/g, '-'));
    if (!isPlausibleTag(lang)) continue;
    if (SUSPICIOUS_SUFFIXES.has(lang)) continue;

    return { base: base.toLowerCase(), lang };
  }
  return null;
}

/**
 * A single field whose name happens to end in something tag-shaped proves
 * nothing. Only a base name carrying two or more distinct languages is
 * evidence of a translation group, so inference is applied per candidate group
 * rather than per field.
 */
const MIN_GROUP_SIZE_FOR_INFERENCE = 2;

function inferGroups(candidates: FieldElement[]): DiscoveredField[] {
  const byBase = new Map<string, DiscoveredField[]>();

  for (const el of candidates) {
    const name = fieldName(el);
    if (!name) continue;
    const split = splitName(name);
    if (!split) continue;
    const bucket = byBase.get(split.base) ?? [];
    bucket.push({ el, lang: split.lang, groupKey: split.base, inferred: true });
    byBase.set(split.base, bucket);
  }

  const result: DiscoveredField[] = [];
  for (const bucket of byBase.values()) {
    const distinctLangs = new Set(bucket.map((f) => f.lang));
    if (distinctLangs.size < MIN_GROUP_SIZE_FOR_INFERENCE) continue;
    result.push(...bucket);
  }
  return result;
}

// ── Entry point ──────────────────────────────────────────────────────────────

export interface DiscoveryOptions {
  /** Set false to use explicit attributes only. */
  inferFromNames?: boolean;
}

/**
 * Find every translation group inside `root`.
 *
 * Explicit markup wins: if a page has any explicitly marked field, inference is
 * skipped for the fields already claimed, so a half-marked-up page does not end
 * up with two competing groups over the same inputs.
 */
export function discover(
  root: ParentNode = document,
  options: DiscoveryOptions = {},
): FieldGroup[] {
  const { inferFromNames = true } = options;

  const all = Array.from(root.querySelectorAll('input, textarea')).filter(isEligible);

  const explicit: DiscoveredField[] = [];
  const unclaimed: FieldElement[] = [];
  for (const el of all) {
    const found = readExplicit(el);
    if (found) explicit.push(found);
    else unclaimed.push(el);
  }

  const discovered = inferFromNames
    ? [...explicit, ...inferGroups(unclaimed)]
    : explicit;

  const groups = new Map<string, FieldGroup>();
  for (const field of discovered) {
    // Explicit and inferred groups are namespaced apart so a base name can
    // never collide with an author-chosen group name.
    const key = field.inferred ? `inferred:${field.groupKey}` : `explicit:${field.groupKey}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, inferred: field.inferred, fields: new Map(), conflicts: [] };
      groups.set(key, group);
    }
    if (group.fields.has(field.lang)) group.conflicts.push(field);
    else group.fields.set(field.lang, field.el);
  }

  // A group of one has nothing to fill.
  return Array.from(groups.values()).filter((g) => g.fields.size >= 2);
}

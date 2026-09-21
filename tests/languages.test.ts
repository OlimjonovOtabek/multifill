import { describe, expect, it } from 'vitest';
import { displayName, isPlausibleTag, normalizeTag } from '../src/core/languages';

describe('normalizeTag', () => {
  it('canonicalises casing', () => {
    expect(normalizeTag('EN')).toBe('en');
    expect(normalizeTag('uz-latn')).toBe('uz-Latn');
    expect(normalizeTag('  RU  ')).toBe('ru');
  });

  it('maps FormLingo codes so existing markup keeps working', () => {
    expect(normalizeTag('uz')).toBe('uz-Latn');
    expect(normalizeTag('uzc')).toBe('uz-Cyrl');
    expect(normalizeTag('kz')).toBe('kk');
  });

  it('passes unknown but valid tags through instead of rejecting them', () => {
    expect(normalizeTag('sah')).toBe('sah');
    expect(isPlausibleTag('sah')).toBe(true);
  });

  it('rejects things that are not tag-shaped', () => {
    expect(isPlausibleTag('not a tag')).toBe(false);
    expect(isPlausibleTag('')).toBe(false);
  });
});

describe('displayName', () => {
  it('falls back to the tag itself when unknown', () => {
    expect(displayName('sah')).toBe('sah');
    expect(displayName('en')).toBe('English');
  });
});

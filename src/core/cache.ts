/**
 * Translation cache.
 *
 * Filling the same boilerplate across many records is the normal case in a CMS,
 * so most clicks in real use should cost zero network calls. FormLingo has no
 * cache at all and re-translates identical text every time.
 *
 * Backed by chrome.storage.local with an LRU bound, so it survives a service
 * worker restart (MV3 tears the worker down aggressively — an in-memory Map
 * would be empty again within seconds of idling).
 */

import type { LangTag, TranslationContext } from './types';

const STORAGE_KEY = 'multifill.cache.v1';
const DEFAULT_MAX_ENTRIES = 2000;

interface CacheEntry {
  text: string;
  /** Epoch ms of last read or write, for LRU eviction. */
  touched: number;
}

type CacheShape = Record<string, CacheEntry>;

/**
 * A cache key must cover everything that can change the output, or we serve a
 * translation produced under different instructions. Context matters as much as
 * the text does for context-aware providers.
 */
export function cacheKey(
  providerId: string,
  text: string,
  sourceLang: LangTag,
  targetLang: LangTag,
  context?: TranslationContext,
): string {
  const ctx = context
    ? JSON.stringify({
        f: context.fieldName ?? '',
        d: context.domain ?? '',
        g: context.glossary ?? {},
        n: context.doNotTranslate ?? [],
        m: context.maxLength ?? 0,
        t: context.tone ?? '',
      })
    : '';
  return `${providerId}\u0000${sourceLang}\u0000${targetLang}\u0000${ctx}\u0000${text}`;
}

export class TranslationCache {
  private readonly maxEntries: number;
  private loaded: CacheShape | null = null;
  /** Coalesces bursts of writes into one storage round-trip. */
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  private async load(): Promise<CacheShape> {
    if (this.loaded) return this.loaded;
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    this.loaded = (stored[STORAGE_KEY] as CacheShape | undefined) ?? {};
    return this.loaded;
  }

  async get(key: string): Promise<string | undefined> {
    const cache = await this.load();
    const entry = cache[key];
    if (!entry) return undefined;
    entry.touched = Date.now();
    this.scheduleFlush();
    return entry.text;
  }

  async set(key: string, text: string): Promise<void> {
    const cache = await this.load();
    cache[key] = { text, touched: Date.now() };
    this.evictIfNeeded(cache);
    this.scheduleFlush();
  }

  async clear(): Promise<void> {
    this.loaded = {};
    await chrome.storage.local.remove(STORAGE_KEY);
  }

  private evictIfNeeded(cache: CacheShape): void {
    const keys = Object.keys(cache);
    if (keys.length <= this.maxEntries) return;
    // Drop the least recently touched tenth, so eviction is not run per write.
    const target = Math.floor(this.maxEntries * 0.9);
    keys
      .sort((a, b) => (cache[a]?.touched ?? 0) - (cache[b]?.touched ?? 0))
      .slice(0, keys.length - target)
      .forEach((k) => delete cache[k]);
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 500);
  }

  private async flush(): Promise<void> {
    if (!this.loaded) return;
    await chrome.storage.local.set({ [STORAGE_KEY]: this.loaded });
  }
}

/**
 * Provider-agnostic core types.
 *
 * Nothing in this file knows about Chrome, the DOM, or any specific translation
 * service. Everything else in the extension depends on these types and not on
 * each other, so a provider can be added or swapped without touching the UI.
 */

/** A BCP-47 language tag, e.g. "en", "ru", "uz-Latn", "uz-Cyrl", "kaa", "kk". */
export type LangTag = string;

/**
 * What the caller knows about the text beyond the text itself.
 *
 * Classic machine-translation APIs ignore all of this. LLM providers use it,
 * and it is the main reason translations come out consistent across languages
 * instead of drifting term by term.
 */
export interface TranslationContext {
  /** The form field's own name, e.g. "course_title". Hints at register and length. */
  fieldName?: string;
  /** Free-text description of the surrounding product, e.g. "an LMS admin panel". */
  domain?: string;
  /** Terms that must render a fixed way, keyed by source term. */
  glossary?: Record<string, string>;
  /** Terms that must never be translated (brand and product names). */
  doNotTranslate?: string[];
  /** Soft character budget, so UI labels do not come back as sentences. */
  maxLength?: number;
  /** Preferred register. Providers that cannot honour it ignore it. */
  tone?: 'formal' | 'informal' | 'neutral';
}

export interface TranslateRequest {
  text: string;
  sourceLang: LangTag;
  targetLangs: LangTag[];
  context?: TranslationContext;
  /** Aborts the underlying network calls. */
  signal?: AbortSignal;
}

/**
 * One result per requested target language.
 *
 * Deliberately per-language rather than all-or-nothing: a provider that fails
 * on one language must still return the others. This is the single biggest
 * behavioural difference from FormLingo, which uses Promise.all and throws away
 * every success when one language fails.
 */
export type TranslationOutcome =
  | { lang: LangTag; ok: true; text: string; fromCache?: boolean }
  | { lang: LangTag; ok: false; error: string };

export interface TranslateResult {
  outcomes: TranslationOutcome[];
  /** Which provider actually served this, after any fallback. */
  providerId: string;
}

export interface ProviderCapabilities {
  /**
   * True when the provider translates into every target language in one
   * request. Multi-target providers give consistent terminology across
   * languages and cost one round-trip instead of N.
   */
  multiTarget: boolean;
  /** True when the provider makes use of TranslationContext. */
  contextAware: boolean;
  /** True when the provider needs a user-supplied credential to work at all. */
  requiresKey: boolean;
  /**
   * Tags this provider can handle. `null` means "ask it and see" — providers
   * backed by a large service should not maintain a hardcoded list that goes
   * stale. Language support stays open-ended by design.
   */
  languages: LangTag[] | null;
}

export interface TranslationProvider {
  /** Stable id stored in settings. Never change it once shipped. */
  readonly id: string;
  /** Human-readable name for the options page. */
  readonly label: string;
  readonly capabilities: ProviderCapabilities;

  /** True when the provider has everything it needs to run right now. */
  isConfigured(): Promise<boolean>;

  /**
   * Translate into every requested target language.
   *
   * Implementations must resolve with one outcome per target language and must
   * not reject for a per-language failure — reject only when the whole request
   * could not be attempted (no credential, aborted, network down).
   */
  translate(req: TranslateRequest): Promise<TranslationOutcome[]>;
}

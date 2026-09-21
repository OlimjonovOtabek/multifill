# Multifill

Fill every language field of a form from one click.

Multifill is a Chrome extension for people who build and maintain multilingual
admin panels. In a CMS a single "Title" is often five fields — English, Russian,
Uzbek Latin, Uzbek Cyrillic, Karakalpak. Multifill lets you type one of them,
press one button, and have the rest filled in.

> Status: early development. Nothing is published to the Chrome Web Store yet.

---

## What makes it different

Multifill is a ground-up alternative to existing form-translation extensions,
built around five decisions:

**One request, every language, with context.** Most tools fire an isolated
request per target language with nothing but the raw string, so terminology
drifts between languages. Multifill can send the field name, a project glossary
and the whole target list in a single request, so the outputs are consistent
with each other and with your product vocabulary.

**It never rewrites your page.** Buttons are drawn in an overlay layer
positioned from each field's bounding box. Your inputs are not moved, wrapped or
re-parented, so Angular Material layouts, sibling CSS selectors and focus all
keep working.

**It works on forms nobody marked up.** Explicit `data-multifill` attributes are
the reliable path, but Multifill also infers groups from the field names you
already have — `title_en`, `title_ru`, `description.uz` — so it does something
useful the moment it is installed.

**Nothing is overwritten silently.** Translations are shown as a preview you can
accept whole or field by field, and applying them can be undone.

**Standard language tags.** BCP-47 throughout, with no allowlist: Karakalpak is
`kaa`, Kazakh is `kk`, Uzbek is `uz-Latn` and `uz-Cyrl`, and any other valid tag
is passed through to the provider rather than rejected.

---

## Translation providers

Translation is behind a provider interface, chosen in the options page:

| Provider | Key required | Multi-target | Context-aware |
| --- | --- | --- | --- |
| Built-in (no key) | no | no | no |
| DeepL | your key | no | partly |
| Google Cloud Translation | your key | no | no |
| LLM (Claude and compatible) | your key | yes | yes |
| from-to.uz | no | no | no |

The built-in provider is the default so the extension works the moment it is
installed. Adding your own key unlocks the quality modes. Keys are stored in
`chrome.storage.local`, are never synced, and never leave your browser except to
the provider you chose.

from-to.uz covers Karakalpak and Uzbek Latin/Cyrillic transliteration, which the
large providers handle poorly or not at all.

---

## Usage

Add `data-multifill` to an input or textarea, with the language tag as its value:

```html
<input data-multifill="en" />
<input data-multifill="ru" />
<input data-multifill="uz-Latn" />
<input data-multifill="uz-Cyrl" />
<input data-multifill="kaa" />
```

Use `data-multifill-group` when a page has several independent sets:

```html
<input data-multifill="en" data-multifill-group="title" />
<input data-multifill="ru" data-multifill-group="title" />

<textarea data-multifill="en" data-multifill-group="description"></textarea>
<textarea data-multifill="ru" data-multifill-group="description"></textarea>
```

Pages already marked up for FormLingo are supported without changes:
`data-translate` and `data-formlingo-field` are read as aliases, and its
language codes (`uz`, `uzc`, `kz`) are normalised.

---

## Development

```bash
npm install
npm run dev        # watch build, load dist/ as an unpacked extension
npm run build      # typecheck + production build
npm test           # unit tests
npm run test:e2e   # Playwright, including an Angular Material fixture
```

Project layout:

```
src/
  core/        provider interface, language tags, cache, routing — no DOM, no chrome APIs
  content/     field discovery, overlay UI, value writing
  background/  service worker, provider implementations
  options/     settings page
```

`src/core` is deliberately free of both DOM and `chrome.*` calls so it can be
unit-tested directly and reused outside the extension later.

---

## License

MIT

import { beforeEach, describe, expect, it } from 'vitest';
import { discover } from '../src/content/discovery';

function setBody(html: string) {
  document.body.innerHTML = html;
}

const keys = (groups: ReturnType<typeof discover>) => groups.map((g) => g.key).sort();

describe('explicit markup', () => {
  beforeEach(() => setBody(''));

  it('groups fields by data-multifill-group', () => {
    setBody(`
      <input data-multifill="en" data-multifill-group="title" />
      <input data-multifill="ru" data-multifill-group="title" />
      <textarea data-multifill="en" data-multifill-group="body"></textarea>
      <textarea data-multifill="ru" data-multifill-group="body"></textarea>
    `);
    expect(keys(discover())).toEqual(['explicit:body', 'explicit:title']);
  });

  it('reads FormLingo attributes and codes as aliases', () => {
    setBody(`
      <input data-translate="uz" data-formlingo-field="name" />
      <input data-translate="uzc" data-formlingo-field="name" />
    `);
    const [group] = discover();
    expect(group?.key).toBe('explicit:name');
    expect([...(group?.fields.keys() ?? [])].sort()).toEqual(['uz-Cyrl', 'uz-Latn']);
  });

  it('reports a duplicate language as a conflict rather than dropping it', () => {
    setBody(`
      <input data-multifill="en" />
      <input data-multifill="ru" id="first" />
      <input data-multifill="ru" id="second" />
    `);
    const [group] = discover();
    expect((group?.fields.get('ru') as HTMLInputElement | undefined)?.id).toBe('first');
    expect(group?.conflicts).toHaveLength(1);
  });
});

describe('inference from field names', () => {
  beforeEach(() => setBody(''));

  it('infers a group from suffixed names', () => {
    setBody(`
      <input name="title_en" />
      <input name="title_ru" />
      <input name="title_uz" />
    `);
    const [group] = discover();
    expect(group?.inferred).toBe(true);
    expect([...(group?.fields.keys() ?? [])].sort()).toEqual(['en', 'ru', 'uz-Latn']);
  });

  it('handles bracket, dot and camelCase forms', () => {
    setBody(`<input name="name[en]" /><input name="name[ru]" />`);
    expect(discover()).toHaveLength(1);
    setBody(`<input name="name.en" /><input name="name.ru" />`);
    expect(discover()).toHaveLength(1);
    setBody(`<input formcontrolname="titleEn" /><input formcontrolname="titleRu" />`);
    expect(discover()).toHaveLength(1);
  });

  it('does not invent a group from a single tag-shaped suffix', () => {
    setBody(`<input name="user_id" /><input name="order_no" />`);
    expect(discover()).toEqual([]);
  });

  it('ignores inputs whose value is never prose', () => {
    setBody(`
      <input type="password" name="secret_en" />
      <input type="password" name="secret_ru" />
      <input type="number" name="price_en" />
      <input type="number" name="price_ru" />
    `);
    expect(discover()).toEqual([]);
  });

  it('can be turned off', () => {
    setBody(`<input name="title_en" /><input name="title_ru" />`);
    expect(discover(document, { inferFromNames: false })).toEqual([]);
  });
});

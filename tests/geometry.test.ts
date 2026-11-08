import { describe, expect, it } from 'vitest';
import { BUTTON_SIZE, intersect, placeButton, type Box } from '../src/content/geometry';

const field: Box = { top: 100, left: 50, right: 450, bottom: 134 };

describe('intersect', () => {
  it('returns the overlapping box', () => {
    expect(intersect({ top: 0, left: 0, right: 10, bottom: 10 }, { top: 5, left: 5, right: 20, bottom: 20 }))
      .toEqual({ top: 5, left: 5, right: 10, bottom: 10 });
  });

  it('returns null when boxes only touch or do not overlap', () => {
    expect(intersect({ top: 0, left: 0, right: 10, bottom: 10 }, { top: 10, left: 0, right: 10, bottom: 20 })).toBeNull();
    expect(intersect({ top: 0, left: 0, right: 10, bottom: 10 }, { top: 50, left: 50, right: 60, bottom: 60 })).toBeNull();
  });
});

describe('placeButton', () => {
  it('centers the button vertically inside the right edge of the field, unclipped when fully visible', () => {
    const placement = placeButton(field, { top: 0, left: 0, right: 1000, bottom: 1000 });

    expect(placement).toEqual({
      top: 105,
      left: 450 - BUTTON_SIZE - 8,
      clip: { top: 0, right: 0, bottom: 0, left: 0 },
      probe: { x: 430, y: 117 },
    });
  });

  it('hides the button when the field is scrolled out of its scroll container', () => {
    const dialogContent: Box = { top: 200, left: 0, right: 1000, bottom: 700 };

    expect(placeButton(field, dialogContent)).toBeNull();
  });

  it('clips the part of the button that is scrolled under the container edge', () => {
    const dialogContent: Box = { top: 115, left: 0, right: 1000, bottom: 700 };

    const placement = placeButton(field, dialogContent);

    expect(placement?.top).toBe(105);
    expect(placement?.clip).toEqual({ top: 10, right: 0, bottom: 0, left: 0 });
    expect(placement?.probe).toEqual({ x: 430, y: 122 });
  });

  it('hides the button when only the left part of the field is visible', () => {
    const narrowPanel: Box = { top: 0, left: 0, right: 300, bottom: 1000 };

    expect(placeButton(field, narrowPanel)).toBeNull();
  });
});

export interface Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Placement {
  top: number;
  left: number;
  clip: Insets;
  probe: { x: number; y: number };
}

export const BUTTON_SIZE = 24;
const BUTTON_GAP_RIGHT = 8;

export function intersect(a: Box, b: Box): Box | null {
  const box = {
    top: Math.max(a.top, b.top),
    left: Math.max(a.left, b.left),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  };
  return box.right > box.left && box.bottom > box.top ? box : null;
}

/**
 * Places the button inside the right edge of the field and clips it to the
 * part of the page where the field is actually visible, so a field scrolled
 * out of a dialog or panel does not leave its button floating over the
 * surrounding UI.
 */
export function placeButton(field: Box, visible: Box): Placement | null {
  const top = field.top + (field.bottom - field.top) / 2 - BUTTON_SIZE / 2;
  const left = field.right - BUTTON_SIZE - BUTTON_GAP_RIGHT;
  const button = { top, left, right: left + BUTTON_SIZE, bottom: top + BUTTON_SIZE };

  const shown = intersect(button, visible);
  if (!shown) return null;

  return {
    top,
    left,
    clip: {
      top: shown.top - button.top,
      right: button.right - shown.right,
      bottom: button.bottom - shown.bottom,
      left: shown.left - button.left,
    },
    probe: { x: (shown.left + shown.right) / 2, y: (shown.top + shown.bottom) / 2 },
  };
}

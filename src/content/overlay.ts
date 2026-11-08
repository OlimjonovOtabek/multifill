import type { FieldGroup } from './discovery';
import { intersect, placeButton, type Box, type Placement } from './geometry';

/**
 * Number of animation frames without any button moving before the position
 * sync loop stops. Dialog open animations, CSS transitions and scroll
 * momentum all move fields without firing ResizeObserver, so positions are
 * re-measured every frame until the layout settles.
 */
const STABLE_FRAMES_TO_STOP = 10;

const LAYOUT_EVENTS = ['transitionrun', 'transitionend', 'animationstart', 'animationend'] as const;

function composedParent(node: Element): Element | null {
  if (node.parentElement) return node.parentElement;
  const root = node.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

function composedContains(ancestor: Element, node: Element): boolean {
  for (let current: Element | null = node; current; current = composedParent(current)) {
    if (current === ancestor) return true;
  }
  return false;
}

function viewportBox(): Box {
  return { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight };
}

function clientBox(el: Element): Box {
  const rect = el.getBoundingClientRect();
  const top = rect.top + el.clientTop;
  const left = rect.left + el.clientLeft;
  return { top, left, right: left + el.clientWidth, bottom: top + el.clientHeight };
}

/** The part of the viewport where `el` is not cut off by a scrolling or clipping ancestor. */
function visibleBox(el: Element): Box | null {
  let visible: Box | null = viewportBox();
  let node = composedParent(el);
  while (node && visible && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      visible = intersect(visible, clientBox(node));
    }
    if (style.position === 'fixed') break;
    node = composedParent(node);
  }
  return visible;
}

export class OverlayManager {
  private container: HTMLDivElement;
  private shadow: ShadowRoot;
  private buttons = new Map<HTMLElement, HTMLButtonElement>();
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private stableFrames = 0;
  private lastLayout = '';

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'multifill-overlay-root';
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none'; // Let clicks pass through to the page
    this.container.style.zIndex = '2147483647'; // Max z-index
    
    this.shadow = this.container.attachShadow({ mode: 'closed' });
    
    const style = document.createElement('style');
    style.textContent = `
      .mf-btn {
        position: absolute;
        pointer-events: auto;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 4px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #475569;
        transition: background-color 0.2s, border-color 0.2s, color 0.2s;
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      }
      .mf-btn:hover {
        background: #e2e8f0;
        color: #0f172a;
        border-color: #94a3b8;
      }
      .mf-btn svg {
        width: 14px;
        height: 14px;
      }
      .mf-loading svg {
        animation: mf-spin 1s linear infinite;
      }
      @keyframes mf-spin {
        100% { transform: rotate(360deg); }
      }
    `;
    this.shadow.appendChild(style);
    
    // Defer appending until DOM is ready just in case
    if (document.body) {
      document.body.appendChild(this.container);
    } else {
      document.addEventListener('DOMContentLoaded', () => document.body.appendChild(this.container));
    }

    this.resizeObserver = new ResizeObserver(this.scheduleSync);

    // Capture scroll events on any scrolling container
    window.addEventListener('scroll', this.scheduleSync, { passive: true, capture: true });
    window.addEventListener('resize', this.scheduleSync, { passive: true });
    for (const type of LAYOUT_EVENTS) {
      document.addEventListener(type, this.scheduleSync, { passive: true, capture: true });
    }
  }

  public render(groups: FieldGroup[], onTranslate: (el: HTMLElement, lang: string, group: string) => void) {
    const currentFields = new Set<HTMLElement>();
    
    for (const group of groups) {
      for (const el of group.fields.values()) {
        currentFields.add(el);
      }
    }

    // Clean up detached buttons
    for (const [el, btn] of this.buttons.entries()) {
      if (!currentFields.has(el)) {
        btn.remove();
        this.buttons.delete(el);
        this.resizeObserver.unobserve(el);
      }
    }

    // Add new buttons
    for (const group of groups) {
      for (const [lang, el] of group.fields.entries()) {
        if (!this.buttons.has(el)) {
          const btn = this.createButton(el, lang, group.key, onTranslate);
          this.buttons.set(el, btn);
          this.shadow.appendChild(btn);
          this.resizeObserver.observe(el);
        }
      }
    }

    this.scheduleSync();
  }

  public setButtonLoading(el: HTMLElement, isLoading: boolean) {
    const btn = this.buttons.get(el);
    if (btn) {
      btn.classList.toggle('mf-loading', isLoading);
      btn.disabled = isLoading;
    }
  }

  private createButton(el: HTMLElement, lang: string, groupKey: string, onClick: (el: HTMLElement, lang: string, group: string) => void) {
    const btn = document.createElement('button');
    btn.className = 'mf-btn';
    btn.title = `Translate from ${lang}`;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>`;
    
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(el, lang, groupKey);
    });

    return btn;
  }

  private readonly scheduleSync = () => {
    this.stableFrames = 0;
    if (!this.frame) this.frame = requestAnimationFrame(this.syncFrame);
  };

  private readonly syncFrame = () => {
    this.frame = 0;
    const layout = this.updatePositions();
    this.stableFrames = layout === this.lastLayout ? this.stableFrames + 1 : 0;
    this.lastLayout = layout;
    if (this.stableFrames < STABLE_FRAMES_TO_STOP) {
      this.frame = requestAnimationFrame(this.syncFrame);
    }
  };

  /** Positions every button and returns a fingerprint of the layout, used to detect when it settles. */
  private updatePositions(): string {
    const layout: string[] = [];
    for (const [el, btn] of this.buttons.entries()) {
      const placement = this.placementFor(el);
      if (!placement) {
        btn.style.display = 'none';
        layout.push('-');
        continue;
      }

      const { top, left, clip } = placement;
      btn.style.display = 'flex';
      btn.style.top = `${top}px`;
      btn.style.left = `${left}px`;
      btn.style.clipPath = `inset(${clip.top}px ${clip.right}px ${clip.bottom}px ${clip.left}px)`;
      layout.push(`${top},${left},${clip.top},${clip.right},${clip.bottom},${clip.left}`);
    }
    return layout.join('|');
  }

  private placementFor(el: HTMLElement): Placement | null {
    if (!el.isConnected) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const visible = visibleBox(el);
    const placement = visible && placeButton(rect, visible);
    if (!placement || this.isCovered(el, placement.probe)) return null;
    return placement;
  }

  /** True when something else, such as a modal mask or a dropdown, is drawn over the field. */
  private isCovered(el: HTMLElement, point: { x: number; y: number }): boolean {
    const hit = document.elementsFromPoint(point.x, point.y).find((node) => node !== this.container);
    if (!hit) return true;
    return !composedContains(el, hit) && !composedContains(hit, el);
  }
}

// Export a singleton instance
export const overlay = new OverlayManager();

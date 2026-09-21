import type { FieldGroup } from './discovery';

export class OverlayManager {
  private container: HTMLDivElement;
  private shadow: ShadowRoot;
  private buttons = new Map<HTMLElement, HTMLButtonElement>();
  private resizeObserver: ResizeObserver;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'multifill-overlay-root';
    this.container.style.position = 'absolute';
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
        transition: all 0.2s;
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

    this.resizeObserver = new ResizeObserver(() => this.updatePositions());
    
    // Capture scroll events on any scrolling container
    window.addEventListener('scroll', () => this.updatePositions(), { passive: true, capture: true });
    window.addEventListener('resize', () => this.updatePositions(), { passive: true });
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

    this.updatePositions();
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

  private updatePositions() {
    for (const [el, btn] of this.buttons.entries()) {
      const rect = el.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0 || !document.contains(el)) {
        btn.style.display = 'none';
        continue;
      }
      
      btn.style.display = 'flex';
      
      // Position inside the right edge of the input
      const top = rect.top + window.scrollY + (rect.height / 2) - 12; // 12 = half of button height
      const left = rect.right + window.scrollX - 32; // 32px padding from right edge
      
      btn.style.top = `${top}px`;
      btn.style.left = `${left}px`;
    }
  }
}

// Export a singleton instance
export const overlay = new OverlayManager();

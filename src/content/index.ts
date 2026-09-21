import { discover, type FieldGroup } from './discovery';
import { overlay } from './overlay';

console.log('Multifill content script loaded');

let currentGroups: FieldGroup[] = [];

function updateOverlay() {
  currentGroups = discover();
  overlay.render(currentGroups, handleTranslateClick);
}

function writeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(el),
    'value'
  )?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function handleTranslateClick(sourceEl: HTMLElement, lang: string, groupKey: string) {
  const text = (sourceEl as HTMLInputElement).value;
  if (!text) return;

  const group = currentGroups.find(g => g.key === groupKey);
  if (!group) return;

  const targetLangs = Array.from(group.fields.keys()).filter(l => l !== lang);
  
  overlay.setButtonLoading(sourceEl, true);

  chrome.runtime.sendMessage({
    action: 'translate',
    text,
    sourceLang: lang,
    targetLangs
  }, (response) => {
    overlay.setButtonLoading(sourceEl, false);
    if (!response || !response.outcomes) return;
    
    for (const outcome of response.outcomes) {
      if (outcome.ok) {
        const targetEl = group.fields.get(outcome.lang);
        if (targetEl) {
          writeValue(targetEl as any, outcome.text);
        }
      } else {
        console.error(`Failed to translate to ${outcome.lang}:`, outcome.error);
      }
    }
  });
}

// Initial scan when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateOverlay);
} else {
  updateOverlay();
}

// Watch for DOM changes (like a React SPA rendering) to discover new inputs
const observer = new MutationObserver(() => {
  updateOverlay();
});
observer.observe(document.documentElement, { childList: true, subtree: true });

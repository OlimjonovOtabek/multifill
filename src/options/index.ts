import browser from 'webextension-polyfill';

const providerSelect = document.getElementById('provider') as HTMLSelectElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement;
const statusMsg = document.getElementById('status') as HTMLDivElement;
const keyGroup = document.getElementById('keyGroup') as HTMLDivElement;
const keyHelp = document.getElementById('keyHelp') as HTMLDivElement;

const PROVIDERS_REQUIRING_KEYS = ['deepl', 'google', 'llm', 'from-to'];

/**
 * Toggles the API key field based on whether the selected provider requires one.
 */
function updateKeyFieldVisibility() {
  const provider = providerSelect.value;
  if (PROVIDERS_REQUIRING_KEYS.includes(provider)) {
    keyGroup.classList.remove('hidden');
    if (provider === 'llm') {
      keyHelp.textContent = 'Enter your OpenAI, Anthropic, or custom LLM API key. Stored securely in your browser.';
    } else {
      keyHelp.textContent = 'Your key is stored securely in your browser and is only sent to the translation provider.';
    }
  } else {
    keyGroup.classList.add('hidden');
  }
}

/**
 * Loads the saved settings from chrome.storage.local when the page opens.
 */
async function loadSettings() {
  const result = await browser.storage.local.get(['provider', 'apiKey']);
  
  if (result.provider) {
    providerSelect.value = result.provider as string;
  }
  if (result.apiKey) {
    apiKeyInput.value = result.apiKey as string;
  }
  
  updateKeyFieldVisibility();
}

/**
 * Saves the current settings to chrome.storage.local.
 */
async function saveSettings() {
  const provider = providerSelect.value;
  let apiKey = apiKeyInput.value;
  
  // If the provider doesn't require a key, we clear out any existing key
  // to avoid keeping stale credentials around.
  if (!PROVIDERS_REQUIRING_KEYS.includes(provider)) {
    apiKey = '';
    apiKeyInput.value = '';
  }

  await browser.storage.local.set({ provider, apiKey });
  
  // Show a success message briefly
  statusMsg.style.display = 'block';
  setTimeout(() => {
    statusMsg.style.display = 'none';
  }, 2000);
}

// Event Listeners
providerSelect.addEventListener('change', updateKeyFieldVisibility);
saveBtn.addEventListener('click', saveSettings);
document.addEventListener('DOMContentLoaded', loadSettings);

import browser from 'webextension-polyfill';

document.getElementById('optionsBtn')?.addEventListener('click', () => {
  // Opens the extension's options page in a new tab
  browser.runtime.openOptionsPage();
});

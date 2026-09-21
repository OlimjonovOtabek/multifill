// Simple built-in translator using Google Translate free endpoint
async function translateText(text: string, sourceLang: string, targetLang: string): Promise<string> {
  let tl = targetLang.split('-')[0]; // simplify uz-Latn to uz for google translate
  if (tl === 'kaa') {
    tl = 'uz'; // Fallback for Karakalpak since Google Translate doesn't support it
  }
  const sl = sourceLang.split('-')[0];
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  const data = await response.json();
  return data[0].map((item: any) => item[0]).join('');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    const { text, sourceLang, targetLangs } = request;
    
    Promise.all(targetLangs.map(async (lang: string) => {
      try {
        const translated = await translateText(text, sourceLang, lang);
        return { lang, ok: true, text: translated };
      } catch (err: any) {
        return { lang, ok: false, error: err.message };
      }
    })).then(outcomes => {
      sendResponse({ outcomes });
    });
    
    return true; // Keep the message channel open for async response
  }
});

console.log('Multifill background service worker loaded with translate handler');

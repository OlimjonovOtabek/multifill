async function translateWithGoogle(text: string, sourceLang: string, targetLang: string): Promise<string> {
  let tl = targetLang.split('-')[0];
  if (tl === 'kaa') {
    tl = 'uz'; // Fallback for Karakalpak
  }
  const sl = sourceLang.split('-')[0];
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url);
  const data = await response.json();
  return data[0].map((item: any) => item[0]).join('');
}

async function translateWithFromTo(text: string, sourceLang: string, targetLang: string, apiKey: string): Promise<string> {
  const mapLang = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.startsWith('uz')) return t.includes('cyrl') ? 'uzn_Cyrl' : 'uzn_Latn';
    if (t.startsWith('kaa')) return t.includes('cyrl') ? 'kaa_Cyrl' : 'kaa_Latn';
    if (t.startsWith('en')) return 'eng_Latn';
    if (t.startsWith('ru')) return 'rus_Cyrl';
    return tag;
  };
  
  const response = await fetch('https://api.from-to.uz/api/v1/external/translate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      body: {
        lang_from: mapLang(sourceLang),
        lang_to: mapLang(targetLang),
        text: text
      }
    })
  });
  
  const data = await response.json();
  if (data.error) throw new Error(`from-to.uz error: ${data.error}`);
  if (!data.result) throw new Error('Empty result from from-to.uz API');
  return data.result;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    const { text, sourceLang, targetLangs } = request;
    
    chrome.storage.local.get(['provider', 'apiKey'], (settings) => {
      const provider = settings.provider || 'builtin';
      const apiKey = settings.apiKey || '';
      
      Promise.all(targetLangs.map(async (lang: string) => {
        try {
          let translated: string;
          if (provider === 'from-to') {
            if (!apiKey) throw new Error('API key is required for from-to.uz');
            translated = await translateWithFromTo(text, sourceLang, lang, apiKey);
          } else {
            // Default builtin Google Translate
            translated = await translateWithGoogle(text, sourceLang, lang);
          }
          return { lang, ok: true, text: translated };
        } catch (err: any) {
          return { lang, ok: false, error: err.message };
        }
      })).then(outcomes => {
        sendResponse({ outcomes });
      });
    });
    
    return true; // Keep the message channel open for async response
  }
});

console.log('Multifill background service worker loaded with translate handler');

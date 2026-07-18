const API_KEY_STORAGE = 'kids_coloring_openai_key';

export function hasAICapability() {
  return Boolean(localStorage.getItem(API_KEY_STORAGE));
}

export async function convertWithAI(imageBlob) {
  const apiKey = localStorage.getItem(API_KEY_STORAGE);
  if (!apiKey) return null;

  try {
    const formData = new FormData();
    formData.append('image', imageBlob);
    formData.append('prompt',
      'Convert this photo into a simple, clean line art drawing suitable for a toddler coloring book. ' +
      'Use only black lines on a white background. Simplify details but preserve the main shape, ' +
      'eyes, nose, and mouth if present. Make lines thick and clear.');
    formData.append('model', 'gpt-image-1');
    formData.append('size', '1024x1024');

    const resp = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.data?.[0]?.url) return null;

    const imgResp = await fetch(data.data[0].url);
    return imgResp.blob();
  } catch {
    return null;
  }
}

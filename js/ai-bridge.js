const AI_SERVER_URL = 'https://biotechnology-entity-ethernet-home.trycloudflare.com';

export function hasAICapability() {
  return true;
}

export async function convertWithAI(imageBlob) {
  try {
    const formData = new FormData();
    formData.append('file', imageBlob, 'photo.jpg');

    const resp = await fetch(`${AI_SERVER_URL}/api/lineart`, {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) return null;

    return await resp.blob();
  } catch {
    return null;
  }
}

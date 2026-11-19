function bytes(base64) {
  return Uint8Array.from(atob(base64), character => character.charCodeAt(0));
}

export function passwordKey(password) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
}

/** Fetch and decrypt the complete content bundle. The password stays in this browser. */
export async function unlockPayload(password, url = './payload.enc.json') {
  if (!globalThis.crypto?.subtle) throw new Error('この環境では暗号化機能を利用できません。');
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('教材を読み込めませんでした。');
  const payload = await response.json();
  if (payload.version !== 1 || payload.kdf !== 'PBKDF2-SHA-256' || payload.cipher !== 'AES-256-GCM' || !Number.isSafeInteger(payload.iterations) || payload.iterations < 1 || payload.iterations > 2000000) {
    throw new Error('教材の形式に対応していません。');
  }
  const material = typeof password === 'string' ? await passwordKey(password) : password;
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(payload.salt), iterations: payload.iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(payload.iv) }, key, bytes(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

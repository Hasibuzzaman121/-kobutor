/**
 * Web Crypto API End-to-End Encryption (E2EE) Module
 * Implements ECDH (Elliptic Curve Diffie-Hellman P-256) for key agreement
 * and AES-GCM (256-bit) for authenticated message and file encryption.
 */

// Convert ArrayBuffer to Base64
export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 to ArrayBuffer
export function base64ToBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate a persistent ECDH P-256 identity key pair for the user
 */
export async function generateIdentityKeyPair() {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true, // extractable
    ['deriveKey', 'deriveBits']
  );
  return keyPair;
}

/**
 * Export public key to JWK JSON string for server sharing
 */
export async function exportPublicKey(cryptoKey) {
  const jwk = await window.crypto.subtle.exportKey('jwk', cryptoKey);
  return JSON.stringify(jwk);
}

/**
 * Export private key to JWK JSON string for local browser storage
 */
export async function exportPrivateKey(cryptoKey) {
  const jwk = await window.crypto.subtle.exportKey('jwk', cryptoKey);
  return JSON.stringify(jwk);
}

/**
 * Import public key from JWK JSON string
 */
export async function importPublicKey(jwkString) {
  const jwk = typeof jwkString === 'string' ? JSON.parse(jwkString) : jwkString;
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    []
  );
}

/**
 * Import private key from JWK JSON string
 */
export async function importPrivateKey(jwkString) {
  const jwk = typeof jwkString === 'string' ? JSON.parse(jwkString) : jwkString;
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256'
    },
    true,
    ['deriveKey', 'deriveBits']
  );
}

/**
 * Derive shared symmetric AES-GCM 256-bit key from own private key & peer public key
 */
export async function deriveSharedKey(myPrivateKey, peerPublicKey) {
  return await window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: peerPublicKey
    },
    myPrivateKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false, // derived key cannot be extracted
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt UTF-8 text message using AES-GCM (256-bit)
 * Returns { ciphertext: base64, iv: base64 }
 */
export async function encryptMessage(text, sharedKey) {
  const enc = new TextEncoder();
  const encoded = enc.encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for GCM

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    sharedKey,
    encoded
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypt UTF-8 text message using AES-GCM (256-bit)
 */
export async function decryptMessage(ciphertextBase64, ivBase64, sharedKey) {
  try {
    const ciphertext = base64ToBuffer(ciphertextBase64);
    const iv = base64ToBuffer(ivBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv)
      },
      sharedKey,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed:', err);
    return '[Decryption failed: Key mismatch or invalid ciphertext]';
  }
}

/**
 * Encrypt a binary file (ArrayBuffer) with AES-GCM
 * Returns { encryptedBlob: Blob, iv: string }
 */
export async function encryptFile(arrayBuffer, sharedKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    sharedKey,
    arrayBuffer
  );

  return {
    encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypt a binary file (ArrayBuffer) with AES-GCM
 * Returns decrypted ArrayBuffer
 */
export async function decryptFile(encryptedBuffer, ivBase64, sharedKey) {
  const iv = base64ToBuffer(ivBase64);
  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv)
    },
    sharedKey,
    encryptedBuffer
  );
  return decrypted;
}

/**
 * Generate visual safety fingerprint (like Telegram & Signal)
 * Produces 4 emojis and a 16-digit safety code from SHA-256 hash of the two public keys.
 */
export async function computeSafetyFingerprint(pubKeyAJson, pubKeyBJson) {
  const strA = typeof pubKeyAJson === 'string' ? pubKeyAJson : JSON.stringify(pubKeyAJson);
  const strB = typeof pubKeyBJson === 'string' ? pubKeyBJson : JSON.stringify(pubKeyBJson);
  
  // Sort deterministically so both sides get the exact same fingerprint
  const combined = [strA, strB].sort().join('::');
  const enc = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', enc.encode(combined));
  const hashBytes = new Uint8Array(hashBuffer);

  // Emoji pool
  const emojiPool = ['🦊', '🦉', '💎', '🔑', '🚀', '⚡', '🛡️', '🌟', '🍀', '🐬', '🪐', '🔥', '🎯', '⚓', '🔮', '🎈'];
  const emojis = [
    emojiPool[hashBytes[0] % emojiPool.length],
    emojiPool[hashBytes[1] % emojiPool.length],
    emojiPool[hashBytes[2] % emojiPool.length],
    emojiPool[hashBytes[3] % emojiPool.length]
  ].join(' ');

  // 16-digit safety number
  const num1 = ((hashBytes[4] << 8) | hashBytes[5]) % 10000;
  const num2 = ((hashBytes[6] << 8) | hashBytes[7]) % 10000;
  const num3 = ((hashBytes[8] << 8) | hashBytes[9]) % 10000;
  const num4 = ((hashBytes[10] << 8) | hashBytes[11]) % 10000;

  const code = [
    String(num1).padStart(4, '0'),
    String(num2).padStart(4, '0'),
    String(num3).padStart(4, '0'),
    String(num4).padStart(4, '0')
  ].join(' ');

  return { emojis, code };
}

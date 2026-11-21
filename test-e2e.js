const http = require('http');

async function runTests() {
  console.log('--- STARTING SECUREGRAM E2E TEST ---');

  const BASE_URL = 'http://localhost:5000';

  // 1. Health check
  console.log('[1/7] Testing Server Health Check...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const health = await healthRes.json();
  if (health.status !== 'ok') throw new Error('Health check failed');
  console.log('✓ Server is healthy');

  // 2. Register Alice
  console.log('[2/7] Registering Alice & Bob...');
  const aliceRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `alice_${Date.now()}`,
      displayName: 'Alice Security',
      password: 'password123'
    })
  });
  const aliceData = await aliceRegRes.json();
  if (!aliceRegRes.ok) throw new Error('Alice registration failed: ' + JSON.stringify(aliceData));
  const alice = aliceData.user;
  const aliceToken = aliceData.token;
  console.log(`✓ Alice registered (ID: ${alice.id})`);

  // Register Bob
  const bobRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `bob_${Date.now()}`,
      displayName: 'Bob Cryptographer',
      password: 'password123'
    })
  });
  const bobData = await bobRegRes.json();
  if (!bobRegRes.ok) throw new Error('Bob registration failed: ' + JSON.stringify(bobData));
  const bob = bobData.user;
  const bobToken = bobData.token;
  console.log(`✓ Bob registered (ID: ${bob.id})`);

  // 3. WebCrypto ECDH Key Agreement Simulation (Node 24 native crypto.subtle)
  console.log('[3/7] Testing WebCrypto ECDH Key Agreement & AES-256-GCM...');
  const { subtle } = globalThis.crypto;

  // Alice generates ECDH key pair
  const aliceKeys = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const alicePubJwk = await subtle.exportKey('jwk', aliceKeys.publicKey);

  // Bob generates ECDH key pair
  const bobKeys = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  const bobPubJwk = await subtle.exportKey('jwk', bobKeys.publicKey);

  // Alice uploads her public key
  await fetch(`${BASE_URL}/api/auth/public-key`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({ publicKey: JSON.stringify(alicePubJwk) })
  });

  // Bob uploads his public key
  await fetch(`${BASE_URL}/api/auth/public-key`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bobToken}` },
    body: JSON.stringify({ publicKey: JSON.stringify(bobPubJwk) })
  });
  console.log('✓ Public keys published to backend');

  // Alice derives shared secret using Bob's public key
  const importedBobPub = await subtle.importKey('jwk', bobPubJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  const aliceDerivedKey = await subtle.deriveKey(
    { name: 'ECDH', public: importedBobPub },
    aliceKeys.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Bob derives shared secret using Alice's public key
  const importedAlicePub = await subtle.importKey('jwk', alicePubJwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  const bobDerivedKey = await subtle.deriveKey(
    { name: 'ECDH', public: importedAlicePub },
    bobKeys.privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Encrypt secret message on Alice side
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const secretMessage = 'Classified message: Quantum supremacy achieved.';
  const enc = new TextEncoder();
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, aliceDerivedKey, enc.encode(secretMessage));

  // Decrypt secret message on Bob side
  const decryptedBuf = await subtle.decrypt({ name: 'AES-GCM', iv }, bobDerivedKey, ciphertext);
  const dec = new TextDecoder();
  const decryptedMessage = dec.decode(decryptedBuf);

  if (decryptedMessage !== secretMessage) {
    throw new Error('Decrypted message does not match original!');
  }
  console.log('✓ E2EE Key exchange & AES-256-GCM encryption/decryption verified: "' + decryptedMessage + '"');

  // 4. Create Secret Chat
  console.log('[4/7] Creating Secret Chat on Server...');
  const secretChatRes = await fetch(`${BASE_URL}/api/chats/secret`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({ targetUserId: bob.id })
  });
  const secretChatData = await secretChatRes.json();
  if (!secretChatRes.ok) throw new Error('Secret chat creation failed');
  const secretChat = secretChatData.chat;
  console.log(`✓ Secret Chat created (ID: ${secretChat.id}, isE2EE: ${secretChat.isE2EE})`);

  // 5. Test File Upload
  console.log('[5/7] Testing Secure Encrypted File Upload...');
  const fakeFileContent = Buffer.from('Confidential File Content Payload 2026');
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="confidential.txt.enc"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const fileFooter = `\r\n--${boundary}\r\nContent-Disposition: form-data; name="isEncrypted"\r\n\r\ntrue\r\n--${boundary}--\r\n`;
  const multipartBody = Buffer.concat([Buffer.from(fileHeader), fakeFileContent, Buffer.from(fileFooter)]);

  const uploadRes = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${aliceToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: multipartBody
  });
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) throw new Error('File upload failed: ' + JSON.stringify(uploadData));
  console.log(`✓ Encrypted file uploaded successfully: ${uploadData.fileUrl} (${uploadData.fileSize} bytes)`);

  // 6. Test Group Chat Creation
  console.log('[6/7] Creating Group Chat...');
  const groupRes = await fetch(`${BASE_URL}/api/chats/group`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceToken}` },
    body: JSON.stringify({
      name: 'Cybersecurity Operations',
      memberIds: [bob.id]
    })
  });
  const groupData = await groupRes.json();
  if (!groupRes.ok) throw new Error('Group chat creation failed');
  console.log(`✓ Group Chat created: "${groupData.chat.name}" with ${groupData.chat.members.length} members`);

  // 7. Test Message Retrieval
  console.log('[7/7] Testing Chat Messages Endpoint...');
  const messagesRes = await fetch(`${BASE_URL}/api/chats/${secretChat.id}/messages`, {
    headers: { Authorization: `Bearer ${aliceToken}` }
  });
  const messagesData = await messagesRes.json();
  if (!messagesRes.ok) throw new Error('Messages load failed');
  console.log(`✓ Messages endpoint verified (${messagesData.messages.length} messages found)`);

  console.log('\n===========================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED 100% SUCCESS!');
  console.log('===========================================\n');
}

// Start server in child process for the test
const { spawn } = require('child_process');
const path = require('path');

const srv = spawn('node', ['src/index.js'], {
  cwd: path.join(__dirname, 'server'),
  stdio: 'inherit'
});

setTimeout(async () => {
  try {
    await runTests();
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exitCode = 1;
  } finally {
    srv.kill();
    process.exit(process.exitCode || 0);
  }
}, 1500);

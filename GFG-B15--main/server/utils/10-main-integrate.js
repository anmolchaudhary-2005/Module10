/**
 * 10-main-integrate
 *
 * Encrypted & Randomized Embedding for images:
 * - Encrypt message using existing AES helper (stegoUtils.encryptMessage)
 * - Build a small header: magic + flags + payloadLen + checksum
 * - Use a pseudo-random pixel selection strategy seeded by the password
 * - Prefer "safe" textured pixels (ML mask) to reduce detectability
 *
 * Decoder:
 * - Recompute the same safe-pixel set + PRNG stream from the encoded image + password
 * - Read header, then payload bytes
 * - Validate checksum, decrypt (and decompress if flagged)
 */

import crypto from 'crypto';
import zlib from 'zlib';
import Jimp from 'jimp';
import { encryptMessage, decryptMessage, END_DELIMITER_BITS } from './stegoUtils.js';
import { getSafeEmbeddingMask } from './mlCnnUtils.js';

const MAGIC = Buffer.from('RSE1'); // 4 bytes
const VERSION = 1;

// header = magic(4) + ver(1) + flags(1) + payloadLen(4) + checksum(4) = 14 bytes
const HEADER_LEN = 14;
const FLAG_ENCRYPTED = 1 << 0;
const FLAG_COMPRESSED = 1 << 1;

function sha256_4(buf) {
  const d = crypto.createHash('sha256').update(buf).digest();
  return d.subarray(0, 4);
}

function bytesToBits(buf) {
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    out += buf[i].toString(2).padStart(8, '0');
  }
  return out;
}

function bitsToBytes(bitString) {
  const bytes = [];
  for (let i = 0; i + 8 <= bitString.length; i += 8) {
    bytes.push(parseInt(bitString.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function makePrng(password) {
  const key = crypto.createHash('sha256').update(String(password), 'utf8').digest(); // 32 bytes
  let counter = 0;
  return () => {
    const h = crypto.createHmac('sha256', key).update(Buffer.from(String(counter++), 'utf8')).digest();
    return h.readUInt32LE(0);
  };
}

function pickUniqueIndex(nextU32, n, used) {
  // used: Uint8Array bitset (n bits)
  const get = (i) => (used[i >> 3] >> (i & 7)) & 1;
  const set = (i) => {
    used[i >> 3] |= 1 << (i & 7);
  };

  let idx = nextU32() % n;
  // simple linear probe to avoid infinite loops when collisions happen
  for (let attempts = 0; attempts < 32; attempts++) {
    if (!get(idx)) {
      set(idx);
      return idx;
    }
    idx = (idx + 1) % n;
  }
  // fallback: scan
  for (let i = 0; i < n; i++) {
    if (!get(i)) {
      set(i);
      return i;
    }
  }
  throw new Error('No available pixels left for randomized embedding');
}

async function getSafePixelIndices(imageBuffer, safePercentile = 0.65) {
  const { width, height, safeMask, safeRatio, riskScore } = await getSafeEmbeddingMask(imageBuffer, { safePercentile });
  const safe = [];
  for (let i = 0; i < safeMask.length; i++) {
    if (safeMask[i] === 1) safe.push(i);
  }
  return { width, height, safe, safeRatio, riskScore };
}

function buildHeader(flags, payloadLen, payloadBytes) {
  const header = Buffer.alloc(HEADER_LEN);
  MAGIC.copy(header, 0);
  header.writeUInt8(VERSION, 4);
  header.writeUInt8(flags, 5);
  header.writeUInt32LE(payloadLen, 6);
  sha256_4(payloadBytes).copy(header, 10);
  return header;
}

function parseHeader(headerBytes) {
  if (headerBytes.length < HEADER_LEN) throw new Error('Invalid header length');
  const magic = headerBytes.subarray(0, 4);
  if (!magic.equals(MAGIC)) throw new Error('Invalid payload (missing magic header)');
  const version = headerBytes.readUInt8(4);
  if (version !== VERSION) throw new Error('Unsupported version');
  const flags = headerBytes.readUInt8(5);
  const payloadLen = headerBytes.readUInt32LE(6);
  const checksum = headerBytes.subarray(10, 14);
  return { version, flags, payloadLen, checksum };
}

export async function encodeSecureRandomImage(imageBuffer, message, password, opts = {}) {
  if (!password) throw new Error('Secure mode requires a password (used as encryption + pixel-selection key).');

  const compress = opts.compress === true;
  const safePercentile = typeof opts.safePercentile === 'number' ? opts.safePercentile : 0.65;

  // 1) payload bytes (optionally compressed) then encrypted string bytes
  let plainBytes = Buffer.from(String(message), 'utf8');
  let flags = FLAG_ENCRYPTED;

  if (compress) {
    plainBytes = zlib.deflateRawSync(plainBytes);
    flags |= FLAG_COMPRESSED;
  }

  const encryptedText = encryptMessage(plainBytes.toString('base64'), password); // encrypt base64 of (maybe compressed) bytes
  const payloadBytes = Buffer.from(encryptedText, 'utf8');

  // 2) header + payload bits
  const header = buildHeader(flags, payloadBytes.length, payloadBytes);
  const bits = bytesToBits(Buffer.concat([header, payloadBytes]));

  // 3) pick safe pixels + capacity validation
  const img = await Jimp.read(imageBuffer);
  const { width, height } = img.bitmap;
  const { safe, safeRatio, riskScore } = await getSafePixelIndices(imageBuffer, safePercentile);

  const capacityBits = safe.length * 3; // RGB LSB in selected pixels
  const usableBits = Math.max(0, capacityBits - END_DELIMITER_BITS);
  if (bits.length > capacityBits) {
    throw new Error(`Payload too large for secure embedding. Capacity: ${Math.floor(usableBits / 8)} chars (${usableBits} bits).`);
  }

  // 4) randomized embedding across safe pixels
  const nextU32 = makePrng(password);
  const used = new Uint8Array(Math.ceil(safe.length / 8));

  let bitIndex = 0;
  while (bitIndex < bits.length) {
    const safePosIdx = pickUniqueIndex(nextU32, safe.length, used);
    const pixelIndex = safe[safePosIdx]; // 0..(w*h-1)
    const x = pixelIndex % width;
    const y = (pixelIndex - x) / width;
    const idx = (width * y + x) << 2;

    // R, G, B
    if (bitIndex < bits.length) img.bitmap.data[idx] = (img.bitmap.data[idx] & 254) | (bits[bitIndex++] === '1' ? 1 : 0);
    if (bitIndex < bits.length) img.bitmap.data[idx + 1] = (img.bitmap.data[idx + 1] & 254) | (bits[bitIndex++] === '1' ? 1 : 0);
    if (bitIndex < bits.length) img.bitmap.data[idx + 2] = (img.bitmap.data[idx + 2] & 254) | (bits[bitIndex++] === '1' ? 1 : 0);
  }

  const encodedBuffer = await img.getBufferAsync(Jimp.MIME_PNG);
  return {
    encodedBuffer,
    embeddingModeKey: 'secure',
    embeddingMode: '10-main-integrate: Encrypted & Randomized Embedding (ML-enhanced secure embedding)',
    riskScore,
    safeRatio,
    capacityChars: Math.floor(usableBits / 8),
  };
}

export async function decodeSecureRandomImage(imageBuffer, password, opts = {}) {
  if (!password) throw new Error('Secure mode requires a password.');

  const safePercentile = typeof opts.safePercentile === 'number' ? opts.safePercentile : 0.65;

  const img = await Jimp.read(imageBuffer);
  const { width, height } = img.bitmap;
  const { safe } = await getSafePixelIndices(imageBuffer, safePercentile);

  const nextU32 = makePrng(password);
  const used = new Uint8Array(Math.ceil(safe.length / 8));

  const readBits = (count) => {
    let out = '';
    while (out.length < count) {
      const safePosIdx = pickUniqueIndex(nextU32, safe.length, used);
      const pixelIndex = safe[safePosIdx];
      const x = pixelIndex % width;
      const y = (pixelIndex - x) / width;
      const idx = (width * y + x) << 2;

      if (out.length < count) out += (img.bitmap.data[idx] & 1).toString();
      if (out.length < count) out += (img.bitmap.data[idx + 1] & 1).toString();
      if (out.length < count) out += (img.bitmap.data[idx + 2] & 1).toString();
    }
    return out;
  };

  const headerBits = readBits(HEADER_LEN * 8);
  const headerBytes = bitsToBytes(headerBits).subarray(0, HEADER_LEN);
  const { flags, payloadLen, checksum } = parseHeader(headerBytes);

  const payloadBits = readBits(payloadLen * 8);
  const payloadBytes = bitsToBytes(payloadBits).subarray(0, payloadLen);

  const actual = sha256_4(payloadBytes);
  if (!actual.equals(checksum)) throw new Error('Checksum mismatch (wrong password or corrupted data).');

  let encryptedText = payloadBytes.toString('utf8');
  if (!(flags & FLAG_ENCRYPTED)) throw new Error('Unexpected payload (not encrypted).');

  const decryptedBase64 = decryptMessage(encryptedText, password); // returns base64 string
  let plainBytes = Buffer.from(decryptedBase64, 'base64');
  if (flags & FLAG_COMPRESSED) {
    plainBytes = zlib.inflateRawSync(plainBytes);
  }
  return plainBytes.toString('utf8');
}


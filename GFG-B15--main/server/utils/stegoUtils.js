/**
 * Steganography Utility Functions
 * LSB (Least Significant Bit) steganography with optional AES encryption
 */

import Jimp from 'jimp';
import crypto from 'crypto';

// End delimiter in binary: 1111111111111110 (16 bits) - signals end of message
export const END_DELIMITER = '1111111111111110';
export const END_DELIMITER_BITS = END_DELIMITER.length;

// AES encryption configuration
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const SALT_LENGTH = 64;

/**
 * Convert text to binary string (UTF-8 encoding)
 * @param {string} text - Text to convert
 * @returns {string} Binary representation
 */
export function textToBinary(text) {
  return text
    .split('')
    .map((char) => char.charCodeAt(0).toString(2).padStart(8, '0'))
    .join('');
}

/**
 * Convert binary string to text
 * @param {string} binary - Binary string
 * @returns {string} Decoded text
 */
export function binaryToText(binary) {
  const bytes = binary.match(/.{1,8}/g) || [];
  return bytes
    .map((byte) => String.fromCharCode(parseInt(byte, 2)))
    .join('');
}

/**
 * Encrypt message with password using AES-256-CBC
 * @param {string} message - Plain text message
 * @param {string} password - User password
 * @returns {string} Encrypted base64 string (iv:salt:encrypted)
 */
export function encryptMessage(message, password) {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.scryptSync(password, salt, KEY_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(message, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return `${iv.toString('base64')}:${salt.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt message with password
 * @param {string} encryptedData - Encrypted string (iv:salt:encrypted)
 * @param {string} password - User password
 * @returns {string} Decrypted plain text
 */
export function decryptMessage(encryptedData, password) {
  const [ivBase64, saltBase64, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivBase64, 'base64');
  const salt = Buffer.from(saltBase64, 'base64');
  const key = crypto.scryptSync(password, salt, KEY_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Get message bits for embedding (with optional encryption and delimiter)
 * @param {string} message - Secret message
 * @param {string|null} password - Optional password for encryption
 * @returns {string} Full binary string to embed
 */
export function getMessageBits(message, password = null) {
  let dataToEmbed = message;
  if (password) {
    dataToEmbed = encryptMessage(message, password);
  }
  return textToBinary(dataToEmbed) + END_DELIMITER;
}

/**
 * Extract and decode message bits
 * @param {string} binary - Extracted binary string
 * @param {string|null} password - Optional password for decryption
 * @returns {string} Decoded message
 */
export function decodeMessageBits(binary, password = null) {
  const delimiterIndex = binary.indexOf(END_DELIMITER);
  if (delimiterIndex === -1) return '';

  const messageBinary = binary.substring(0, delimiterIndex);
  const text = binaryToText(messageBinary);

  if (password) {
    try {
      return decryptMessage(text, password);
    } catch (err) {
      throw new Error('Wrong password or corrupted encrypted data');
    }
  }
  return text;
}

/**
 * Calculate maximum message capacity (in bits) for an image
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} bitsPerPixel - LSB bits used per pixel (default 3 for RGB)
 * @returns {number} Max bits (excluding delimiter)
 */
export function calculateCapacity(width, height, bitsPerPixel = 3) {
  const totalPixels = width * height;
  return totalPixels * bitsPerPixel;
}

/**
 * Calculate PSNR (Peak Signal-to-Noise Ratio) between original and encoded images
 * @param {Buffer} originalBuffer - Original image buffer
 * @param {Buffer} encodedBuffer - Encoded image buffer
 * @returns {Promise<number>} PSNR value in dB
 */
export async function calculatePSNR(originalBuffer, encodedBuffer) {
  const original = await Jimp.read(originalBuffer);
  const encoded = await Jimp.read(encodedBuffer);

  const width = original.bitmap.width;
  const height = original.bitmap.height;

  if (width !== encoded.bitmap.width || height !== encoded.bitmap.height) {
    throw new Error('Image dimensions must match for PSNR calculation');
  }

  let mse = 0;
  const totalPixels = width * height * 3; // RGB channels

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const rDiff = original.bitmap.data[idx] - encoded.bitmap.data[idx];
      const gDiff = original.bitmap.data[idx + 1] - encoded.bitmap.data[idx + 1];
      const bDiff = original.bitmap.data[idx + 2] - encoded.bitmap.data[idx + 2];
      mse += rDiff * rDiff + gDiff * gDiff + bDiff * bDiff;
    }
  }

  mse /= totalPixels;
  if (mse === 0) return Infinity; // Identical images

  const maxPixelValue = 255;
  const psnr = 10 * Math.log10((maxPixelValue * maxPixelValue) / mse);
  return Math.round(psnr * 100) / 100; // Round to 2 decimal places
}

/**
 * Embed message into image using LSB steganography
 * @param {Buffer} imageBuffer - Original image
 * @param {string} messageBits - Binary string to embed
 * @param {{ safeMask?: Uint8Array, safeMaskWidth?: number, safeMaskHeight?: number }} [opts]
 * @returns {Promise<{image: Jimp, buffer: Buffer}>} Encoded image
 */
export async function embedMessage(imageBuffer, messageBits, opts = {}) {
  const image = await Jimp.read(imageBuffer);
  const { width, height } = image.bitmap;

  let bitIndex = 0;
  const totalBits = messageBits.length;

  const safeMask = opts.safeMask;
  const safeW = opts.safeMaskWidth ?? width;
  const safeH = opts.safeMaskHeight ?? height;

  for (let y = 0; y < height && bitIndex < totalBits; y++) {
    for (let x = 0; x < width && bitIndex < totalBits; x++) {
      if (safeMask) {
        // If mask dimensions mismatch, fall back to allow embedding.
        if (safeW === width && safeH === height) {
          if (safeMask[y * width + x] !== 1) continue;
        }
      }
      const idx = (width * y + x) << 2;

      // Embed in R channel
      if (bitIndex < totalBits) {
        const r = image.bitmap.data[idx];
        image.bitmap.data[idx] = (r & 254) | parseInt(messageBits[bitIndex], 2);
        bitIndex++;
      }
      // Embed in G channel
      if (bitIndex < totalBits) {
        const g = image.bitmap.data[idx + 1];
        image.bitmap.data[idx + 1] = (g & 254) | parseInt(messageBits[bitIndex], 2);
        bitIndex++;
      }
      // Embed in B channel
      if (bitIndex < totalBits) {
        const b = image.bitmap.data[idx + 2];
        image.bitmap.data[idx + 2] = (b & 254) | parseInt(messageBits[bitIndex], 2);
        bitIndex++;
      }
    }
  }

  if (bitIndex < totalBits) {
    throw new Error('Not enough safe pixels to embed the full payload. Try disabling ML-enhanced mode or use a larger image.');
  }

  const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
  return { image, buffer };
}

/**
 * Extract LSB bits from image
 * @param {Buffer} imageBuffer - Image containing hidden message
 * @returns {string} Extracted binary string
 */
export async function extractMessage(imageBuffer) {
  const image = await Jimp.read(imageBuffer);
  const { width, height } = image.bitmap;

  let binary = '';
  const maxBits = width * height * 3; // Safety limit

  for (let y = 0; y < height && binary.length < maxBits; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      binary += (image.bitmap.data[idx] & 1).toString();
      binary += (image.bitmap.data[idx + 1] & 1).toString();
      binary += (image.bitmap.data[idx + 2] & 1).toString();

      // Check for delimiter (saves processing time)
      if (binary.endsWith(END_DELIMITER)) {
        return binary;
      }
    }
  }

  return binary;
}

/**
 * Extract LSB bits from image but only from pixels selected by a mask.
 * Masked pixels contribute 3 bits (RGB) in the same order used by `embedMessage`.
 *
 * @param {Buffer} imageBuffer
 * @param {Uint8Array} mask - length = width*height, 1 = use pixel
 * @returns {Promise<string>}
 */
export async function extractMessageMasked(imageBuffer, mask) {
  const image = await Jimp.read(imageBuffer);
  const { width, height } = image.bitmap;
  if (!mask || mask.length !== width * height) {
    // Fallback to standard extraction if mask invalid.
    return extractMessage(imageBuffer);
  }

  let binary = '';
  const maxBits = width * height * 3;

  for (let y = 0; y < height && binary.length < maxBits; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] !== 1) continue;
      const idx = (width * y + x) << 2;
      binary += (image.bitmap.data[idx] & 1).toString();
      binary += (image.bitmap.data[idx + 1] & 1).toString();
      binary += (image.bitmap.data[idx + 2] & 1).toString();
      if (binary.endsWith(END_DELIMITER)) return binary;
    }
  }

  return binary;
}

/**
 * Adaptive LSB (Smart Pixel Selection):
 * - For edge/texture pixels: embed/extract 3 bits (RGB)
 * - For smooth pixels: embed/extract 1 bit (B only)
 *
 * Decoder must use the same edge mask computed from the encoded image.
 */
export async function embedMessageAdaptive(imageBuffer, messageBits, edgeMask) {
  const image = await Jimp.read(imageBuffer);
  const { width, height } = image.bitmap;

  if (!edgeMask || edgeMask.length !== width * height) {
    throw new Error('Invalid edge mask for adaptive embedding');
  }

  let bitIndex = 0;
  const totalBits = messageBits.length;

  for (let y = 0; y < height && bitIndex < totalBits; y++) {
    for (let x = 0; x < width && bitIndex < totalBits; x++) {
      const i = y * width + x;
      const idx = i << 2;
      const isEdge = edgeMask[i] === 1;

      if (isEdge) {
        // RGB (3 bits)
        if (bitIndex < totalBits) {
          image.bitmap.data[idx] = (image.bitmap.data[idx] & 254) | (messageBits[bitIndex++] === '1' ? 1 : 0);
        }
        if (bitIndex < totalBits) {
          image.bitmap.data[idx + 1] = (image.bitmap.data[idx + 1] & 254) | (messageBits[bitIndex++] === '1' ? 1 : 0);
        }
        if (bitIndex < totalBits) {
          image.bitmap.data[idx + 2] = (image.bitmap.data[idx + 2] & 254) | (messageBits[bitIndex++] === '1' ? 1 : 0);
        }
      } else {
        // Smooth region: B only (1 bit)
        image.bitmap.data[idx + 2] = (image.bitmap.data[idx + 2] & 254) | (messageBits[bitIndex++] === '1' ? 1 : 0);
      }
    }
  }

  if (bitIndex < totalBits) {
    throw new Error('Not enough capacity for adaptive embedding. Use a larger image or shorter message.');
  }

  const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
  return { image, buffer };
}

export async function extractMessageAdaptive(imageBuffer, edgeMask) {
  const image = await Jimp.read(imageBuffer);
  const { width, height } = image.bitmap;
  if (!edgeMask || edgeMask.length !== width * height) {
    return extractMessage(imageBuffer);
  }

  let binary = '';
  // Worst case if everything edge => 3 bits per pixel
  const maxBits = width * height * 3;

  for (let y = 0; y < height && binary.length < maxBits; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const idx = i << 2;
      const isEdge = edgeMask[i] === 1;

      if (isEdge) {
        binary += (image.bitmap.data[idx] & 1).toString();
        binary += (image.bitmap.data[idx + 1] & 1).toString();
        binary += (image.bitmap.data[idx + 2] & 1).toString();
      } else {
        binary += (image.bitmap.data[idx + 2] & 1).toString();
      }

      if (binary.endsWith(END_DELIMITER)) return binary;
    }
  }

  return binary;
}

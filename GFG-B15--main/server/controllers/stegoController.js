/**
 * Steganography Controller
 * Handles encode, decode, and compress operations
 */

import path from 'path';
import fs from 'fs/promises';
import Jimp from 'jimp';
import {
  getMessageBits,
  decodeMessageBits,
  embedMessage,
  extractMessage,
  extractMessageMasked,
  embedMessageAdaptive,
  extractMessageAdaptive,
  calculatePSNR,
  calculateCapacity,
  END_DELIMITER,
  END_DELIMITER_BITS,
} from '../utils/stegoUtils.js';
import { getSafeEmbeddingMask } from '../utils/mlCnnUtils.js';
import { getCannyEdgeMask } from '../utils/cannyEdgeUtils.js';
import { encodeSecureRandomImage, decodeSecureRandomImage } from '../utils/10-main-integrate.js';
import {
  calculateWavCapacityBits,
  embedBitsInWav,
  extractBitsFromWav,
} from '../utils/audioStegoUtils.js';
import { embedMessageInPdf, extractMessageFromPdf } from '../utils/pdfStegoUtils.js';

const UPLOADS_DIR = './uploads';

/**
 * POST /encode
 * Encode secret message into a supported media file.
 * Supported:
 * - Images (PNG/JPEG): LSB in RGB, saved as PNG
 * - Audio (WAV PCM 16-bit): LSB in sample bytes, saved as WAV
 * - PDF: stored in metadata (Subject)
 */
export async function encode(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { message, password } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const inputBuffer = await fs.readFile(req.file.path);
    const mime = req.file.mimetype || '';
    const safePassword = password || null;

    const timestamp = Date.now();

    // IMAGE (PNG/JPEG) — LSB in RGB, output PNG
    if (mime.startsWith('image/')) {
      const messageBits = getMessageBits(message, safePassword);

      const image = await Jimp.read(inputBuffer);
      const capacityBits = calculateCapacity(image.bitmap.width, image.bitmap.height);
      const usableBitsStandard = Math.max(0, capacityBits - END_DELIMITER_BITS);

      const embeddingModeKey = (req.body?.embeddingMode || '').toLowerCase() || (req.body?.useMl === '1' ? 'ml' : 'standard');

      // SECURE (10-main-integrate): encrypted + randomized + header+checksum
      if (embeddingModeKey === 'secure') {
        try {
          const secure = await encodeSecureRandomImage(inputBuffer, message, safePassword, { compress: req.body?.compress === '1' });
          const originalBuffer = Buffer.from(inputBuffer);
          const psnr = await calculatePSNR(originalBuffer, secure.encodedBuffer);

          const encodedFilename = `encoded_${timestamp}.png`;
          const encodedFsPath = path.join(UPLOADS_DIR, encodedFilename);
          await fs.writeFile(encodedFsPath, secure.encodedBuffer);
          await fs.unlink(req.file.path).catch(() => {});

          return res.json({
            success: true,
            mediaType: 'image',
            mimeType: 'image/png',
            encodedPath: `/uploads/${encodedFilename}`,
            encodedFilename,
            psnr,
            capacity: secure.capacityChars,
            embeddingModeKey: secure.embeddingModeKey,
            embeddingMode: secure.embeddingMode,
            riskScore: secure.riskScore ?? null,
            safeRatio: secure.safeRatio ?? null,
          });
        } catch (e) {
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(400).json({ error: e.message || 'Secure encoding failed' });
        }
      }

      // Adaptive capacity depends on edge ratio
      if (embeddingModeKey === 'adaptive') {
        const edges = await getCannyEdgeMask(inputBuffer);
        let edgeCount = 0;
        for (let i = 0; i < edges.edgeMask.length; i++) edgeCount += edges.edgeMask[i];
        const smoothCount = edges.edgeMask.length - edgeCount;
        const adaptiveCapacityBits = edgeCount * 3 + smoothCount * 1;
        const usableBitsAdaptive = Math.max(0, adaptiveCapacityBits - END_DELIMITER_BITS);
        if (messageBits.length > adaptiveCapacityBits) {
          await fs.unlink(req.file.path).catch(() => {});
          return res.status(400).json({
            error: `Message too large. Max capacity: ${Math.floor(usableBitsAdaptive / 8)} characters (${usableBitsAdaptive} bits)`,
            maxCapacity: Math.floor(usableBitsAdaptive / 8),
          });
        }

        const originalBuffer = Buffer.from(inputBuffer);
        const { buffer: encodedBuffer } = await embedMessageAdaptive(inputBuffer, messageBits, edges.edgeMask);

        const encodedFilename = `encoded_${timestamp}.png`;
        const encodedFsPath = path.join(UPLOADS_DIR, encodedFilename);
        await fs.writeFile(encodedFsPath, encodedBuffer);

        const psnr = await calculatePSNR(originalBuffer, encodedBuffer);
        await fs.unlink(req.file.path).catch(() => {});

        return res.json({
          success: true,
          mediaType: 'image',
          mimeType: 'image/png',
          encodedPath: `/uploads/${encodedFilename}`,
          encodedFilename,
          psnr,
          capacity: Math.floor(usableBitsAdaptive / 8),
          embeddingModeKey: 'adaptive',
          embeddingMode: 'Adaptive LSB (Smart Pixel Selection - Canny edges)',
          riskScore: Math.round((1 - edges.edgeRatio) * 1000) / 1000,
          safeRatio: edges.edgeRatio,
        });
      }

      // Standard/ML: capacity in pixels*3
      if (messageBits.length > capacityBits) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: `Message too large. Max capacity: ${Math.floor(usableBitsStandard / 8)} characters (${usableBitsStandard} bits)`,
          maxCapacity: Math.floor(usableBitsStandard / 8),
        });
      }

      const originalBuffer = Buffer.from(inputBuffer);
      const useMl = embeddingModeKey === 'ml' || req.body?.useMl === '1' || req.body?.useMl === 'true';
      let ml = null;
      if (useMl) {
        ml = await getSafeEmbeddingMask(inputBuffer, { safePercentile: 0.65 });
      }
      const { buffer: encodedBuffer } = await embedMessage(inputBuffer, messageBits, ml ? { safeMask: ml.safeMask, safeMaskWidth: ml.width, safeMaskHeight: ml.height } : {});

      const encodedFilename = `encoded_${timestamp}.png`;
      const encodedFsPath = path.join(UPLOADS_DIR, encodedFilename);
      await fs.writeFile(encodedFsPath, encodedBuffer);

      const psnr = await calculatePSNR(originalBuffer, encodedBuffer);

      await fs.unlink(req.file.path).catch(() => {});

      return res.json({
        success: true,
        mediaType: 'image',
        mimeType: 'image/png',
        encodedPath: `/uploads/${encodedFilename}`,
        encodedFilename,
        psnr,
        capacity: Math.floor(usableBitsStandard / 8),
        embeddingModeKey: useMl ? 'ml' : 'standard',
        embeddingMode: useMl ? 'ML-enhanced secure embedding' : 'standard',
        riskScore: ml?.riskScore ?? null,
        safeRatio: ml?.safeRatio ?? null,
      });
    }

    // AUDIO (WAV) — LSB in sample bytes, output WAV
    if (mime === 'audio/wav' || mime === 'audio/x-wav') {
      const messageBits = getMessageBits(message, safePassword);
      const capacityBits = calculateWavCapacityBits(inputBuffer);
      const usableBits = Math.max(0, capacityBits - END_DELIMITER_BITS);
      if (messageBits.length > capacityBits) {
        await fs.unlink(req.file.path).catch(() => {});
        return res.status(400).json({
          error: `Message too large. Max capacity: ${Math.floor(usableBits / 8)} characters (${usableBits} bits)`,
          maxCapacity: Math.floor(usableBits / 8),
        });
      }

      const encodedBuffer = embedBitsInWav(inputBuffer, messageBits);
      const encodedFilename = `encoded_${timestamp}.wav`;
      const encodedFsPath = path.join(UPLOADS_DIR, encodedFilename);
      await fs.writeFile(encodedFsPath, encodedBuffer);

      await fs.unlink(req.file.path).catch(() => {});

      return res.json({
        success: true,
        mediaType: 'audio',
        mimeType: 'audio/wav',
        encodedPath: `/uploads/${encodedFilename}`,
        encodedFilename,
        psnr: null,
        capacity: Math.floor(usableBits / 8),
      });
    }

    // PDF — metadata embedding, output PDF
    if (mime === 'application/pdf') {
      const encodedBuffer = await embedMessageInPdf(inputBuffer, message, safePassword);
      const encodedFilename = `encoded_${timestamp}.pdf`;
      const encodedFsPath = path.join(UPLOADS_DIR, encodedFilename);
      await fs.writeFile(encodedFsPath, encodedBuffer);

      await fs.unlink(req.file.path).catch(() => {});

      return res.json({
        success: true,
        mediaType: 'pdf',
        mimeType: 'application/pdf',
        encodedPath: `/uploads/${encodedFilename}`,
        encodedFilename,
        psnr: null,
        capacity: null,
      });
    }

    await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({
      error: `Unsupported file type: ${mime}. Supported: PNG/JPEG, WAV, PDF.`,
    });
  } catch (err) {
    console.error('Encode error:', err);
    res.status(500).json({ error: err.message || 'Encoding failed' });
  }
}

/**
 * POST /decode
 * Extract hidden message from a supported media file.
 */
export async function decode(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { password, embeddingMode } = req.body || {};
    const safePassword = password || null;
    const inputBuffer = await fs.readFile(req.file.path);
    const mime = req.file.mimetype || '';

    // IMAGE
    if (mime.startsWith('image/')) {
      const mode = (embeddingMode || '').toLowerCase();

      const tryDecode = async (modeKey) => {
        let binary = '';
        if (modeKey === 'secure') {
          return await decodeSecureRandomImage(inputBuffer, safePassword);
        } else if (modeKey === 'ml') {
          const ml = await getSafeEmbeddingMask(inputBuffer, { safePercentile: 0.65 });
          binary = await extractMessageMasked(inputBuffer, ml.safeMask);
        } else if (modeKey === 'adaptive') {
          const edges = await getCannyEdgeMask(inputBuffer);
          binary = await extractMessageAdaptive(inputBuffer, edges.edgeMask);
        } else {
          binary = await extractMessage(inputBuffer);
        }
        return decodeMessageBits(binary, safePassword);
      };

      // If mode specified, respect it. Else auto-try.
      let message = '';
      if (mode === 'ml' || mode === 'adaptive' || mode === 'standard') {
        message = await tryDecode(mode);
      } else {
        message = await tryDecode('standard');
        if (!message) message = await tryDecode('adaptive');
        if (!message) message = await tryDecode('ml');
        if (!message) {
          try {
            message = await tryDecode('secure');
          } catch {
            // ignore
          }
        }
      }

      await fs.unlink(req.file.path).catch(() => {});
      return res.json({ success: true, mediaType: 'image', message, decoded: message.length > 0 });
    }

    // AUDIO (WAV)
    if (mime === 'audio/wav' || mime === 'audio/x-wav') {
      const binary = extractBitsFromWav(inputBuffer, END_DELIMITER);
      const message = decodeMessageBits(binary, safePassword);
      await fs.unlink(req.file.path).catch(() => {});
      return res.json({ success: true, mediaType: 'audio', message, decoded: message.length > 0 });
    }

    // PDF
    if (mime === 'application/pdf') {
      const message = await extractMessageFromPdf(inputBuffer, safePassword);
      await fs.unlink(req.file.path).catch(() => {});
      return res.json({ success: true, mediaType: 'pdf', message, decoded: message.length > 0 });
    }

    await fs.unlink(req.file.path).catch(() => {});
    return res.status(400).json({
      error: `Unsupported file type: ${mime}. Supported: PNG/JPEG, WAV, PDF.`,
      success: false,
    });
  } catch (err) {
    console.error('Decode error:', err);
    res.status(500).json({
      error: err.message || 'Decoding failed',
      success: false,
    });
  }
}

/**
 * POST /compress
 * Simulate JPEG compression (quality 50) for robustness testing
 */
export async function compress(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!req.file.mimetype?.startsWith('image/')) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Compression is only supported for images (PNG/JPEG).' });
    }

    const imageBuffer = await fs.readFile(req.file.path);
    const image = await Jimp.read(imageBuffer);

    // Simulate JPEG compression - re-encode at quality 50
    const compressedBuffer = await image
      .quality(50)
      .getBufferAsync(Jimp.MIME_JPEG);

    const timestamp = Date.now();
    const compressedFilename = `compressed_${timestamp}.jpg`;
    const compressedPath = path.join(UPLOADS_DIR, compressedFilename);
    await fs.writeFile(compressedPath, compressedBuffer);

    await fs.unlink(req.file.path).catch(() => {});

    res.json({
      success: true,
      compressedPath: `/uploads/${compressedFilename}`,
      compressedFilename,
    });
  } catch (err) {
    console.error('Compress error:', err);
    res.status(500).json({ error: err.message || 'Compression failed' });
  }
}

/**
 * GET /capacity
 * Calculate max message capacity for an image (optional endpoint)
 */
export async function getCapacity(req, res) {
  try {
    // Capacity is calculated during encode; this is for preview
    res.json({ message: 'Use encode endpoint - capacity returned in response' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * "ML‑enhanced secure embedding" (lightweight CNN-style model).
 *
 * We use a tiny, fixed-weight convolutional filter bank (Sobel X/Y + Laplacian)
 * to estimate texture/high-frequency regions. These regions are typically safer
 * for LSB embedding because they hide small changes better.
 *
 * This is lightweight (no heavy ML runtime) while still being a CNN-like pipeline:
 * conv -> nonlinearity -> score aggregation -> thresholding.
 */

import Jimp from 'jimp';

const SOBEL_X = [
  [-1, 0, 1],
  [-2, 0, 2],
  [-1, 0, 1],
];
const SOBEL_Y = [
  [-1, -2, -1],
  [0, 0, 0],
  [1, 2, 1],
];
const LAPLACIAN = [
  [0, -1, 0],
  [-1, 4, -1],
  [0, -1, 0],
];

function clamp01(v) {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function conv3(gray, w, h, kernel, x, y) {
  let sum = 0;
  for (let ky = -1; ky <= 1; ky++) {
    for (let kx = -1; kx <= 1; kx++) {
      const ix = Math.min(w - 1, Math.max(0, x + kx));
      const iy = Math.min(h - 1, Math.max(0, y + ky));
      sum += gray[iy * w + ix] * kernel[ky + 1][kx + 1];
    }
  }
  return sum;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

/**
 * Compute a boolean mask of "safe pixels" for embedding and a risk score.
 *
 * - **safeMask**: true pixels are preferred for embedding.
 * - **riskScore**: 0..1 where higher means higher detectability risk.
 *
 * @param {Buffer} imageBuffer
 * @param {{safePercentile?: number}} opts
 */
export async function getSafeEmbeddingMask(imageBuffer, opts = {}) {
  const safePercentile = typeof opts.safePercentile === 'number' ? opts.safePercentile : 0.65;

  const img = await Jimp.read(imageBuffer);
  const { width: w, height: h, data } = img.bitmap;

  // grayscale [0..1]
  const gray = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (w * y + x) << 2;
      const r = data[idx] / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;
      gray[y * w + x] = 0.299 * r + 0.587 * g + 0.114 * b;
    }
  }

  // CNN-style conv responses
  const scores = new Float32Array(w * h);
  const scoreList = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = conv3(gray, w, h, SOBEL_X, x, y);
      const gy = conv3(gray, w, h, SOBEL_Y, x, y);
      const lap = conv3(gray, w, h, LAPLACIAN, x, y);

      // magnitude + laplacian, ReLU-ish
      const mag = Math.sqrt(gx * gx + gy * gy);
      const s = Math.max(0, mag) + Math.abs(lap) * 0.5;
      scores[y * w + x] = s;
      scoreList.push(s);
    }
  }

  // threshold by percentile: keep top textured pixels
  const thresh = percentile(scoreList, safePercentile);
  const safeMask = new Uint8Array(w * h);
  let safeCount = 0;
  for (let i = 0; i < safeMask.length; i++) {
    if (scores[i] >= thresh) {
      safeMask[i] = 1;
      safeCount++;
    }
  }

  const safeRatio = safeCount / safeMask.length;
  // Higher risk if fewer textured pixels are available (less hiding room).
  const riskScore = clamp01(1 - safeRatio);

  return { width: w, height: h, safeMask, safeRatio, riskScore: Math.round(riskScore * 1000) / 1000 };
}


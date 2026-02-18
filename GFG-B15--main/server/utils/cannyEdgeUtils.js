/**
 * Canny-style edge detection (lightweight, dependency-free).
 *
 * Pipeline:
 * - grayscale
 * - small gaussian blur (3x3)
 * - Sobel gradients -> magnitude + direction
 * - non-maximum suppression
 * - double threshold + hysteresis
 *
 * Returns a Uint8Array mask (1=edge, 0=non-edge).
 */

import Jimp from 'jimp';

const GAUSS_3 = [
  [1, 2, 1],
  [2, 4, 2],
  [1, 2, 1],
];
const GAUSS_3_DIV = 16;

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

function conv3(src, w, h, kernel, x, y, div = 1) {
  let sum = 0;
  for (let ky = -1; ky <= 1; ky++) {
    for (let kx = -1; kx <= 1; kx++) {
      const ix = Math.min(w - 1, Math.max(0, x + kx));
      const iy = Math.min(h - 1, Math.max(0, y + ky));
      sum += src[iy * w + ix] * kernel[ky + 1][kx + 1];
    }
  }
  return sum / div;
}

function quantizeAngle(theta) {
  // map angle to 0,45,90,135
  const a = (theta * 180) / Math.PI;
  const ang = ((a % 180) + 180) % 180;
  if (ang < 22.5 || ang >= 157.5) return 0;
  if (ang < 67.5) return 45;
  if (ang < 112.5) return 90;
  return 135;
}

/**
 * @param {Buffer} imageBuffer
 * @param {{low?: number, high?: number}} [opts] thresholds in [0..1] on normalized magnitude
 */
export async function getCannyEdgeMask(imageBuffer, opts = {}) {
  const low = typeof opts.low === 'number' ? opts.low : 0.08;
  const high = typeof opts.high === 'number' ? opts.high : 0.18;

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

  // blur
  const blur = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      blur[y * w + x] = conv3(gray, w, h, GAUSS_3, x, y, GAUSS_3_DIV);
    }
  }

  // gradients
  const mag = new Float32Array(w * h);
  const dir = new Uint8Array(w * h);
  let maxMag = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = conv3(blur, w, h, SOBEL_X, x, y);
      const gy = conv3(blur, w, h, SOBEL_Y, x, y);
      const m = Math.sqrt(gx * gx + gy * gy);
      mag[y * w + x] = m;
      if (m > maxMag) maxMag = m;
      dir[y * w + x] = quantizeAngle(Math.atan2(gy, gx));
    }
  }

  // normalize magnitude
  const norm = new Float32Array(w * h);
  const denom = maxMag || 1;
  for (let i = 0; i < norm.length; i++) norm[i] = mag[i] / denom;

  // non-maximum suppression
  const nms = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = dir[i];
      const v = norm[i];
      let v1 = 0;
      let v2 = 0;
      if (a === 0) {
        v1 = norm[i - 1];
        v2 = norm[i + 1];
      } else if (a === 45) {
        v1 = norm[i - w + 1];
        v2 = norm[i + w - 1];
      } else if (a === 90) {
        v1 = norm[i - w];
        v2 = norm[i + w];
      } else {
        v1 = norm[i - w - 1];
        v2 = norm[i + w + 1];
      }
      nms[i] = v >= v1 && v >= v2 ? v : 0;
    }
  }

  // double threshold + hysteresis
  const STRONG = 2;
  const WEAK = 1;
  const out = new Uint8Array(w * h);
  const stack = [];

  for (let i = 0; i < nms.length; i++) {
    if (nms[i] >= high) {
      out[i] = STRONG;
      stack.push(i);
    } else if (nms[i] >= low) {
      out[i] = WEAK;
    }
  }

  // connect weak edges to strong edges (8-neighborhood)
  while (stack.length) {
    const idx = stack.pop();
    const x = idx % w;
    const y = (idx - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx <= 0 || nx >= w - 1 || ny <= 0 || ny >= h - 1) continue;
        const ni = ny * w + nx;
        if (out[ni] === WEAK) {
          out[ni] = STRONG;
          stack.push(ni);
        }
      }
    }
  }

  // final mask + stats
  const mask = new Uint8Array(w * h);
  let edgeCount = 0;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === STRONG) {
      mask[i] = 1;
      edgeCount++;
    }
  }

  return {
    width: w,
    height: h,
    edgeMask: mask,
    edgeRatio: edgeCount / mask.length,
    thresholds: { low, high },
  };
}


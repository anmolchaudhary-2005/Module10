/**
 * API client for Robust Steganography Encoder
 */

import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'multipart/form-data' },
});

/**
 * Encode message into a supported file (PNG/JPEG/WAV/PDF)
 * @param {File} file - File to encode into
 * @param {string} message - Secret message
 * @param {string} [password] - Optional password for AES encryption
 * @param {Function} [onProgress] - Progress callback (0-100)
 * @param {boolean|string} [useMl] - true/false for ML mode, or 'adaptive' for adaptive LSB
 */
export async function encodeImage(file, message, password = '', onProgress, useMl = true) {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('message', message);
  if (password) formData.append('password', password);
  
  // Support embeddingMode: 'standard', 'ml', or 'adaptive'
  if (typeof useMl === 'string') {
    formData.append('embeddingMode', useMl);
  } else {
    formData.append('useMl', useMl ? '1' : '0');
  }

  const response = await api.post('/encode', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    },
  });
  return response.data;
}

/**
 * Decode message from a supported file (PNG/JPEG/WAV/PDF)
 * @param {File} file - Encoded file
 * @param {string} [password] - Optional password if message was encrypted
 */
export async function decodeImage(file, password = '', embeddingMode = '') {
  const formData = new FormData();
  formData.append('image', file);
  if (password) formData.append('password', password);
  if (embeddingMode) formData.append('embeddingMode', embeddingMode);

  const response = await api.post('/decode', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Simulate JPEG compression (quality 50)
 * @param {File} imageFile - Image file to compress
 */
export async function compressImage(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);

  const response = await api.post('/compress', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

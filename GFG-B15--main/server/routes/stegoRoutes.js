/**
 * Steganography API Routes
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { encode, decode, compress } from '../controllers/stegoController.js';

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = './uploads';
await fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(() => {});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'upload-' + uniqueSuffix + path.extname(file.originalname) || '.png');
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
    'audio/wav',
    'audio/x-wav',
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only PNG, JPEG, PDF, and WAV files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// POST /api/encode - Encode message into supported file
router.post('/encode', upload.single('image'), encode);

// POST /api/decode - Extract message from supported file
router.post('/decode', upload.single('image'), decode);

// POST /api/compress - Simulate JPEG compression (images only)
router.post('/compress', upload.single('image'), compress);

export default router;



import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

import stegoRoutes from './routes/stegoRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: true }));
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api', stegoRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Robust Steganography API is running' });
});

await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true }).catch(() => {});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

const server = app.listen(PORT, () => {
  console.log(`\n🔐 Robust Steganography Server running on http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api\n`);
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use.`);
    console.error('Fix: stop the other server using that port, or run with a different PORT.');
    console.error('Examples:');
    console.error('  - PowerShell: $env:PORT=5001; npm start');
    console.error('  - bash: PORT=5001 npm start\n');
    process.exit(1);
  }
  console.error('Failed to start server:', err);
  process.exit(1);
});

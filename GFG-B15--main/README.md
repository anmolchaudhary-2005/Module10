# Robust Steganography Encoder

A production-ready web application for encoding and decoding secret messages inside images using LSB (Least Significant Bit) steganography. Includes PSNR analysis, JPEG compression simulation, optional AES encryption, and a modern React + Express stack.

## Features

- **Encode** secret messages into JPEG/PNG images using LSB steganography
- **Optional AES-256** encryption when a password is provided
- **Decode** hidden messages from encoded images
- **PSNR** (Peak Signal-to-Noise Ratio) calculation for quality metrics
- **JPEG compression simulation** (quality 50) to test robustness
- **Capacity calculation** – shows max message size before encoding
- **Progress bar** during encoding
- **Dark mode** with system preference detection
- Side-by-side **original vs encoded** image preview

## Tech Stack

| Layer        | Technology                  |
|-------------|-----------------------------|
| Frontend    | React 18 + Vite             |
| Styling     | TailwindCSS                 |
| Backend     | Node.js + Express           |
| Image       | Jimp                        |
| File Upload | Multer                      |
| Encryption  | Node.js crypto (AES-256-CBC)|

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── UploadImage.jsx
│   │   │   ├── EncodeForm.jsx
│   │   │   ├── DecodeSection.jsx
│   │   │   ├── ImagePreview.jsx
│   │   │   ├── PSNRDisplay.jsx
│   │   │   └── StatusMessage.jsx
│   │   ├── App.jsx
│   │   ├── api.js
│   │   └── index.css
│   └── package.json
│
├── server/                 # Express backend
│   ├── app.js
│   ├── routes/stegoRoutes.js
│   ├── controllers/stegoController.js
│   ├── utils/stegoUtils.js
│   ├── uploads/
│   └── package.json
│
└── README.md
```

---

## Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn

### 1. Clone or download the project

```bash
cd "c:\Users\anmol\New folder (2)"
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

### 3. Install frontend dependencies

```bash
cd ../client
npm install
```

---

## How to Run Locally

### Option A: Run both servers manually

**Terminal 1 – Backend (port 5000):**
```bash
cd server
npm run dev
```

**Terminal 2 – Frontend (port 3000):**
```bash
cd client
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). The frontend proxies `/api` and `/uploads` to the backend.

### Option B: Production-style run

**Backend:**
```bash
cd server
npm start
```

**Frontend (build and serve):**
```bash
cd client
npm run build
npm run preview
```

Note: For preview, update `vite.config.js` proxy or use a static server that proxies to the backend.

---

## API Endpoints

| Method | Endpoint      | Description                                      |
|--------|---------------|--------------------------------------------------|
| POST   | `/api/encode` | Encode message into image (multipart: image, message, password?) |
| POST   | `/api/decode` | Decode message from image (multipart: image, password?) |
| POST   | `/api/compress` | Simulate JPEG compression (multipart: image)   |
| GET    | `/api/health` | Health check                                    |

---

## Deployment

### Backend: Render

1. Create a new **Web Service** on [Render](https://render.com).
2. Connect your repo or use manual deploy.
3. Set root directory: `server`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Set environment variable: `PORT` (Render sets this automatically).
7. Under **Disk**, add a persistent disk for `uploads` if you need files to persist (or rely on ephemeral storage).

### Frontend: Netlify

1. Create a new site on [Netlify](https://netlify.com).
2. Connect your repo.
3. Set base directory: `client`.
4. Build command: `npm run build`
5. Publish directory: `dist`
6. Add redirect for SPA:

   Create `client/public/_redirects`:
   ```
   /api/*  https://YOUR-RENDER-URL.onrender.com/api/:splat  200
   /uploads/*  https://YOUR-RENDER-URL.onrender.com/uploads/:splat  200
   ```

   Or set environment variable:

   `VITE_API_URL=https://YOUR-RENDER-URL.onrender.com`

   And update `client/src/api.js` to use `VITE_API_URL` for the base URL when building.

7. Redeploy after backend URL changes.

### Alternative: Single-server deployment (Node serves React build)

1. Build frontend: `cd client && npm run build`
2. In `server/app.js`, add:
   ```js
   app.use(express.static(path.join(__dirname, '../client/dist')));
   app.get('*', (req, res) => {
     res.sendFile(path.join(__dirname, '../client/dist/index.html'));
   });
   ```
3. Deploy the whole project to Render/Heroku as a single Node app.

---

## Usage

1. **Encode**
   - Upload a JPEG or PNG image
   - Enter your secret message
   - Optionally add a password for AES encryption
   - Click **Encode Message**
   - Download the encoded image and check PSNR

2. **Compression test**
   - After encoding, click **Simulate JPEG compression**
   - Download the compressed image (optional)

3. **Decode**
   - Upload the encoded (or compressed) image
   - Enter the same password if you used one
   - Click **Decode Message** or **Decode Compressed (Test Robustness)**
   - Check whether the message survived compression

---

## License

MIT

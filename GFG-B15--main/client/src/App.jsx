/**
 * Robust Steganography Encoder - Main Application
 */

import { useState, useCallback, useEffect } from 'react';
import UploadImage from './components/UploadImage';
import EncodeForm from './components/EncodeForm';
import DecodeSection from './components/DecodeSection';
import ImagePreview from './components/ImagePreview';
import PSNRDisplay from './components/PSNRDisplay';
import StatusMessage from './components/StatusMessage';
import { encodeImage, decodeImage, compressImage } from './api';

const API_BASE = '';
const ACCEPTED_FILES = 'image/png,image/jpeg,image/jpg,application/pdf,audio/wav,audio/x-wav';

export default function App() {
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const [encodeImageFile, setEncodeImageFile] = useState(null);
  const [originalPreview, setOriginalPreview] = useState(null); // only for images
  const [encodedPreview, setEncodedPreview] = useState(null);
  const [compressedPreview, setCompressedPreview] = useState(null);
  const [encodedPath, setEncodedPath] = useState(null);
  const [compressedPath, setCompressedPath] = useState(null);
  const [psnr, setPsnr] = useState(null);
  const [capacity, setCapacity] = useState(null);
  const [encodedMediaType, setEncodedMediaType] = useState(null); // image|audio|pdf
  const [encodedFilename, setEncodedFilename] = useState(null);
  const [embeddingMode, setEmbeddingMode] = useState(null);
  const [embeddingModeKey, setEmbeddingModeKey] = useState(null);
  const [riskScore, setRiskScore] = useState(null);
  const [safeRatio, setSafeRatio] = useState(null);
  const [encodeProgress, setEncodeProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [compressLoading, setCompressLoading] = useState(false);
  const [status, setStatus] = useState({ type: null, title: null, message: null });

  const [decodeImageFile, setDecodeImageFile] = useState(null);
  const [decodedMessage, setDecodedMessage] = useState(null);
  const [decodeLoading, setDecodeLoading] = useState(false);
  const [decodeStatus, setDecodeStatus] = useState(null);
  const [robustnessResult, setRobustnessResult] = useState(null);

  const toggleDarkMode = () => setDarkMode((d) => !d);

  const resetEncode = useCallback(() => {
    setOriginalPreview(null);
    setEncodedPreview(null);
    setCompressedPreview(null);
    setEncodedPath(null);
    setCompressedPath(null);
    setPsnr(null);
    setCapacity(null);
    setEncodedMediaType(null);
    setEncodedFilename(null);
    setEmbeddingMode(null);
    setEmbeddingModeKey(null);
    setRiskScore(null);
    setSafeRatio(null);
    setEncodeProgress(0);
    setRobustnessResult(null);
  }, []);

  const handleEncodeFileSelect = useCallback((file) => {
    setEncodeImageFile(file);
    setOriginalPreview(file?.type?.startsWith('image/') ? URL.createObjectURL(file) : null);
    setCapacity(null); // Will be set by UploadImage onCapacity or from encode response
    resetEncode();
    setStatus({ type: null });
  }, [resetEncode]);

  const handleCapacity = useCallback((cap) => setCapacity(cap), []);

  const handleEncode = async ({ message, password, useMl }) => {
    if (!encodeImageFile) {
      setStatus({ type: 'error', title: 'Error', message: 'Please upload an image first.' });
      return;
    }
    setLoading(true);
    setStatus({ type: null });
    setEncodeProgress(0);
    try {
      const res = await encodeImage(encodeImageFile, message, password, setEncodeProgress, useMl);
      setEncodedMediaType(res.mediaType || null);
      setEncodedFilename(res.encodedFilename || null);
      setEncodedPreview(res.mediaType === 'image' ? `${API_BASE}${res.encodedPath}` : null);
      setEncodedPath(res.encodedPath);
      setPsnr(res.psnr ?? null);
      setCapacity(res.capacity ?? null);
      setEmbeddingMode(res.embeddingMode ?? null);
      setEmbeddingModeKey(res.embeddingModeKey ?? null);
      setRiskScore(res.riskScore ?? null);
      setSafeRatio(res.safeRatio ?? null);
      setStatus({
        type: 'success',
        title: 'Encoded successfully',
        message:
          res.mediaType === 'image'
            ? `PSNR: ${res.psnr} dB. Download the encoded file below.`
            : 'Download the encoded file below.',
      });
      setRobustnessResult(null);
    } catch (err) {
      setStatus({
        type: 'error',
        title: 'Encoding failed',
        message: err.response?.data?.error || err.message,
      });
      if (err.response?.data?.maxCapacity) {
        setCapacity(err.response.data.maxCapacity);
      }
    } finally {
      setLoading(false);
      setEncodeProgress(0);
    }
  };

  const handleCompress = async () => {
    if (!encodedPath || encodedMediaType !== 'image') {
      setStatus({ type: 'error', title: 'Error', message: 'Please encode an image first.' });
      return;
    }
    setCompressLoading(true);
    setStatus({ type: null });
    try {
      const blob = await fetch(`${API_BASE}${encodedPath}`).then((r) => r.blob());
      const encodedFile = new File([blob], 'encoded.png', { type: 'image/png' });
      const res = await compressImage(encodedFile);
      setCompressedPreview(`${API_BASE}${res.compressedPath}`);
      setCompressedPath(res.compressedPath);
      setStatus({
        type: 'info',
        title: 'Compression applied',
        message: 'JPEG quality 50 simulated. Try decoding the compressed image to test robustness.',
      });
    } catch (err) {
      setStatus({
        type: 'error',
        title: 'Compression failed',
        message: err.response?.data?.error || err.message,
      });
    } finally {
      setCompressLoading(false);
    }
  };

  const handleDecodeFileSelect = useCallback((file) => {
    setDecodeImageFile(file);
    setDecodedMessage(null);
    setDecodeStatus(null);
    setRobustnessResult(null);
    setStatus({ type: null });
  }, []);

  const handleDecode = async (password, forceUseCompressed = false) => {
    let file = decodeImageFile;
    const useCompressed = forceUseCompressed && compressedPath;
    if (useCompressed) {
      try {
        const blob = await fetch(`${API_BASE}${compressedPath}`).then((r) => r.blob());
        file = new File([blob], 'compressed.jpg', { type: 'image/jpeg' });
      } catch (e) {
        setStatus({ type: 'error', title: 'Error', message: 'Could not load compressed image.' });
        return;
      }
    } else if (!file && compressedPath && !forceUseCompressed) {
      try {
        const blob = await fetch(`${API_BASE}${compressedPath}`).then((r) => r.blob());
        file = new File([blob], 'compressed.jpg', { type: 'image/jpeg' });
      } catch (e) {
        setStatus({ type: 'error', title: 'Error', message: 'Could not load compressed image.' });
        return;
      }
    }
    if (!file) {
      setStatus({ type: 'error', title: 'Error', message: 'Upload an encoded image or compress first, then decode.' });
      return;
    }
    setDecodeLoading(true);
    setStatus({ type: null });
    try {
      const res = await decodeImage(file, password, embeddingModeKey || '');
      setDecodedMessage(res.message);
      setDecodeStatus(res.decoded);
      const wasCompressed = file.name?.includes('compressed') || useCompressed;
      setRobustnessResult(
        wasCompressed ? { survived: res.decoded, wasCompressed: true } : null
      );
    } catch (err) {
      setDecodedMessage(null);
      setDecodeStatus(false);
      setStatus({
        type: 'error',
        title: 'Decoding failed',
        message: err.response?.data?.error || err.message,
      });
    } finally {
      setDecodeLoading(false);
    }
  };

  const downloadEncoded = () => {
    if (encodedPath) {
      const a = document.createElement('a');
      a.href = `${API_BASE}${encodedPath}`;
      a.download = encodedFilename || 'encoded';
      a.click();
    }
  };

  const downloadCompressed = () => {
    if (compressedPath) {
      const a = document.createElement('a');
      a.href = `${API_BASE}${compressedPath}`;
      a.download = 'compressed.jpg';
      a.click();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/80 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Robust Steganography Encoder</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">LSB encoding • PSNR • Compression test</p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? (
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Encode Section */}
          <section className="space-y-6">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Encode</h2>
              <UploadImage
                onFileSelect={handleEncodeFileSelect}
                onCapacity={handleCapacity}
                label="Upload file for encoding"
                accept={ACCEPTED_FILES}
              />
              <div className="mt-4">
                <EncodeForm
                  onEncode={handleEncode}
                  loading={loading}
                  capacity={capacity}
                />
              </div>

              {/* Progress bar */}
              {encodeProgress > 0 && encodeProgress < 100 && (
                <div className="mt-4">
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${encodeProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{encodeProgress}%</p>
                </div>
              )}

              {/* Compression simulation */}
              {encodedPath && encodedMediaType === 'image' && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleCompress}
                    disabled={compressLoading}
                    className="w-full py-2 px-4 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm font-medium"
                  >
                    {compressLoading ? 'Compressing...' : 'Simulate JPEG compression (quality 50)'}
                  </button>
                </div>
              )}
            </div>

            {/* Status */}
            {status.type && (
              <StatusMessage type={status.type} title={status.title} message={status.message} />
            )}

            {/* PSNR & Download */}
            {(psnr != null || encodedPath) && (
              <div className="flex flex-col sm:flex-row gap-4">
                {psnr != null && encodedMediaType === 'image' && <PSNRDisplay psnr={psnr} />}
                {encodedPath && (
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={downloadEncoded}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                      Download Encoded
                    </button>
                    {compressedPath && (
                      <button
                        onClick={downloadCompressed}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg font-medium text-sm transition-colors"
                      >
                        Download Compressed
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {(embeddingMode || riskScore != null) && (
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 animate-fade-in">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Embedding analysis</h4>
                {embeddingMode && (
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    Mode: <span className="font-medium">{embeddingMode}</span>
                  </p>
                )}
                {riskScore != null && (
                  <p className="mt-1 text-sm text-gray-800 dark:text-gray-200">
                    Steganography risk: <span className="font-mono font-semibold">{riskScore}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400"> (lower is safer)</span>
                  </p>
                )}
                {safeRatio != null && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Safe-region coverage: {Math.round(safeRatio * 100)}%
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Decode Section */}
          <section className="space-y-6">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Decode</h2>
              <UploadImage
                onFileSelect={handleDecodeFileSelect}
                label="Upload encoded file to decode"
                accept={ACCEPTED_FILES}
              />
              <div className="mt-4">
                <DecodeSection
                  onDecode={handleDecode}
                  decodedMessage={decodedMessage}
                  decodeLoading={decodeLoading}
                  decodeStatus={decodeStatus}
                  robustnessResult={robustnessResult}
                  compressedPath={compressedPath}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Image Previews */}
        <section className="mt-8">
          <ImagePreview
            original={originalPreview}
            encoded={encodedPreview}
            compressed={compressedPreview}
            loading={loading || compressLoading}
          />
        </section>
      </main>
    </div>
  );
}

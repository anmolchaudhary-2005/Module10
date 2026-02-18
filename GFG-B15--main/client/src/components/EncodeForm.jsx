/**
 * EncodeForm - Form for encoding secret message into image
 */

import { useState } from 'react';

export default function EncodeForm({ onEncode, loading, capacity }) {
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [embeddingMode, setEmbeddingMode] = useState('secure'); // 'standard', 'ml', 'adaptive', 'secure'

  const handleSubmit = (e) => {
    e.preventDefault();
    // Convert to format expected by API: boolean for ML checkbox, or string for embeddingMode
    const modeParam =
      embeddingMode === 'ml' ? true :
      embeddingMode === 'adaptive' ? 'adaptive' :
      embeddingMode === 'secure' ? 'secure' :
      false;
    onEncode({ message, password: password || undefined, useMl: modeParam });
  };

  const charCount = message.length;
  const isOverCapacity = capacity && charCount > capacity;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Secret Message *
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your secret message..."
          rows={4}
          required
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
        {capacity && (
          <p className={`mt-1 text-xs ${isOverCapacity ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
            {charCount} / {capacity} characters max
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Password <span className="text-gray-400 font-normal">(optional, AES encryption)</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty for no encryption"
            className="w-full px-4 py-3 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Embedding Mode
        </label>
        <select
          value={embeddingMode}
          onChange={(e) => setEmbeddingMode(e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="standard">Standard LSB (all pixels)</option>
          <option value="ml">ML-enhanced secure embedding (CNN texture map)</option>
          <option value="adaptive">Adaptive LSB (Canny edges - smart pixel selection)</option>
          <option value="secure">Secure (10-main-integrate: encrypt + randomized pixels + checksum)</option>
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {embeddingMode === 'standard' && 'Embeds in all pixels equally (RGB channels).'}
          {embeddingMode === 'ml' && 'Uses CNN-style texture detection to embed in high-frequency regions (harder to detect).'}
          {embeddingMode === 'adaptive' && 'Embeds more bits in edges/texture (3 bits), fewer in smooth areas (1 bit).'}
          {embeddingMode === 'secure' && 'Encrypts the payload and embeds it using a password-seeded pseudo-random pixel strategy (with checksum validation).'}
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || !message.trim() || isOverCapacity}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Encoding...
          </>
        ) : (
          'Encode Message'
        )}
      </button>
    </form>
  );
}

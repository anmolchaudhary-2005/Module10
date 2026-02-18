/**
 * DecodeSection - Decode hidden message from image
 */

import { useState } from 'react';

export default function DecodeSection({
  onDecode,
  decodedMessage,
  decodeLoading,
  decodeStatus,
  robustnessResult,
  compressedPath,
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onDecode(password || undefined, false);
  };

  const handleDecodeCompressed = (e) => {
    e.preventDefault();
    onDecode(password || undefined, true);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Decode Message</h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Password <span className="text-gray-400 font-normal">(if message was encrypted)</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave empty if no encryption"
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

        <button
          type="submit"
          disabled={decodeLoading}
          className="w-full py-3 px-4 bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {decodeLoading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Decoding...
            </>
          ) : (
            'Decode Message'
          )}
        </button>

        {compressedPath && (
          <button
            type="button"
            onClick={handleDecodeCompressed}
            disabled={decodeLoading}
            className="w-full py-2 px-4 rounded-lg border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-200 font-medium text-sm transition-colors disabled:opacity-50"
          >
            Decode Compressed (Test Robustness)
          </button>
        )}
      </form>

      {decodeStatus !== null && (
        <div className="space-y-2">
          {robustnessResult && (
            <div
              className={`rounded-lg p-3 flex items-center gap-2 ${
                robustnessResult.survived
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
              }`}
            >
              {robustnessResult.survived ? (
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              <span className="text-sm font-medium">
                Survived compression: {robustnessResult.survived ? 'Yes' : 'No'}
              </span>
            </div>
          )}

          {decodedMessage !== null && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Decoded Message</p>
              <p className="font-mono text-sm break-words whitespace-pre-wrap text-gray-900 dark:text-gray-100">
                {decodedMessage || '(empty or failed)'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ImagePreview - Side-by-side or single image preview
 */

export default function ImagePreview({ original, encoded, compressed, loading }) {
  const previews = [
    { label: 'Original', src: original },
    { label: 'Encoded', src: encoded },
    { label: 'Compressed', src: compressed },
  ].filter((p) => p.src);

  if (previews.length === 0 && !loading) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Preview</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && (
          <div className="col-span-full flex justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm text-gray-500">Processing...</span>
            </div>
          </div>
        )}
        {!loading &&
          previews.map(({ label, src }) => (
            <div
              key={label}
              className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800"
            >
              <div className="aspect-square relative">
                <img
                  src={src}
                  alt={label}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="p-2 text-center text-sm font-medium text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800/50">
                {label}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}

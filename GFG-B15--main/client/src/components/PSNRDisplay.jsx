/**
 * PSNRDisplay - Peak Signal-to-Noise Ratio display
 */

export default function PSNRDisplay({ psnr }) {
  if (psnr == null) return null;

  const getColor = () => {
    if (psnr >= 40) return 'text-green-600 dark:text-green-400';
    if (psnr >= 30) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  const getLabel = () => {
    if (psnr >= 40) return 'Excellent';
    if (psnr >= 30) return 'Good';
    return 'Moderate';
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 animate-fade-in">
      <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">PSNR (Peak Signal-to-Noise Ratio)</h4>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold font-mono ${getColor()}`}>{psnr} dB</span>
        <span className="text-sm text-gray-500">({getLabel()} quality)</span>
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Higher PSNR = less visible distortion. Typically 40+ dB is imperceptible.
      </p>
    </div>
  );
}

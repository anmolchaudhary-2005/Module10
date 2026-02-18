import { useState, useCallback, useId } from 'react';

const END_DELIMITER_BITS = 16;
const BITS_PER_PIXEL = 3;

export default function UploadImage({ onFileSelect, onCapacity, label, accept }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputId = useId();

  const computeCapacity = useCallback((file) => {
    if (!file || !onCapacity) return;
    if (!file.type?.startsWith('image/')) {
      onCapacity(null);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const bits = img.width * img.height * BITS_PER_PIXEL - END_DELIMITER_BITS;
      onCapacity(Math.max(0, Math.floor(bits / 8)));
      URL.revokeObjectURL(url);
    };

    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [onCapacity]);

  const notifySelect = useCallback((file) => {
    onFileSelect?.(file);
    computeCapacity(file);
  }, [onFileSelect, computeCapacity]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) notifySelect(file);
  };

  return (
    <div className="w-full">
      <label className="block text-sm mb-2">{label}</label>

      <div
        onClick={() => document.getElementById(inputId).click()}
        className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer"
      >
        <input
          id={inputId}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
        <p>Click to upload (PNG/JPEG/WAV/PDF)</p>
      </div>
    </div>
  );
}

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "../utils/cropImage";
import { getCroppedImg } from "../utils/cropImage";

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onConfirmCrop: (croppedFile: File) => Promise<void> | void;
  isProcessing?: boolean;
  initialAspect?: number;
  initialShape?: "round" | "rect";
}

export default function ImageCropModal({
  isOpen,
  imageSrc,
  onClose,
  onConfirmCrop,
  isProcessing = false,
  initialAspect = 1,
  initialShape = "round",
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(initialAspect);
  const [cropShape, setCropShape] = useState<"round" | "rect">(initialShape);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropAreaComplete = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(1);
    setCropShape("round");
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels) {
      setErrorMsg("Chưa chọn được vùng cắt ảnh.");
      return;
    }

    try {
      setErrorMsg(null);
      const croppedFile = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation,
        "avatar.jpg"
      );
      await onConfirmCrop(croppedFile);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Cắt ảnh thất bại.";
      setErrorMsg(msg);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#1c1d29] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide">
              Cắt & Tùy Chỉnh Khung Ảnh
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Di chuyển và phóng to/thu nhỏ ảnh theo khung mong muốn
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Khung cắt chính (Interactive Crop Area) */}
        <div className="relative w-full h-80 sm:h-96 bg-[#12131c]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={true}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaComplete}
          />
        </div>

        {/* Bảng điều khiển tùy chỉnh (Toolbar Controls) */}
        <div className="px-6 py-4 bg-[#202232] flex flex-col gap-4 border-t border-slate-800">
          {/* 1. Chọn tỷ lệ khung & Hình dạng */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Tỷ lệ khung */}
            <div className="flex items-center gap-1.5 bg-[#181924] p-1 rounded-2xl border border-slate-700/50">
              <span className="text-[11px] font-medium text-slate-400 px-2">
                Tỷ lệ:
              </span>
              <button
                type="button"
                onClick={() => setAspect(1)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  aspect === 1
                    ? "bg-[#3b82f6] text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                1:1 (Avatar)
              </button>
              <button
                type="button"
                onClick={() => {
                  setAspect(4 / 3);
                  setCropShape("rect");
                }}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  aspect === 4 / 3
                    ? "bg-[#3b82f6] text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                4:3
              </button>
              <button
                type="button"
                onClick={() => {
                  setAspect(16 / 9);
                  setCropShape("rect");
                }}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  aspect === 16 / 9
                    ? "bg-[#3b82f6] text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                16:9
              </button>
              <button
                type="button"
                onClick={() => {
                  setAspect(undefined);
                  setCropShape("rect");
                }}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  aspect === undefined
                    ? "bg-[#3b82f6] text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                Tự do
              </button>
            </div>

            {/* Dạng khung (Tròn vs Vuông) */}
            <div className="flex items-center gap-1.5 bg-[#181924] p-1 rounded-2xl border border-slate-700/50">
              <span className="text-[11px] font-medium text-slate-400 px-2">
                Khung:
              </span>
              <button
                type="button"
                onClick={() => {
                  setCropShape("round");
                  setAspect(1);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  cropShape === "round"
                    ? "bg-[#8b5cf6] text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full border border-current" />
                <span>Tròn</span>
              </button>
              <button
                type="button"
                onClick={() => setCropShape("rect")}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  cropShape === "rect"
                    ? "bg-[#8b5cf6] text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-sm border border-current" />
                <span>Vuông</span>
              </button>
            </div>
          </div>

          {/* 2. Thanh phóng to (Zoom) và Nút xoay ảnh */}
          <div className="flex items-center gap-4">
            <div className="flex-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(1, prev - 0.2))}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                title="Thu nhỏ"
              >
                -
              </button>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
              />
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(3, prev + 0.2))}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                title="Phóng to"
              >
                +
              </button>
              <span className="text-xs text-slate-400 w-12 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Nút Xoay 90 độ */}
            <button
              type="button"
              onClick={handleRotate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors cursor-pointer"
              title="Xoay ảnh 90°"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Xoay 90°</span>
            </button>

            {/* Nút Reset */}
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
            >
              Đặt lại
            </button>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#1c1d29] border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-2xl transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <svg
                  className="animate-spin w-4 h-4 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>Đang xử lý & Lưu...</span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span>Cắt & Áp dụng</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

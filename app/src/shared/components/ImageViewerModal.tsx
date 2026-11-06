import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ImageViewerModalProps {
  isOpen: boolean;
  imageUrl: string;
  userName?: string;
  userRole?: string;
  onClose: () => void;
  onChangePhoto?: () => void;
}

export default function ImageViewerModal({
  isOpen,
  imageUrl,
  userName = "Người dùng",
  userRole = "Manager",
  onClose,
  onChangePhoto,
}: ImageViewerModalProps) {
  const [zoomLevel, setZoomLevel] = useState(1);

  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Reset zoom khi mở modal
      setZoomLevel(1);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleZoomIn(e: React.MouseEvent) {
    e.stopPropagation();
    setZoomLevel((prev) => Math.min(prev + 0.3, 2.5));
  }

  function handleZoomOut(e: React.MouseEvent) {
    e.stopPropagation();
    setZoomLevel((prev) => Math.max(prev - 0.3, 0.7));
  }

  function handleResetZoom(e: React.MouseEvent) {
    e.stopPropagation();
    setZoomLevel(1);
  }

  // Tải ảnh về máy tính
  function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `avatar-${userName.toLowerCase().replace(/\s+/g, "-")}.jpg`;
    link.target = "_blank";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[99999] flex  items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none cursor-zoom-out"
    >
      {/* Top Bar: Tiêu đề & Các nút điều khiển */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-4 left-6 right-6 flex items-center justify-between text-white z-10 cursor-default"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={userName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-bold text-sm">
                {userName[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h4 className="font-semibold text-sm text-slate-100">{userName}</h4>
            <p className="text-xs text-slate-400 capitalize">{userRole}</p>
          </div>
        </div>

        {/* Các nút công cụ (Zoom, Tải về, Đổi ảnh, Đóng) */}
        <div className="flex items-center gap-2 bg-[#1c1d29]/90 border border-slate-700/80 p-1.5 rounded-2xl shadow-xl">
          {/* Thu nhỏ */}
          <button
            type="button"
            onClick={handleZoomOut}
            title="Thu nhỏ"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
              />
            </svg>
          </button>

          {/* Phóng to */}
          <button
            type="button"
            onClick={handleZoomIn}
            title="Phóng to"
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
              />
            </svg>
          </button>

          {/* Reset Zoom */}
          {zoomLevel !== 1 && (
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              100%
            </button>
          )}

          <div className="w-px h-5 bg-slate-700 my-auto" />

          {/* Nút Tải ảnh về */}
          <button
            type="button"
            onClick={handleDownload}
            title="Tải ảnh này về máy"
            className="p-2 text-slate-300 hover:text-emerald-400 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>

          {/* Nút Đổi ảnh khác */}
          {onChangePhoto && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                onChangePhoto();
              }}
              title="Đổi ảnh đại diện khác"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-medium rounded-xl transition-colors cursor-pointer shadow-md"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
              </svg>
              <span>Đổi ảnh</span>
            </button>
          )}

          {/* Nút Đóng */}
          <button
            type="button"
            onClick={onClose}
            title="Đóng (Esc)"
            className="p-2 text-slate-400 hover:text-white hover:bg-red-500/20 hover:text-red-300 rounded-xl transition-colors cursor-pointer"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Vùng hiển thị toàn cảnh ảnh (Full-size Photo Display) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-[90vw] max-h-[82vh] flex items-center justify-center cursor-default"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={userName}
            style={{ transform: `scale(${zoomLevel})` }}
            className="max-h-[82vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl border border-slate-700/60 transition-transform duration-200 ease-out"
          />
        ) : (
          <div className="w-64 h-64 rounded-3xl bg-gradient-to-tr from-[#3b82f6] to-[#8b5cf6] flex flex-col items-center justify-center text-white p-6 shadow-2xl">
            <span className="text-6xl font-extrabold mb-2">
              {userName[0]?.toUpperCase()}
            </span>
            <span className="text-sm font-medium text-white/80">
              Chưa có ảnh đại diện
            </span>
            {onChangePhoto && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onChangePhoto();
                }}
                className="mt-4 px-4 py-2 bg-white text-slate-900 rounded-xl font-semibold text-xs shadow-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Tải ảnh lên ngay
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chú thích phía dưới */}
      <div className="absolute bottom-4 text-xs text-slate-400/80 pointer-events-none">
        Bấm bất kỳ đâu bên ngoài hoặc phím Esc để đóng
      </div>
    </div>,
    document.body
  );
}

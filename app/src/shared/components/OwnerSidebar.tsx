import { useState, useRef, useEffect, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router";
import { useAuthStore } from "../stores/authStore";
import { uploadAvatarApi } from "../../features/auth/auth.api";
import ImageCropModal from "./ImageCropModal";
import ImageViewerModal from "./ImageViewerModal";

interface NavItem {
  to: string;
  label: string;
  icon: (active: boolean) => ReactNode;
}

export default function OwnerSidebar() {
  const { user, logout, updateUserAvatar } = useAuthStore();
  const navigate = useNavigate();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Quản lý trạng thái Modal xem toàn cảnh ảnh & Modal cắt ảnh
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Đóng menu người dùng khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  // Chuyển đổi đường dẫn ảnh avatar tương đối (/uploads/...) thành URL đầy đủ
  function getAvatarUrl(url?: string | null): string {
    if (!url) return "";
    if (
      url.startsWith("http://") ||
      url.startsWith("https://") ||
      url.startsWith("data:")
    ) {
      return url;
    }
    const backendBase = (
      import.meta.env.VITE_API_URL || "http://localhost:3000/api"
    ).replace(/\/api\/?$/, "");
    return `${backendBase}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  // Khi người dùng chọn file ảnh từ máy tính -> Mở modal cắt ảnh tùy chỉnh
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WEBP).");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError("Kích thước file ảnh gốc không được vượt quá 15MB.");
      return;
    }

    setUploadError(null);
    setUploadSuccess(false);

    // Mở modal cắt ảnh với URL ảnh tạm thời
    const objectUrl = URL.createObjectURL(file);
    setSelectedImageSrc(objectUrl);
    setIsCropModalOpen(true);

    if (event.target) {
      event.target.value = "";
    }
  }

  // Xác nhận sau khi đã cắt ảnh trên modal -> Gửi file đã cắt lên backend
  async function handleConfirmCrop(croppedFile: File) {
    setIsUploading(true);
    setUploadError(null);

    try {
      const res = await uploadAvatarApi(croppedFile);
      if (res && res.data?.avatarUrl) {
        updateUserAvatar(res.data.avatarUrl);
        setUploadSuccess(true);
        setTimeout(() => setUploadSuccess(false), 3000);
        setIsCropModalOpen(false);
      }
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setUploadError(
        errorObj.response?.data?.message ||
          "Không thể tải ảnh lên. Vui lòng kiểm tra kết nối backend.",
      );
    } finally {
      setIsUploading(false);
      if (selectedImageSrc) {
        URL.revokeObjectURL(selectedImageSrc);
      }
    }
  }

  // Danh sách các mục menu chính (Khớp 100% với giao diện trong ảnh)
  const mainNavItems: NavItem[] = [
    {
      to: "/owner/bookings",
      label: "Lịch đặt sân",
      icon: () => (
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          <path
            strokeWidth={1.8}
            d="M12 3a9 9 0 0 0 0 18M12 3a9 9 0 0 1 0 18"
            strokeDasharray="2 2"
          />
          <path
            strokeWidth={1.8}
            d="M3 12h18M12 3c-2.5 4-2.5 14 0 18M12 3c2.5 4 2.5 14 0 18"
          />
        </svg>
      ),
    },
    {
      to: "/owner/analytics",
      label: "Thống kê",
      icon: () => (
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          <path strokeWidth={1.8} strokeLinecap="round" d="M12 7v5l3 3" />
        </svg>
      ),
    },
    {
      to: "/owner/revenue",
      label: "Doanh thu",
      icon: () => (
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="5" width="18" height="14" rx="3" strokeWidth={1.8} />
          <path strokeWidth={1.8} d="M3 10h18M7 15h2m4 0h4" />
        </svg>
      ),
    },
    {
      to: "/owner/courts",
      label: "Sân",
      icon: () => (
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" strokeWidth={1.8} />
          <path strokeWidth={1.8} d="M3 12h18M12 4v16M8 8h8v8H8z" />
        </svg>
      ),
    },
    {
      to: "/owner/staff",
      label: "Nhân viên",
      icon: () => (
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="9" cy="8" r="4" strokeWidth={1.8} />
          <path
            strokeWidth={1.8}
            strokeLinecap="round"
            d="M2 19c0-3.5 3-6 7-6s7 2.5 7 6"
          />
          <circle cx="17" cy="9" r="3" strokeWidth={1.8} />
          <path
            strokeWidth={1.8}
            strokeLinecap="round"
            d="M19 14c2 .8 3 2.2 3 4"
          />
        </svg>
      ),
    },
    {
      to: "/owner/players",
      label: "Khách hàng",
      icon: () => (
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="8" r="4" strokeWidth={1.8} />
          <path
            strokeWidth={1.8}
            strokeLinecap="round"
            d="M4 20c0-3.8 3.6-6.5 8-6.5s8 2.7 8 6.5"
          />
        </svg>
      ),
    },
    {
      to: "/owner/tournaments",
      label: "Giải đấu",
      icon: () => (
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeWidth={1.8}
            d="M8 21h8m-4-4v4M5 4h14v5a7 7 0 0 1-14 0V4z"
          />
          <path
            strokeWidth={1.8}
            d="M5 6H3a2 2 0 0 0-2 2v1a4 4 0 0 0 4 4h0M19 6h2a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4h0"
          />
        </svg>
      ),
    },
    {
      to: "/owner/coaches",
      label: "Huấn luyện viên",
      icon: () => (
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
          <path strokeWidth={1.8} strokeLinecap="round" d="M12 7v5l3 2" />
        </svg>
      ),
    },
  ];

  // Các mục menu phụ phía dưới
  const bottomNavItems: NavItem[] = [
    {
      to: "/owner/settings",
      label: "Cài đặt",
      icon: () => (
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
          <path
            strokeWidth={1.8}
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
      ),
    },
    {
      to: "/owner/support",
      label: "Hỗ trợ",
      icon: () => (
        <svg
          className="w-5 h-5 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },
  ];

  const currentAvatar = getAvatarUrl(user?.avatarUrl);

  return (
    <aside
      className={`
        sticky top-4 h-[calc(100vh-2rem)] shrink-0
        transition-all duration-300 ease-in-out select-none
        ${isCollapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Hidden input để chọn file ảnh từ máy tính */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 1. Modal xem toàn cảnh ảnh đại diện */}
      <ImageViewerModal
        isOpen={isViewerOpen}
        imageUrl={currentAvatar}
        userName={user?.fullName || "Tim Darly"}
        userRole="Manager"
        onClose={() => setIsViewerOpen(false)}
        onChangePhoto={() => fileInputRef.current?.click()}
      />

      {/* 2. Modal cắt ảnh tùy chỉnh */}
      <ImageCropModal
        isOpen={isCropModalOpen}
        imageSrc={selectedImageSrc || ""}
        onClose={() => setIsCropModalOpen(false)}
        onConfirmCrop={handleConfirmCrop}
        isProcessing={isUploading}
      />

      {/* Container bo tròn nổi kiểu pill/card hiện đại (Khớp màu nền gốc #202230) */}
      <div className="h-full bg-[#202230] rounded-3xl p-4 flex flex-col justify-between shadow-2xl border border-slate-800/80">
        {/* Phần trên: Tiêu đề CLB và các Menu */}
        <div className="flex flex-col gap-6">
          {/* 1. Header Club Pill & Toggle Thu gọn */}
          <div className="flex items-center justify-between gap-2">
            {!isCollapsed ? (
              <div className="flex-1 bg-[#282a3c] hover:bg-[#303248] transition-colors rounded-2xl py-2 px-3 flex items-center justify-between shadow-inner cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src="/logo/logo.png"
                    alt="SportLink Logo"
                    className="w-7 h-7 object-contain shrink-0"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <span className="text-white text-sm font-bold tracking-tight truncate">
                    Sport<span className="text-[#3b82f6]">Link</span>
                  </span>
                </div>
                <span
                  title="Hệ thống đang hoạt động"
                  className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse ml-1"
                />
              </div>
            ) : (
              <div
                title="SportLink"
                className="w-10 h-10 mx-auto bg-[#282a3c] rounded-2xl flex items-center justify-center p-2 shadow-inner"
              >
                <img
                  src="/logo/logo.png"
                  alt="SportLink Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            )}

            {/* Nút thu gọn / mở rộng Sidebar */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
              className={`
                p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#2e3042] transition-colors cursor-pointer
                ${isCollapsed ? "hidden" : "block"}
              `}
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
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          {/* Nút mở rộng nổi lên khi Sidebar bị thu gọn */}
          {isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              title="Mở rộng sidebar"
              className="mx-auto p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#2e3042] transition-colors cursor-pointer"
            >
              <svg
                className="w-4 h-4 rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          {/* 2. Danh sách Menu chính */}
          <nav className="flex flex-col gap-1.5">
            {mainNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) => `
                  group relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200
                  ${
                    isActive
                      ? "bg-[#2c2e40] text-white shadow-md font-semibold"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#282a3c]/60"
                  }
                  ${isCollapsed ? "justify-center px-0" : ""}
                `}
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`transition-colors duration-200 ${
                        isActive
                          ? "text-white"
                          : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    >
                      {item.icon(isActive)}
                    </div>
                    {!isCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* 3. Menu phụ (Cài đặt & Hỗ trợ) */}
        <div className="flex flex-col gap-1 pt-4 border-t border-slate-800/80">
          <nav className="flex flex-col gap-1.5">
            {bottomNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) => `
                  group relative flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-sm font-medium transition-all duration-200
                  ${
                    isActive
                      ? "bg-[#2c2e40] text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#282a3c]/60"
                  }
                  ${isCollapsed ? "justify-center px-0" : ""}
                `}
              >
                {({ isActive }) => (
                  <>
                    <div
                      className={`transition-colors duration-200 ${
                        isActive
                          ? "text-white"
                          : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    >
                      {item.icon(isActive)}
                    </div>
                    {!isCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Thông báo lỗi upload nếu có */}
          {uploadError && (
            <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-300">
              {uploadError}
            </div>
          )}

          {/* 4. Thẻ thông tin cá nhân (Profile Card) */}
          <div className="relative mt-2" ref={userMenuRef}>
            <div
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`
                flex items-center gap-3 p-2 rounded-2xl hover:bg-[#282a3c] transition-colors cursor-pointer
                ${isCollapsed ? "justify-center" : "justify-between"}
              `}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Avatar hình tròn: Bấm để xem toàn cảnh ảnh */}
                <div
                  title="Bấm để xem ảnh toàn cảnh"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsViewerOpen(true);
                  }}
                  className="relative w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-700/80 bg-slate-800 flex items-center justify-center group/avatar cursor-pointer shadow-md"
                >
                  {currentAvatar ? (
                    <img
                      src={currentAvatar}
                      alt={user?.fullName || "Manager"}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : null}

                  {/* Fallback khi chưa có avatar hoặc ảnh lỗi */}
                  <span
                    className={`text-white font-bold text-sm ${
                      currentAvatar ? "hidden" : "block"
                    }`}
                  >
                    {(user?.fullName || "Tim Darly")[0].toUpperCase()}
                  </span>

                  {/* Overlay icon xem toàn cảnh khi hover */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="min-w-0 text-left">
                    <div className="text-sm font-semibold text-white truncate leading-tight">
                      {user?.fullName || "Tim Darly"}
                    </div>
                    <div className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1.5">
                      <span>Manager</span>
                      {uploadSuccess && (
                        <span className="text-[10px] text-emerald-400 font-medium">
                          ✓ Đã đổi ảnh
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!isCollapsed && (
                <svg
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    showUserMenu ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              )}
            </div>

            {/* Menu thả xuống khi click vào Profile (Dropdown) */}
            {showUserMenu && (
              <div
                className={`
                  absolute bottom-14 bg-[#282a3c] border border-slate-700/80 rounded-2xl shadow-2xl py-2 z-50 animate-fade-in
                  ${isCollapsed ? "left-16 w-56" : "left-0 right-0"}
                `}
              >
                <div className="px-4 py-2 border-b border-slate-700/60 text-xs text-slate-400">
                  Đăng nhập với email:
                  <br />
                  <span className="text-slate-200 font-medium truncate block">
                    {user?.email || "owner@sportlink.vn"}
                  </span>
                </div>

                {/* 1. Nút Xem Chi tiết ảnh đại diện */}
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    setIsViewerOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-300 hover:bg-[#343649] hover:text-white transition-colors text-left cursor-pointer"
                >
                  <span></span>
                  <span>Xem Chi tiết</span>
                </button>

                {/* 2. Nút Trang chủ */}

                <NavLink
                  to="/"
                  className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-300 hover:bg-[#343649] hover:text-white transition-colors"
                >
                  <span></span>
                  <span>Trang chủ</span>
                </NavLink>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors text-left cursor-pointer"
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
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span>Đăng xuất</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

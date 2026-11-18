import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { login, loginWithGoogle } from "./auth.api";
import {
  useAuthStore,
  type User,
  type UserRole,
} from "../../shared/stores/authStore";
import {
  initializeGoogleAuth,
  registerGoogleCallback,
  renderGoogleButton,
  promptGoogleSignIn,
  type GoogleCredentialResponse,
} from "../../shared/lib/googleAuth";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "581197430304-7l86rjqm50o58o91mn78jdoa349k9afc.apps.googleusercontent.com";

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, setAuth } = useAuthStore();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Nếu người dùng đã đăng nhập, tự động chuyển về trang ứng với vai trò đó
  useEffect(() => {
    if (isAuthenticated && user) {
      redirectByRole(user.role);
    }
  }, [isAuthenticated, user]);

  // Khởi tạo Google Identity Services (GSI) tập trung, an toàn với StrictMode
  useEffect(() => {
    let isMounted = true;

    // Đăng ký callback xử lý kết quả đăng nhập cho component
    const unregister = registerGoogleCallback((response) => {
      if (isMounted) {
        handleGoogleResponse(response);
      }
    });

    // Khởi tạo GIS duy nhất 1 lần và render nút đăng nhập
    initializeGoogleAuth(GOOGLE_CLIENT_ID)
      .then(() => {
        if (isMounted && googleBtnContainerRef.current) {
          renderGoogleButton(googleBtnContainerRef.current, {
            theme: "outline",
            size: "large",
            width: googleBtnContainerRef.current.clientWidth || 360,
            text: "continue_with",
            shape: "rectangular",
            logo_alignment: "center",
          });
        }
      })
      .catch((err) => {
        console.warn("Không thể tải Google Identity Services:", err);
      });

    return () => {
      isMounted = false;
      unregister();
    };
  }, []);

  /**
   * Xử lý kết quả trả về từ Google Identity Services
   */
  async function handleGoogleResponse(response: GoogleCredentialResponse) {
    if (!response || !response.credential) return;

    setLoading(true);
    setErrorMessage("");
    try {
      const res = await loginWithGoogle(response.credential);

      if (res && res.token) {
        const raw = res.data || {};
        const normalizedRole = (
          (raw.role || raw.Role || "player") as string
        ).toLowerCase() as UserRole;

        const authenticatedUser: User = {
          id: raw.id ?? raw.Id ?? 0,
          fullName: raw.fullName ?? raw.FullName ?? "Người dùng Google",
          email: raw.email ?? raw.Email ?? "",
          role: normalizedRole,
          avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? null,
        };

        setAuth(authenticatedUser, res.token);
        redirectByRole(authenticatedUser.role);
      } else {
        setErrorMessage(
          res.message || "Đăng nhập bằng Google không thành công.",
        );
      }
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setErrorMessage(
        errorObj.response?.data?.message ||
          "Không thể đăng nhập bằng Google. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }

  /**
   * Điều hướng người dùng về trang chức năng tương ứng với từng vai trò
   */
  function redirectByRole(role: UserRole) {
    switch (role) {
      case "owner":
        navigate("/owner", { replace: true });
        break;
      case "staff":
        navigate("/staff", { replace: true });
        break;
      case "player":
      default:
        navigate("/", { replace: true });
        break;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      setErrorMessage("Vui lòng nhập Email hoặc số điện thoại.");
      return;
    }

    if (!password) {
      setErrorMessage("Vui lòng nhập mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const response = await login({ email: cleanInput, password });

      if (response && response.token) {
        const raw = response.data || {};
        const normalizedRole = (
          (raw.role || raw.Role || "player") as string
        ).toLowerCase() as UserRole;

        const authenticatedUser: User = {
          id: raw.id ?? raw.Id ?? 0,
          fullName: raw.fullName ?? raw.FullName ?? cleanInput.split("@")[0],
          email: raw.email ?? raw.Email ?? cleanInput,
          role: normalizedRole,
          avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? null,
        };

        setAuth(authenticatedUser, response.token);
        redirectByRole(authenticatedUser.role);
      } else {
        setErrorMessage(
          response.message || "Đăng nhập không thành công. Vui lòng thử lại.",
        );
      }
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      if (errorObj.response?.status === 401) {
        setErrorMessage("Sai mật khẩu hoặc không có tài khoản.");
      } else if (errorObj.response?.data?.message) {
        setErrorMessage(errorObj.response.data.message);
      } else if (errorObj.message === "Network Error") {
        setErrorMessage("Hệ thống đang bảo trì. Vui lòng thử lại sau.");
      } else {
        setErrorMessage("Sai mật khẩu hoặc không có tài khoản.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative min-h-screen w-full flex flex-col lg:flex-row items-center justify-between overflow-x-hidden font-sans"
      style={{
        backgroundImage: `url('/nen.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* 1. Lớp phủ Gradient sâu & Viền sáng trang trí tạo chiều sâu thể thao */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#031533]/92 via-[#06204c]/80 to-[#0c2a59]/65 pointer-events-none" />

      {/* Các vệt sáng chéo phong cách SportLink (Translucent diagonal accent strips) */}
      <div className="absolute -top-32 left-1/4 w-[500px] h-[700px] -skew-x-[30deg] bg-gradient-to-b from-cyan-400/15 via-blue-500/10 to-transparent pointer-events-none hidden lg:block" />
      <div className="absolute -top-40 left-1/3 w-[300px] h-[800px] -skew-x-[30deg] bg-gradient-to-b from-blue-300/10 via-cyan-400/5 to-transparent pointer-events-none hidden lg:block" />

      {/* 2. Nền cong mềm mại màu sáng ở phía bên phải (Behind Login Card) */}
      <div className="absolute inset-y-0 right-0 w-full lg:w-[48%] xl:w-[45%] pointer-events-none hidden lg:block overflow-hidden">
        <svg
          className="w-full h-full object-cover"
          viewBox="0 0 500 900"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M150 0 C 80 300, 30 600, 0 900 L500 900 L500 0 Z"
            fill="#f4f7fb"
            className="opacity-95"
          />
        </svg>
      </div>

      {/* ========================================================= */}
      {/* CỘT TRÁI: THƯƠNG HIỆU, KHẨU HIỆU & 3 HUY HIỆU GIÁ TRỊ     */}
      {/* ========================================================= */}
      <div className="relative z-10 w-full lg:w-[52%] xl:w-[55%] flex flex-col justify-between p-8 sm:p-12 lg:p-16 min-h-[auto] lg:min-h-screen">
        {/* Logo SportLink góc trên bên trái */}
        <div className="flex items-center gap-3">
          <img
            src="/logo/logo.png"
            alt="SportLink Logo"
            className="h-10 w-auto object-contain filter drop-shadow-md"
          />
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow">
            Sport<span className="text-cyan-400">Link</span>
          </span>
        </div>

        {/* Khẩu hiệu chính ở giữa */}
        <div className="my-10 lg:my-auto max-w-xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.2] tracking-tight drop-shadow-lg">
            Kết nối sân thể thao
            <br />
            Lan tỏa <span className="text-cyan-400 italic">đam mê</span>
          </h1>

          <p className="mt-5 text-sm sm:text-base text-slate-200/90 font-medium flex items-center flex-wrap gap-2.5 drop-shadow">
            <span>Đặt sân nhanh chóng</span>
            <span className="text-cyan-400 text-xs">•</span>
            <span>Kết nối cộng đồng</span>
            <span className="text-cyan-400 text-xs">•</span>
            <span>Quản lý dễ dàng</span>
          </p>
        </div>

        {/* 3 Huy hiệu tính năng ở góc dưới bên trái */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-8 pt-4">
          {/* Huy hiệu 1: Đặt sân nhanh chóng */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/20 backdrop-blur-sm">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">
                Đặt sân
              </div>
              <div className="text-[11px] text-slate-300">nhanh chóng</div>
            </div>
          </div>

          {/* Huy hiệu 2: Kết nối cộng đồng thể thao */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 shadow-lg shadow-blue-500/20 backdrop-blur-sm">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">
                Kết nối cộng đồng
              </div>
              <div className="text-[11px] text-slate-300">thể thao</div>
            </div>
          </div>

          {/* Huy hiệu 3: Quản lý dễ dàng và an toàn */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/20 backdrop-blur-sm">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">
                Quản lý dễ dàng
              </div>
              <div className="text-[11px] text-slate-300">và an toàn</div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CỘT PHẢI: THẺ ĐĂNG NHẬP NỔI BO TRÒN TRẮNG SANG TRỌNG     */}
      {/* ========================================================= */}
      <div className="relative z-10 w-full lg:w-[48%] xl:w-[45%] flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-[440px] bg-white rounded-[32px] p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] border border-slate-100">
          {/* Thanh chuyển đổi Đăng nhập / Đăng ký */}
          <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center gap-1">
            <button
              type="button"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-default"
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
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>Đăng nhập</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("/register")}
              className="flex-1 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span>Đăng ký</span>
            </button>
          </div>
          {/* Tiêu đề & Lời chào */}
          <div className="text-center my-6">
            <h2 className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight">
              Chào mừng trở lại!
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Đăng nhập để tiếp tục sử dụng SportLink
            </p>
          </div>
          {/* Thông báo lỗi khi đăng nhập thất bại */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5 shadow-xs">
              <svg
                className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="flex-1 font-medium leading-snug">
                {errorMessage}
              </span>
              <button
                type="button"
                onClick={() => setErrorMessage("")}
                className="text-red-400 hover:text-red-600 transition-colors cursor-pointer text-base leading-none font-bold"
              >
                &times;
              </button>
            </div>
          )}
          {/* Form đăng nhập */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Input 1: Email hoặc số điện thoại */}
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Email hoặc số điện thoại"
                required
                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all shadow-xs"
              />
            </div>

            {/* Input 2: Mật khẩu */}
            <div className="relative flex items-center">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                required
                className="w-full pl-11 pr-11 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                {showPassword ? (
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
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  </svg>
                ) : (
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Hàng Nhớ tôi & Quên mật khẩu? */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-700">
                  Ghi nhớ
                </span>
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>

            {/* Nút Đăng nhập */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 focus:outline-none focus:ring-4 focus:ring-blue-200 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{loading ? "Đang xử lý..." : "Đăng nhập"}</span>
              {!loading && (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              )}
            </button>
          </form>
          {/* Phân cách hoặc */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200/80"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-slate-400 font-medium">
                hoặc
              </span>
            </div>
          </div>
          {/* Đăng nhập bằng Google */}
          <div className="relative w-full flex justify-center min-h-[44px]">
            <div
              ref={googleBtnContainerRef}
              className="w-full flex justify-center"
            >
              {/* Fallback & Custom styled Google button */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await promptGoogleSignIn();
                  } catch {
                    setErrorMessage(
                      "Đang kết nối dịch vụ Google... Vui lòng thử lại sau vài giây.",
                    );
                  }
                }}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-colors shadow-xs cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Đăng nhập bằng Google</span>
              </button>
            </div>
          </div>
          {/* Footer: Chưa có tài khoản? Đăng ký ngay */}
          <div className="mt-6 text-center text-xs text-slate-500">
            Chưa có tài khoản?{" "}
            <Link
              to="/register"
              className="font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors ml-1"
            >
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import { login, loginWithGoogle } from './auth.api';
import { useAuthStore, type User, type UserRole } from '../../shared/stores/authStore';

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '581197430304-7l86rjqm50o58o91mn78jdoa349k9afc.apps.googleusercontent.com';

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, setAuth } = useAuthStore();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Nếu người dùng đã đăng nhập, tự động chuyển về trang ứng với vai trò đó
  useEffect(() => {
    if (isAuthenticated && user) {
      redirectByRole(user.role);
    }
  }, [isAuthenticated, user]);

  // Khởi tạo Google Identity Services (GSI)
  useEffect(() => {
    function initGoogleSignIn() {
      const google = (window as unknown as { google?: any })?.google;
      if (google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
        });

        if (googleBtnContainerRef.current) {
          google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'outline',
            size: 'large',
            width: googleBtnContainerRef.current.clientWidth || 360,
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'center',
          });
        }
      }
    }

    if ((window as unknown as { google?: any })?.google?.accounts?.id) {
      initGoogleSignIn();
    } else {
      const interval = setInterval(() => {
        if ((window as unknown as { google?: any })?.google?.accounts?.id) {
          clearInterval(interval);
          initGoogleSignIn();
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, []);

  /**
   * Xử lý kết quả trả về từ Google Identity Services
   */
  async function handleGoogleResponse(response: { credential?: string }) {
    if (!response || !response.credential) return;

    setLoading(true);
    setErrorMessage('');
    try {
      const res = await loginWithGoogle(response.credential);

      if (res && res.token) {
        const raw = res.data || {};
        const normalizedRole = ((raw.role || raw.Role || 'player') as string).toLowerCase() as UserRole;

        const authenticatedUser: User = {
          id: raw.id ?? raw.Id ?? 0,
          fullName: raw.fullName ?? raw.FullName ?? 'Người dùng Google',
          email: raw.email ?? raw.Email ?? '',
          role: normalizedRole,
        };

        setAuth(authenticatedUser, res.token);
        redirectByRole(authenticatedUser.role);
      } else {
        setErrorMessage(res.message || 'Đăng nhập bằng Google không thành công.');
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorMessage(
        errorObj.response?.data?.message || 'Không thể đăng nhập bằng Google. Vui lòng thử lại.'
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
      case 'admin':
        navigate('/admin', { replace: true });
        break;
      case 'owner':
        navigate('/owner', { replace: true });
        break;
      case 'staff':
        navigate('/staff', { replace: true });
        break;
      case 'player':
      default:
        navigate('/', { replace: true });
        break;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');

    const cleanInput = identifier.trim();
    if (!cleanInput) {
      setErrorMessage('Vui lòng nhập Email hoặc số điện thoại.');
      return;
    }

    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const response = await login({ email: cleanInput, password });

      if (response && response.token) {
        const raw = response.data || {};
        const normalizedRole = ((raw.role || raw.Role || 'player') as string).toLowerCase() as UserRole;

        const authenticatedUser: User = {
          id: raw.id ?? raw.Id ?? 0,
          fullName: raw.fullName ?? raw.FullName ?? cleanInput.split('@')[0],
          email: raw.email ?? raw.Email ?? cleanInput,
          role: normalizedRole,
        };

        setAuth(authenticatedUser, response.token);
        redirectByRole(authenticatedUser.role);
      } else {
        setErrorMessage(response.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      if (errorObj.response?.status === 401) {
        setErrorMessage('Sai mật khẩu hoặc không có tài khoản.');
      } else if (errorObj.response?.data?.message) {
        setErrorMessage(errorObj.response.data.message);
      } else if (errorObj.message === 'Network Error') {
        setErrorMessage('Không thể kết nối đến máy chủ API. Vui lòng kiểm tra lại dịch vụ backend.');
      } else {
        setErrorMessage('Sai mật khẩu hoặc không có tài khoản.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Cột trái: Giới thiệu nền tảng SportLink (Nền tối gradient thể thao) */}
      <div className="lg:w-[50%] xl:w-[48%] hidden lg:flex flex-col justify-between p-12 xl:p-16 relative overflow-hidden bg-[#06101e]">
        {/* Vòng tròn hiệu ứng nền mờ (Decorative blur & glow rings) */}
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 right-0 w-[500px] h-[500px] border border-blue-900/30 rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 right-[-80px] w-[650px] h-[650px] border border-blue-900/20 rounded-full pointer-events-none" />

        {/* Nội dung phần trên */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-slate-300 backdrop-blur-sm shadow-sm mb-10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="tracking-wider uppercase text-[11px] font-semibold">
              Nền tảng thể thao toàn diện
            </span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.25] tracking-tight max-w-xl">
            Mỗi trận đấu đều bắt đầu từ một kết nối.
          </h1>

          <p className="mt-6 text-slate-400 text-base xl:text-lg leading-relaxed max-w-lg">
            SportLink giúp bạn tìm sân, tạo trận và kết nối với cộng đồng chơi thể thao quanh mình.
          </p>
        </div>

        {/* Thẻ tính năng mờ kính ở góc dưới (Glassmorphism feature card) */}
        <div className="relative z-10 mt-12 bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md max-w-md shadow-2xl">
          <h3 className="text-white font-semibold text-sm mb-4 tracking-wide">
            Tất cả cho trải nghiệm chơi tốt hơn
          </h3>
          <ul className="space-y-3.5 text-sm text-slate-300">
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Đặt sân nhanh chóng, minh bạch</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Tạo kèo và tìm đồng đội phù hợp</span>
            </li>
            <li className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span>Theo dõi lịch thi đấu trong một nơi</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Cột phải: Form Đăng nhập */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 xl:p-16 bg-white overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto py-6">
          {/* Logo SportLink */}
          <div className="flex items-center gap-3 mb-6">
            <img
              src="/logo/logo.png"
              alt="SportLink Logo"
              className="h-9 w-auto object-contain"
            />
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Sport<span className="text-blue-600">Link</span>
            </span>
          </div>

          {/* Hộp Form chính */}
          <div className="border border-slate-100 rounded-3xl p-6 sm:p-8 shadow-sm bg-white">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 mb-1.5 block">
              CHÀO MỪNG TRỞ LẠI
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-2">
              Đăng nhập SportLink
            </h2>
            <p className="text-sm text-slate-500 mb-6">
              Quản lý sân, kết nối đội chơi và chinh phục mọi trận đấu.
            </p>

            {/* Thông báo lỗi khi đăng nhập thất bại (giữ nguyên không bị biến mất) */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5 shadow-sm">
                <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="flex-1 font-medium leading-snug">{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage('')}
                  className="text-red-400 hover:text-red-600 transition-colors cursor-pointer text-lg leading-none font-bold px-1"
                  title="Đóng thông báo"
                >
                  &times;
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email / Số điện thoại */}
              <div>
                <label htmlFor="identifier" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email hoặc số điện thoại
                </label>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@sportlink.vn hoặc 0901..."
                  required
                  className="w-full px-4 py-2.5 bg-blue-50/40 hover:bg-blue-50/60 focus:bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Mật khẩu */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                    Mật khẩu
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    required
                    className="w-full px-4 pr-11 py-2.5 bg-blue-50/40 hover:bg-blue-50/60 focus:bg-white border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              </div>

              {/* Ghi nhớ đăng nhập */}
              <div className="flex items-center pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span>Ghi nhớ đăng nhập</span>
                </label>
              </div>

              {/* Nút Đăng nhập */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium rounded-xl shadow-md shadow-blue-600/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
              </button>
            </form>

            {/* Phân cách hoặc */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white text-slate-400">hoặc</span>
              </div>
            </div>

            {/* Đăng nhập với Google: Container chính thức của Google Identity Services */}
            <div className="w-full flex justify-center min-h-[44px]">
              <div ref={googleBtnContainerRef} className="w-full flex justify-center">
                {/* Fallback button trong lúc script Google đang nạp */}
                <button
                  type="button"
                  onClick={() => {
                    const google = (window as unknown as { google?: any })?.google;
                    if (google?.accounts?.id) {
                      google.accounts.id.prompt();
                    } else {
                      setErrorMessage('Đang kết nối dịch vụ Google... Vui lòng thử lại sau vài giây.');
                    }
                  }}
                  className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium text-sm flex items-center justify-center gap-3 transition-colors shadow-sm cursor-pointer"
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
                  <span>Tiếp tục với Google</span>
                </button>
              </div>
            </div>
          </div>

          {/* Chưa có tài khoản? Đăng ký ngay */}
          <div className="mt-6 text-center text-sm text-slate-500">
            Chưa có tài khoản?{' '}
            <Link
              to="/register"
              className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router';
import { register, loginWithGoogle } from './auth.api';
import {
  useAuthStore,
  type User,
  type UserRole,
} from '../../shared/stores/authStore';
import {
  initializeGoogleAuth,
  registerGoogleCallback,
  renderGoogleButton,
  promptGoogleSignIn,
  type GoogleCredentialResponse,
} from '../../shared/lib/googleAuth';

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '581197430304-7l86rjqm50o58o91mn78jdoa349k9afc.apps.googleusercontent.com';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, setAuth } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    let isMounted = true;
    const unregister = registerGoogleCallback((response) => {
      if (isMounted) handleGoogleResponse(response);
    });

    initializeGoogleAuth(GOOGLE_CLIENT_ID)
      .then(() => {
        if (isMounted && googleBtnContainerRef.current) {
          renderGoogleButton(googleBtnContainerRef.current, {
            theme: 'outline',
            size: 'large',
            width: googleBtnContainerRef.current.clientWidth || 360,
            text: 'signup_with',
            shape: 'rectangular',
            logo_alignment: 'center',
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      unregister();
    };
  }, []);

  async function handleGoogleResponse(response: GoogleCredentialResponse) {
    if (!response?.credential) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await loginWithGoogle(response.credential);
      if (res && res.token) {
        const raw = res.data || {};
        const normalizedRole = ((raw.role || raw.Role || 'player') as string).toLowerCase() as UserRole;
        const authenticatedUser: User = {
          id: raw.id ?? raw.Id ?? 0,
          fullName: raw.fullName ?? raw.FullName ?? 'Người chơi SportLink',
          email: raw.email ?? raw.Email ?? '',
          phone: raw.phone,
          role: normalizedRole,
          avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? null,
        };
        setAuth(authenticatedUser, res.token);
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(
        errorObj.response?.data?.message || 'Không thể đăng ký bằng Google. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
    }
  }

  // Đánh giá độ mạnh mật khẩu theo thời gian thực
  const passwordStrength = (() => {
    if (!password) return { level: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) || /[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { level: 1, label: 'Yếu (cần tối thiểu 6 ký tự)', color: 'bg-red-500' };
    if (score === 2) return { level: 2, label: 'Khá', color: 'bg-amber-500' };
    if (score === 3) return { level: 3, label: 'Mạnh', color: 'bg-blue-500' };
    return { level: 4, label: 'Rất mạnh', color: 'bg-emerald-500' };
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!fullName.trim()) {
      setErrorMessage('Vui lòng nhập Họ và tên của bạn.');
      return;
    }
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!cleanPhone || !/^(0|\+84)[0-9]{8,10}$/.test(cleanPhone)) {
      setErrorMessage('Vui lòng nhập Số điện thoại hợp lệ (10 chữ số, ví dụ: 0912345678).');
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage('Vui lòng nhập địa chỉ Email hợp lệ.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMessage('Mật khẩu phải có tối thiểu 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }
    if (!agreeTerms) {
      setErrorMessage('Vui lòng đồng ý với Điều khoản sử dụng & Chính sách đặt sân của SportLink.');
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        fullName: fullName.trim(),
        phone: cleanPhone,
        email: cleanEmail,
        password,
      });

      const raw = res.data || {};
      const token = res.token;

      if (token) {
        const authenticatedUser: User = {
          id: raw.id ?? raw.Id ?? 0,
          fullName: raw.fullName ?? raw.FullName ?? fullName.trim(),
          email: raw.email ?? raw.Email ?? cleanEmail,
          phone: raw.phone ?? cleanPhone,
          role: 'player',
          avatarUrl: null,
          reputationScore: 5.0,
        };
        setSuccessMessage('Đăng ký tài khoản thành công! Đang chuyển hướng vào trang chủ...');
        setTimeout(() => {
          setAuth(authenticatedUser, token);
          navigate('/', { replace: true });
        }, 700);
      } else {
        setSuccessMessage('Đăng ký tài khoản thành công! Đang chuyển sang trang đăng nhập...');
        setTimeout(() => navigate('/login'), 1000);
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorMessage(
        errorObj.response?.data?.message ||
          errorObj.message ||
          'Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative min-h-screen w-full flex flex-col lg:flex-row items-center justify-between overflow-x-hidden font-sans"
      style={{
        backgroundImage: `url('/nen.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-[#031533]/92 via-[#06204c]/80 to-[#0c2a59]/65 pointer-events-none" />

      <div className="absolute inset-y-0 right-0 w-full lg:w-[48%] xl:w-[45%] pointer-events-none hidden lg:block overflow-hidden">
        <svg className="w-full h-full object-cover" viewBox="0 0 500 900" fill="none" preserveAspectRatio="none">
          <path d="M150 0 C 80 300, 30 600, 0 900 L500 900 L500 0 Z" fill="#f4f7fb" className="opacity-95" />
        </svg>
      </div>

      {/* Cột trái: Thương hiệu SportLink */}
      <div className="relative z-10 w-full lg:w-[52%] xl:w-[55%] flex flex-col justify-between p-8 sm:p-12 lg:p-16 min-h-[auto] lg:min-h-screen">
        <Link to="/" className="flex items-center gap-3 w-fit">
          <img src="/logo/logo.png" alt="SportLink Logo" className="h-10 w-auto object-contain filter drop-shadow-md" />
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow">
            Sport<span className="text-cyan-400">Link</span>
          </span>
        </Link>

        <div className="my-8 lg:my-auto max-w-xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs font-bold mb-4">
            <span>⚽</span>
            <span>WBS 4.1 • Cộng đồng Người chơi Thể thao</span>
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.2] tracking-tight drop-shadow-lg">
            Gia nhập cộng đồng
            <br />
            Thể thao <span className="text-cyan-400 italic">SportLink</span>
          </h1>
          <p className="mt-5 text-sm sm:text-base text-slate-200/90 font-medium leading-relaxed">
            Tạo tài khoản miễn phí chỉ trong 30 giây để tìm sân quanh bạn, chọn nhiều khung giờ vào giỏ đặt sân với báo giá động minh bạch và nhận ngay <strong>5.0★ điểm uy tín</strong> khởi đầu.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 sm:gap-8 pt-4 text-white text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-bold">
              ✓
            </span>
            <span>Tặng 5.0★ Điểm uy tín</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold">
              ⚡
            </span>
            <span>Giỏ đặt sân đa khung giờ</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-300 font-bold">
              🛡️
            </span>
            <span>Hoàn tiền minh bạch</span>
          </div>
        </div>
      </div>

      {/* Cột phải: Thẻ Đăng ký */}
      <div className="relative z-10 w-full lg:w-[48%] xl:w-[45%] flex items-center justify-center p-4 sm:p-8 lg:p-10">
        <div className="w-full max-w-[460px] bg-white rounded-[32px] p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] border border-slate-100">
          {/* Thanh chuyển đổi Đăng nhập / Đăng ký */}
          <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="flex-1 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>Đăng nhập</span>
            </button>
            <button
              type="button"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-default"
            >
              <span>Đăng ký tài khoản</span>
            </button>
          </div>

          <div className="text-center my-5">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Tạo tài khoản Người chơi
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Điền thông tin bên dưới để bắt đầu đặt sân trên SportLink
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5">
              <span className="font-bold">⚠️</span>
              <span className="flex-1 font-medium">{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="text-red-400 hover:text-red-600 font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs sm:text-sm font-semibold flex items-center gap-2">
              <span>✅</span>
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn Cầu Thủ"
                required
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0912345678"
                  required
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="player@sportlink.vn"
                  required
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    required
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Xác nhận mật khẩu *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                    required
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Thanh đo độ mạnh mật khẩu & nút hiện mật khẩu */}
            <div className="flex items-center justify-between text-xs pt-0.5">
              {password ? (
                <div className="flex items-center gap-2 flex-1 mr-4">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`flex-1 h-full transition-all ${
                          step <= passwordStrength.level ? passwordStrength.color : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600">
                    {passwordStrength.label}
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">Mật khẩu tối thiểu 6 ký tự</span>
              )}

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer shrink-0"
              >
                {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              </button>
            </div>

            <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                Tôi đồng ý với <strong>Điều khoản dịch vụ</strong>, <strong>Quy định đặt sân</strong> và{' '}
                <strong>Chính sách hoàn tiền</strong> của nền tảng SportLink.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm disabled:opacity-60"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              <span>{loading ? 'Đang khởi tạo tài khoản...' : 'Đăng ký tài khoản ngay'}</span>
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200/80" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white text-slate-400 font-medium">hoặc đăng ký nhanh</span>
            </div>
          </div>

          <div className="relative w-full flex justify-center min-h-[42px]">
            <div ref={googleBtnContainerRef} className="w-full flex justify-center">
              <button
                type="button"
                onClick={() => promptGoogleSignIn().catch(() => {})}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-3 transition-colors cursor-pointer"
              >
                <span>Đăng ký nhanh bằng Google</span>
              </button>
            </div>
          </div>

          <div className="mt-5 text-center text-xs text-slate-500">
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700 hover:underline ml-1">
              Đăng nhập ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

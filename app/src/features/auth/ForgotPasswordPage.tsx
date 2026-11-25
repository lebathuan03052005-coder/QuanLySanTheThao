import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  forgotPasswordApi,
  resetPasswordApi,
  type ForgotPasswordResponse,
} from './auth.api';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [otpInfo, setOtpInfo] = useState<ForgotPasswordResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const cleanId = identifier.trim();
    if (!cleanId) {
      setErrorMessage('Vui lòng nhập Email hoặc Số điện thoại đã đăng ký tài khoản.');
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPasswordApi(cleanId);
      setOtpInfo(res.data);
      setSuccessMessage(res.message);
      setStep(2);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorMessage(
        errorObj.response?.data?.message ||
          'Không tìm thấy tài khoản khớp với Email hoặc Số điện thoại này.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!otp.trim() || otp.trim().length < 4) {
      setErrorMessage('Vui lòng nhập mã xác thực OTP 6 chữ số.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPasswordApi({
        identifier: identifier.trim(),
        otp: otp.trim(),
        newPassword,
      });
      setSuccessMessage(res.message);
      setStep(3);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorMessage(
        errorObj.response?.data?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn.'
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

      {/* Cột trái */}
      <div className="relative z-10 w-full lg:w-[52%] xl:w-[55%] flex flex-col justify-between p-8 sm:p-12 lg:p-16 min-h-[auto] lg:min-h-screen">
        <Link to="/" className="flex items-center gap-3 w-fit">
          <img src="/logo/logo.png" alt="SportLink Logo" className="h-10 w-auto object-contain filter drop-shadow-md" />
          <span className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow">
            Sport<span className="text-cyan-400">Link</span>
          </span>
        </Link>

        <div className="my-8 lg:my-auto max-w-xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-300 text-xs font-bold mb-4">
            <span>🔐</span>
            <span>WBS 4.1 • Trung tâm Bảo mật Tài khoản</span>
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-[1.2] tracking-tight drop-shadow-lg">
            Khôi phục mật khẩu
            <br />
            An toàn & <span className="text-cyan-400 italic">Tức thì</span>
          </h1>
          <p className="mt-5 text-sm sm:text-base text-slate-200/90 font-medium leading-relaxed">
            Hệ thống xác thực OTP 6 chữ số giúp bạn lấy lại quyền truy cập tài khoản nhanh chóng qua Email hoặc Số điện thoại đã đăng ký.
          </p>
        </div>

        <div className="text-xs text-slate-300">
          Bảo mật 2 lớp với mã hóa Bcrypt (12 Salt Rounds) & JWT Token.
        </div>
      </div>

      {/* Cột phải: Thẻ Khôi phục mật khẩu 3 bước */}
      <div className="relative z-10 w-full lg:w-[48%] xl:w-[45%] flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-[450px] bg-white rounded-[32px] p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] border border-slate-100">
          {/* Stepper 3 bước */}
          <div className="flex items-center justify-between mb-6 px-2">
            {[
              { num: 1, title: 'Tài khoản' },
              { num: 2, title: 'Mã OTP & Mật khẩu' },
              { num: 3, title: 'Hoàn tất' },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-all ${
                    step === s.num
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                      : step > s.num
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {step > s.num ? '✓' : s.num}
                </div>
                <span
                  className={`text-xs font-bold ${
                    step >= s.num ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  {s.title}
                </span>
              </div>
            ))}
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-slate-900">
              {step === 1
                ? 'Quên mật khẩu?'
                : step === 2
                ? 'Xác thực OTP & Đặt mật khẩu'
                : 'Khôi phục thành công!'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              {step === 1
                ? 'Nhập Email hoặc Số điện thoại để nhận mã xác thực 6 chữ số'
                : step === 2
                ? `Mã OTP đã được cấp cho tài khoản ${otpInfo?.fullName || identifier}`
                : 'Mật khẩu mới của bạn đã được kích hoạt an toàn'}
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2">
              <span>⚠️</span>
              <span className="flex-1 font-medium">{errorMessage}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email hoặc Số điện thoại đã đăng ký *
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Ví dụ: player@sportlink.vn hoặc 0905000001"
                  required
                  className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all text-sm cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Đang kiểm tra & gửi mã OTP...' : 'Nhận mã xác thực OTP →'}
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* Hộp hiển thị mã OTP Sandbox phục vụ kiểm thử trực tiếp */}
              {otpInfo?.sandboxOtp && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-xs text-amber-900">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">📬 Mã OTP Sandbox (Hiệu lực 10 phút):</span>
                    <button
                      type="button"
                      onClick={() => setOtp(otpInfo.sandboxOtp)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] cursor-pointer"
                    >
                      Điền nhanh OTP
                    </button>
                  </div>
                  <div className="mt-1.5 font-mono text-lg font-black tracking-widest text-amber-800">
                    {otpInfo.sandboxOtp}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mã xác thực OTP (6 chữ số) *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="Nhập 6 chữ số OTP"
                  required
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 font-mono text-base tracking-widest font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mật khẩu mới *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  required
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  required
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-800 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                >
                  ← Đổi tài khoản khác
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  {showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all text-sm cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Đang cập nhật mật khẩu...' : 'Xác nhận đặt lại mật khẩu'}
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="text-center space-y-5 py-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl font-bold">
                ✓
              </div>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                {successMessage || 'Mật khẩu tài khoản của bạn đã được cập nhật thành công!'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/30 transition-all text-sm cursor-pointer"
              >
                Đi tới trang Đăng nhập ngay →
              </button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
            Nhớ lại mật khẩu?{' '}
            <Link to="/login" className="font-bold text-blue-600 hover:underline ml-1">
              Quay lại Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  getProfile,
  updateProfileApi,
  changePasswordApi,
  uploadAvatarApi,
  type PlayerProfileData,
} from './auth.api';
import { getPlayerBookingsApi, type PlayerBookingItem } from '../booking/booking.api';
import { useAuthStore } from '../../shared/stores/authStore';
import { formatCurrency } from '../../shared/utils/format';
import ImageCropModal from '../../shared/components/ImageCropModal';
import ImageViewerModal from '../../shared/components/ImageViewerModal';

const ALL_SPORTS = ['Bóng đá', 'Cầu lông', 'Pickleball', 'Tennis', 'Bóng rổ', 'Bóng chuyền'];

export default function PlayerProfilePage() {
  const navigate = useNavigate();
  const { user, token, updateUserAvatar, updateUserInfo } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'info' | 'security' | 'upcoming'>('info');
  const [profile, setProfile] = useState<PlayerProfileData | null>(null);
  const [bookings, setBookings] = useState<PlayerBookingItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form hồ sơ cá nhân
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteSports, setFavoriteSports] = useState<string[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);

  // Form đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Thông báo
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Quản lý cắt & xem ảnh đại diện
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      navigate('/login');
      return;
    }
    loadProfileData();
  }, [token]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  function getAvatarUrl(url?: string | null): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const backendBase = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(
      /\/api\/?$/,
      ''
    );
    return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  async function loadProfileData() {
    setLoading(true);
    try {
      const [profData, bkData] = await Promise.all([
        getProfile(),
        getPlayerBookingsApi().catch(() => []),
      ]);
      if (profData) {
        setProfile(profData);
        setFullName(profData.fullName || '');
        setPhone(profData.phone || '');
        setGender(profData.gender || '');
        setDob(profData.dob || '');
        setAddress(profData.address || '');
        setBio(profData.bio || '');
        setFavoriteSports(
          Array.isArray(profData.favoriteSports) && profData.favoriteSports.length > 0
            ? profData.favoriteSports
            : ['Bóng đá', 'Cầu lông', 'Pickleball']
        );
      }
      if (Array.isArray(bkData)) {
        setBookings(bkData);
      }
    } catch {
      setErrorMsg('Không thể tải thông tin hồ sơ người chơi.');
    } finally {
      setLoading(false);
    }
  }

  function toggleFavoriteSport(sport: string) {
    setFavoriteSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!fullName.trim()) {
      setErrorMsg('Họ và tên không được để trống.');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await updateProfileApi({
        fullName: fullName.trim(),
        phone: phone.trim(),
        gender,
        dob: dob || null,
        address: address.trim(),
        bio: bio.trim(),
        favoriteSports,
      });
      if (res.data) {
        setProfile(res.data);
        updateUserInfo({
          fullName: res.data.fullName,
          phone: res.data.phone,
        });
      }
      showToast('Đã lưu thông tin hồ sơ cá nhân thành công!');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMsg(errorObj.response?.data?.message || 'Cập nhật hồ sơ thất bại.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorMsg('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setSavingPassword(true);
    try {
      const res = await changePasswordApi({
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showToast(res.message || 'Đổi mật khẩu thành công!');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMsg(errorObj.response?.data?.message || 'Mật khẩu hiện tại không đúng.');
    } finally {
      setSavingPassword(false);
    }
  }

  function handleSelectAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WEBP).');
      return;
    }
    setCropSrc(URL.createObjectURL(file));
    setIsCropOpen(true);
    e.target.value = '';
  }

  async function handleConfirmAvatarCrop(croppedFile: File) {
    setUploadingAvatar(true);
    try {
      const res = await uploadAvatarApi(croppedFile);
      if (res?.data?.avatarUrl) {
        updateUserAvatar(res.data.avatarUrl);
        setProfile((prev) => (prev ? { ...prev, avatarUrl: res.data.avatarUrl } : prev));
        showToast('Cập nhật ảnh đại diện thành công!');
      }
      setIsCropOpen(false);
      setCropSrc(null);
    } catch {
      setErrorMsg('Không thể tải ảnh đại diện lên máy chủ.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  const upcomingBookingsList = bookings.filter(
    (b) => ['PENDING', 'CONFIRMED', 'CHECKED-IN'].includes(b.status)
  );
  const avatarDisplay = getAvatarUrl(profile?.avatarUrl || user?.avatarUrl);
  const initialLetter = (profile?.fullName || user?.fullName || 'P').charAt(0).toUpperCase();

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {toastMsg && (
        <div className="fixed top-20 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-bold flex items-center gap-2">
          <span>✓</span>
          <span>{toastMsg}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelectAvatarFile}
      />

      {/* Breadcrumb */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link to="/" className="hover:text-blue-600 font-medium">
              Trang chủ
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-bold">Hồ sơ người chơi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            Hồ Sơ Cá Nhân & Hoạt Động Thi Đấu
          </h1>
        </div>
        <Link
          to="/bookings"
          className="px-4 py-2.5 rounded-xl bg-black hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
        >
          📅 Lịch đặt sân của tôi →
        </Link>
      </div>

      {/* Hero Profile Banner */}
      <div className="mt-6 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-[#06204c] via-[#0c387a] to-[#1d63ed] relative">
          <div className="absolute right-6 top-4 flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-white text-xs font-bold border border-white/20">
              🏅 {profile?.stats?.memberTier || 'Thành viên Thân thiết'}
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-400 text-black text-xs font-black shadow-xs">
              ★ {(profile?.reputationScore ?? 5.0).toFixed(1)} Điểm uy tín
            </span>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="relative group w-24 h-24 rounded-full border-4 border-white shadow-lg bg-[#0c2f68] overflow-hidden shrink-0">
              {avatarDisplay ? (
                <img
                  src={avatarDisplay}
                  alt={fullName}
                  onClick={() => setIsViewerOpen(true)}
                  className="w-full h-full object-cover cursor-pointer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-3xl font-black">
                  {initialLetter}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-x-0 bottom-0 bg-black/70 text-white text-[10px] font-bold py-1 text-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
              >
                📷 Đổi ảnh
              </button>
            </div>

            <div className="pt-2 sm:pt-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  {profile?.fullName || user?.fullName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                  {profile?.role || user?.role || 'PLAYER'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                📧 {profile?.email || user?.email} • 📞 {profile?.phone || 'Chưa cập nhật SĐT'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 cursor-pointer"
            >
              📷 Tải & Cắt ảnh đại diện
            </button>
          </div>
        </div>
      </div>

      {/* 4 Thẻ KPI Thống kê hoạt động Người chơi */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Tổng số lượt đặt sân</span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {profile?.stats?.totalBookings ?? bookings.length} <span className="text-xs font-normal text-slate-400">lượt</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Lịch thi đấu sắp tới</span>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {profile?.stats?.upcomingBookings ?? upcomingBookingsList.length} <span className="text-xs font-normal text-slate-400">trận</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Trận đã hoàn thành</span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {profile?.stats?.completedBookings ?? 0} <span className="text-xs font-normal text-slate-400">trận</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500">Tổng chi tiêu đặt sân</span>
          <div className="text-xl sm:text-2xl font-black text-indigo-600 mt-1">
            {formatCurrency(profile?.stats?.totalSpent ?? 0)}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-5 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-medium flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Thanh chuyển Tab */}
      <div className="mt-6 flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'info', label: '👤 Thông tin cá nhân & Môn yêu thích' },
          { id: 'security', label: '🔐 Bảo mật & Đổi mật khẩu' },
          { id: 'upcoming', label: `📅 Lịch sắp tới (${upcomingBookingsList.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as 'info' | 'security' | 'upcoming')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeTab === t.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Nội dung Tab 1: Thông tin cá nhân */}
      {activeTab === 'info' && (
        <form
          onSubmit={handleSaveProfile}
          className="mt-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xs space-y-5"
        >
          <div>
            <h3 className="text-lg font-black text-slate-900">Cập nhật Hồ sơ Người chơi</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Thông tin Họ tên và Số điện thoại được tự động điền sẵn khi bạn đặt sân hoặc tham gia cáp kèo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên *</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại liên hệ *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912345678"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Giới tính</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Chọn giới tính --</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày sinh</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ khu vực thường chơi</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ví dụ: Phường Hiệp Phú, TP. Thủ Đức, TP.HCM"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Các môn thể thao yêu thích
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_SPORTS.map((sp) => {
                const selected = favoriteSports.includes(sp);
                return (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => toggleFavoriteSport(sp)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      selected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '}
                    {sp}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Giới thiệu bản thân / Trình độ & Vị trí sở trường
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Ví dụ: Đá tiền vệ trụ sân 5/7, trình độ Cầu lông phong trào TB+, hay rảnh tối T3-T5-CN..."
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={savingProfile || loading}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {savingProfile ? 'Đang lưu hồ sơ...' : '💾 Lưu thông tin hồ sơ'}
            </button>
          </div>
        </form>
      )}

      {/* Nội dung Tab 2: Đổi mật khẩu */}
      {activeTab === 'security' && (
        <form
          onSubmit={handleSavePassword}
          className="mt-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xs max-w-xl space-y-4"
        >
          <div>
            <h3 className="text-lg font-black text-slate-900">Đổi mật khẩu tài khoản</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Sử dụng mật khẩu tối thiểu 6 ký tự để bảo vệ tài khoản của bạn.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mật khẩu hiện tại
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Nhập mật khẩu đang sử dụng"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Mật khẩu mới *
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Xác nhận mật khẩu mới *
            </label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              required
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={savingPassword}
              className="px-6 py-2.5 rounded-xl bg-black hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition cursor-pointer disabled:opacity-50"
            >
              {savingPassword ? 'Đang cập nhật...' : '🔐 Cập nhật mật khẩu'}
            </button>
          </div>
        </form>
      )}

      {/* Nội dung Tab 3: Lịch thi đấu sắp tới */}
      {activeTab === 'upcoming' && (
        <div className="mt-6 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-slate-900">
              Lịch đặt sân sắp tới ({upcomingBookingsList.length})
            </h3>
            <Link
              to="/bookings"
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Xem toàn bộ lịch sử & hoàn tiền →
            </Link>
          </div>

          {upcomingBookingsList.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              Bạn chưa có lịch đặt sân nào sắp tới.{' '}
              <Link to="/courts" className="text-blue-600 font-bold hover:underline">
                Tìm sân đặt ngay →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingBookingsList.slice(0, 6).map((b) => (
                <div
                  key={b.booking_id}
                  className="p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-300 transition"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-600">
                        #SPL-{b.booking_id}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700">
                        {b.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mt-1">
                      {b.court_name} ({b.facility_name || 'SportLink'})
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      📅 Ngày {b.booking_date} • ⏰ {b.start_time} - {b.end_time}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-slate-900">
                      {formatCurrency(b.total_price)}
                    </div>
                    <Link
                      to="/bookings"
                      className="inline-block mt-1 text-xs font-bold text-blue-600 hover:underline"
                    >
                      Chi tiết / Thanh toán →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isCropOpen && cropSrc && (
        <ImageCropModal
          isOpen={isCropOpen}
          imageSrc={cropSrc}
          isProcessing={uploadingAvatar}
          initialAspect={1}
          initialShape="round"
          onClose={() => {
            setIsCropOpen(false);
            setCropSrc(null);
          }}
          onConfirmCrop={handleConfirmAvatarCrop}
        />
      )}

      {isViewerOpen && avatarDisplay && (
        <ImageViewerModal
          isOpen={isViewerOpen}
          imageUrl={avatarDisplay}
          userName={profile?.fullName || user?.fullName || 'Người chơi'}
          userRole="Ảnh đại diện Người chơi"
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </div>
  );
}

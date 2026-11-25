import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  getMyBookingsApi,
  cancelBookingWithRefundApi,
  type PlayerBookingItem,
} from './booking.api';
import PaymentSandboxModal from './PaymentSandboxModal';
import { useAuthStore } from '../../shared/stores/authStore';
import { formatCurrency } from '../../shared/utils/format';

const STATUS_TABS = [
  { key: 'ALL', label: 'Tất cả đơn' },
  { key: 'HOLD', label: 'Đang giữ chỗ' },
  { key: 'PENDING', label: 'Chờ xác nhận' },
  { key: 'CONFIRMED', label: 'Đã xác nhận' },
  { key: 'CHECKED-IN', label: 'Đang chơi' },
  { key: 'COMPLETED', label: 'Hoàn thành' },
  { key: 'CANCELLED', label: 'Đã hủy / Hoàn tiền' },
] as const;

const CANCEL_PRESETS = [
  'Bận công việc đột xuất không thể ra sân',
  'Thời tiết xấu / Mưa lớn',
  'Muốn đổi sang khung giờ hoặc ngày khác',
  'Đội chưa gom đủ người chơi',
];

function getStatusBadge(status: string) {
  const s = (status || 'PENDING').toUpperCase();
  switch (s) {
    case 'HOLD':
      return {
        label: '⏳ Đang giữ chỗ (10 phút)',
        cls: 'bg-amber-50 text-amber-800 border-amber-300',
      };
    case 'EXPIRED':
      return {
        label: '⌛ Hết hạn giữ chỗ',
        cls: 'bg-gray-100 text-gray-600 border-gray-300',
      };
    case 'CONFIRMED':
      return {
        label: '✓ Đã xác nhận sân',
        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'CHECKED-IN':
      return {
        label: '🏃 Đang nhận sân thi đấu',
        cls: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    case 'COMPLETED':
      return {
        label: '★ Đã hoàn thành',
        cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    case 'CANCELLED':
      return {
        label: '✕ Đã hủy lịch',
        cls: 'bg-red-50 text-red-700 border-red-200',
      };
    case 'NO-SHOW':
      return {
        label: '⚠ Không đến (No-show)',
        cls: 'bg-gray-100 text-gray-700 border-gray-300',
      };
    default:
      return {
        label: '⏳ Chờ thanh toán / Xác nhận',
        cls: 'bg-amber-50 text-amber-800 border-amber-200',
      };
  }
}

function getPaymentBadge(paymentStatus: string, method?: string | null) {
  const p = (paymentStatus || 'UNPAID').toUpperCase();
  const methodTag = method ? ` (${method})` : '';
  switch (p) {
    case 'PAID':
      return {
        label: `💳 Đã thanh toán 100%${methodTag}`,
        cls: 'bg-emerald-100/80 text-emerald-800 border-emerald-300',
      };
    case 'DEPOSIT_PAID':
      return {
        label: `💰 Đã đặt cọc${methodTag}`,
        cls: 'bg-blue-100/80 text-blue-800 border-blue-300',
      };
    case 'REFUNDED':
      return {
        label: `↩ Đã hoàn tiền${methodTag}`,
        cls: 'bg-purple-100 text-purple-800 border-purple-300',
      };
    default:
      return {
        label: 'Chưa thanh toán',
        cls: 'bg-gray-100 text-gray-600 border-gray-200',
      };
  }
}

export default function PlayerBookingsPage() {
  const { user, token } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetBookingId = Number(searchParams.get('bookingId') || 0);

  const [bookings, setBookings] = useState<PlayerBookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState<number | null>(null);

  // Bộ lọc
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sportFilter, setSportFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  // Modal Thanh toán Sandbox / VietQR (S3-08 & S3-09)
  const [paymentModalBooking, setPaymentModalBooking] = useState<PlayerBookingItem | null>(null);
  const [paymentModalInitialTab, setPaymentModalInitialTab] = useState<'VNPAY' | 'MOMO' | 'VIETQR'>('VNPAY');

  // Modal Xem biên lai & lịch sử giao dịch (S3-10)
  const [receiptBooking, setReceiptBooking] = useState<PlayerBookingItem | null>(null);

  // Modal Hủy đặt sân & Hoàn tiền tự động (S3-10)
  const [cancelTarget, setCancelTarget] = useState<PlayerBookingItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>(CANCEL_PRESETS[0]);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  async function loadBookings() {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getMyBookingsApi();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Không thể tải danh sách lịch đặt sân.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings();
  }, [token]);

  // Tự động cuộn và làm nổi bật đơn đặt sân khi đi từ thông báo (?bookingId=...)
  useEffect(() => {
    if (!targetBookingId || loading || bookings.length === 0) return;

    const found = bookings.find((b) => b.booking_id === targetBookingId);
    if (!found) return;

    setStatusFilter('ALL');
    setSportFilter('ALL');
    setDateFilter('');
    setSearchKeyword('');
    setHighlightedBookingId(targetBookingId);

    const scrollTimer = window.setTimeout(() => {
      const el = document.getElementById(`booking-card-${targetBookingId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);

    // Xóa param trên URL để tránh mở/cuộn lại khi reload thủ công, giữ highlight trong 7s
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('bookingId');
    setSearchParams(nextParams, { replace: true });

    const clearTimer = window.setTimeout(() => {
      setHighlightedBookingId((cur) => (cur === targetBookingId ? null : cur));
    }, 7000);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [targetBookingId, loading, bookings]);

  // Danh sách các môn thể thao có trong lịch sử đặt
  const availableSports = useMemo(() => {
    const set = new Set<string>();
    bookings.forEach((b) => {
      if (b.sport_name) set.add(b.sport_name);
    });
    return Array.from(set);
  }, [bookings]);

  // Lọc danh sách đơn đặt sân
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter !== 'ALL' && (b.status || '').toUpperCase() !== statusFilter) {
        return false;
      }
      if (sportFilter !== 'ALL' && b.sport_name !== sportFilter) {
        return false;
      }
      if (dateFilter && b.booking_date !== dateFilter) {
        return false;
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        const text = `#spl-${b.booking_id} ${b.booking_id} ${b.court_name || ''} ${
          b.facility_name || ''
        } ${b.sport_name || ''} ${b.court_address || ''}`.toLowerCase();
        if (!text.includes(kw)) return false;
      }
      return true;
    });
  }, [bookings, statusFilter, sportFilter, dateFilter, searchKeyword]);

  // Chỉ số KPI thống kê cho người chơi
  const kpiStats = useMemo(() => {
    const totalCount = bookings.length;
    const activeUpcomingCount = bookings.filter((b) =>
      ['HOLD', 'PENDING', 'CONFIRMED', 'CHECKED-IN'].includes((b.status || '').toUpperCase())
    ).length;
    const totalSpent = bookings.reduce(
      (sum, b) => sum + Math.max(0, Number(b.paid_amount || 0) - Number(b.refunded_amount || 0)),
      0
    );
    const totalRefunded = bookings.reduce(
      (sum, b) => sum + Number(b.refunded_amount || 0),
      0
    );
    return { totalCount, activeUpcomingCount, totalSpent, totalRefunded };
  }, [bookings]);

  // Kiểm tra đơn có thể hủy bởi người chơi không
  function canCancelBooking(b: PlayerBookingItem) {
    const s = (b.status || '').toUpperCase();
    if (!['HOLD', 'PENDING', 'CONFIRMED'].includes(s)) return false;
    const slotStart = new Date(`${b.booking_date}T${b.start_time}:00`);
    return slotStart.getTime() > Date.now();
  }

  // Ước tính chính sách hoàn tiền khi mở Modal Hủy
  function getRefundEstimate(b: PlayerBookingItem) {
    const netPaid = Math.max(0, Number(b.paid_amount || 0) - Number(b.refunded_amount || 0));
    const slotStart = new Date(`${b.booking_date}T${b.start_time}:00`);
    const hoursUntilStart = (slotStart.getTime() - Date.now()) / (1000 * 60 * 60);
    const isPending = (b.status || '').toUpperCase() === 'PENDING';
    const rate = isPending || hoursUntilStart >= 2 ? 1.0 : 0.7;
    const refundAmount = Math.round(netPaid * rate);
    return {
      netPaid,
      hoursUntilStart,
      rate,
      refundAmount,
    };
  }

  async function handleConfirmCancel(e: React.FormEvent) {
    e.preventDefault();
    if (!cancelTarget) return;

    setCancelling(true);
    setCancelError(null);
    try {
      const res = await cancelBookingWithRefundApi(
        cancelTarget.booking_id,
        cancelReason.trim() || 'Người chơi chủ động hủy lịch đặt sân'
      );
      setBannerMsg(res.message || `Đã hủy đơn #SPL-${cancelTarget.booking_id} thành công.`);
      setCancelTarget(null);
      await loadBookings();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setCancelError(
        errorObj.response?.data?.message || 'Không thể hủy đơn đặt sân này.'
      );
    } finally {
      setCancelling(false);
    }
  }

  if (!token || !user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-sm border border-gray-100 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-3xl">
            📅
          </div>
          <h2 className="text-xl font-black text-gray-900">
            Đăng nhập để quản lý Lịch đặt sân & Biên lai thanh toán
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Theo dõi các sân đã đặt, thanh toán trực tuyến qua cổng Sandbox (VNPay / MoMo), quét mã
            VietQR dự phòng hoặc hủy lịch & nhận hoàn tiền tự động.
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1d63ed] text-white text-sm font-bold hover:bg-blue-700 transition shadow-sm"
            >
              Đăng nhập ngay →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              WBS 4.3 · Sprint 3
            </span>
            <span className="text-xs text-gray-400">
              Xin chào, <strong className="text-gray-700">{user.fullName}</strong>
            </span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mt-1">
            Lịch Sử Đặt Sân, Thanh Toán & Hoàn Tiền
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Quản lý toàn bộ lịch đặt sân trực tuyến, thanh toán qua cổng Sandbox / VietQR dự phòng và đối soát biên lai hoàn tiền minh bạch.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadBookings}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition cursor-pointer"
          >
            ↻ Làm mới
          </button>
          <Link
            to="/courts"
            className="px-5 py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold transition shadow-xs"
          >
            + Đặt sân mới
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-500">Tổng số đơn đặt sân</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{kpiStats.totalCount} đơn</p>
          <span className="text-[11px] text-gray-400 mt-1 block">
            Lưu trữ đầy đủ lịch sử & biên lai
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-500">Lịch sắp tới / Đang hiệu lực</span>
          <p className="text-2xl font-black text-blue-600 mt-1">
            {kpiStats.activeUpcomingCount} ca đặt
          </p>
          <span className="text-[11px] text-blue-600/80 mt-1 block">
            Sẵn sàng ra sân thi đấu
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-500">Tổng chi tiêu thực tế</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {formatCurrency(kpiStats.totalSpent)}
          </p>
          <span className="text-[11px] text-gray-400 mt-1 block">
            Đã đối soát qua Sandbox / VietQR
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
          <span className="text-xs font-semibold text-gray-500">Tổng tiền đã hoàn trả (REFUND)</span>
          <p className="text-2xl font-black text-purple-600 mt-1">
            {formatCurrency(kpiStats.totalRefunded)}
          </p>
          <span className="text-[11px] text-purple-600/80 mt-1 block">
            Hoàn tiền tự động khi hủy đúng hạn
          </span>
        </div>
      </div>

      {/* Thông báo kết quả thao tác */}
      {bannerMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <span>✓ {bannerMsg}</span>
          <button
            type="button"
            onClick={() => setBannerMsg(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Bộ lọc & Tìm kiếm */}
      <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-xs space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.key;
            const count =
              tab.key === 'ALL'
                ? bookings.length
                : bookings.filter((b) => (b.status || '').toUpperCase() === tab.key).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  active
                    ? 'bg-black text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    active ? 'bg-white/20 text-white' : 'bg-white text-gray-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Secondary Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="🔍 Tìm theo mã đơn (#SPL-...), tên sân, cơ sở, địa chỉ..."
              className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-black focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={sportFilter}
              onChange={(e) => setSportFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:bg-white focus:ring-2 focus:ring-black focus:outline-none cursor-pointer"
            >
              <option value="ALL">Tất cả môn thể thao</option>
              {availableSports.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3 flex gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-black focus:outline-none"
            />
            {(statusFilter !== 'ALL' || sportFilter !== 'ALL' || dateFilter || searchKeyword) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSportFilter('ALL');
                  setDateFilter('');
                  setSearchKeyword('');
                }}
                className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-600 cursor-pointer"
                title="Xóa bộ lọc"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Danh sách đơn đặt sân */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center text-gray-500 text-sm border border-gray-100">
          Đang tải lịch sử đặt sân và biên lai giao dịch...
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 space-y-3">
          <div className="text-4xl">🏟️</div>
          <h3 className="text-base font-extrabold text-gray-900">
            Chưa có đơn đặt sân nào khớp với bộ lọc
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Hãy khám phá các cụm sân thể thao quanh khu vực của bạn và đặt lịch giữ chỗ ngay hôm nay.
          </p>
          <div className="pt-2">
            <Link
              to="/courts"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-800 transition"
            >
              Khám phá & Đặt sân ngay →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBookings.map((booking) => {
            const statusInfo = getStatusBadge(booking.status);
            const paymentInfo = getPaymentBadge(
              booking.payment_status,
              booking.payment_method
            );
            const bookingStatus = (booking.status || '').toUpperCase();
            const isCancelled = bookingStatus === 'CANCELLED';
            const holdStillActive =
              bookingStatus !== 'HOLD' || Number(booking.hold_seconds_remaining ?? 1) > 0;
            const canPay =
              !isCancelled &&
              ['HOLD', 'PENDING', 'CONFIRMED'].includes(bookingStatus) &&
              holdStillActive &&
              Number(booking.remaining_amount || 0) > 0;
            const canCancel = canCancelBooking(booking);

            const isHighlighted = highlightedBookingId === booking.booking_id;

            return (
              <div
                id={`booking-card-${booking.booking_id}`}
                key={booking.booking_id}
                className={`bg-white rounded-3xl p-5 sm:p-6 border shadow-xs hover:shadow-md transition-all space-y-4 ${
                  isHighlighted
                    ? 'border-blue-500 ring-4 ring-blue-500/20 shadow-lg bg-blue-50/15'
                    : 'border-gray-100'
                }`}
              >
                {/* Top row: Mã đơn + Badges */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-gray-900 text-white">
                      #SPL-{booking.booking_id}
                    </span>
                    {booking.sport_name && (
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-800">
                        {booking.sport_name}
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusInfo.cls}`}
                    >
                      {statusInfo.label}
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${paymentInfo.cls}`}
                    >
                      {paymentInfo.label}
                    </span>
                  </div>

                  <span className="text-[11px] text-gray-400">
                    Tạo lúc:{' '}
                    {booking.created_at
                      ? new Date(booking.created_at).toLocaleString('vi-VN')
                      : booking.booking_date}
                  </span>
                </div>

                {/* Middle row: Thông tin sân, thời gian & Tài chính */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  <div className="lg:col-span-7 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-gray-900">
                        {booking.court_name}
                      </h3>
                      {booking.facility_id && (
                        <Link
                          to={`/facilities/${booking.facility_id}?courtId=${booking.court_id}`}
                          className="text-xs font-bold text-blue-600 hover:underline"
                        >
                          Xem sân →
                        </Link>
                      )}
                    </div>

                    {booking.facility_name && (
                      <p className="text-xs font-semibold text-gray-700">
                        🏢 Cơ sở: {booking.facility_name}
                      </p>
                    )}
                    {booking.court_address && (
                      <p className="text-xs text-gray-500">📍 {booking.court_address}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                      <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-800 font-bold border border-blue-100">
                        📅 Ngày: {booking.booking_date}
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-800 font-bold border border-indigo-100">
                        ⏰ Khung giờ: {booking.start_time} – {booking.end_time}
                      </span>
                    </div>

                    {bookingStatus === 'HOLD' && holdStillActive && (
                      <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 inline-block">
                        ⏳ Đang giữ chỗ — còn khoảng{' '}
                        {Math.max(1, Math.ceil(Number(booking.hold_seconds_remaining || 0) / 60))} phút
                        để thanh toán. Trả cọc 30% hoặc 100% là khoá lịch ngay, không cần chủ sân xác
                        nhận. Quá hạn, khung giờ sẽ tự động mở lại cho người khác.
                      </p>
                    )}

                    {isCancelled && booking.cancel_reason && (
                      <div className="mt-2 p-2.5 rounded-xl bg-red-50/70 border border-red-100 text-xs text-red-700">
                        <strong>Lý do hủy:</strong> {booking.cancel_reason}
                        {Number(booking.refunded_amount || 0) > 0 && (
                          <span className="ml-2 font-bold text-purple-700">
                            · Đã hoàn trả: {formatCurrency(Number(booking.refunded_amount))}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Khối đối chiếu tài chính */}
                  <div className="lg:col-span-5 bg-gray-50 rounded-2xl p-4 border border-gray-100 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[11px] text-gray-500 block">Tổng tiền sân</span>
                      <strong className="text-sm font-black text-gray-900">
                        {formatCurrency(booking.total_price)}
                      </strong>
                    </div>
                    <div className="border-x border-gray-200 px-2">
                      <span className="text-[11px] text-gray-500 block">Đã thanh toán</span>
                      <strong className="text-sm font-black text-emerald-600">
                        {formatCurrency(booking.paid_amount || 0)}
                      </strong>
                    </div>
                    <div>
                      {Number(booking.refunded_amount || 0) > 0 ? (
                        <>
                          <span className="text-[11px] text-purple-600 block font-semibold">
                            Đã hoàn tiền
                          </span>
                          <strong className="text-sm font-black text-purple-700">
                            {formatCurrency(booking.refunded_amount)}
                          </strong>
                        </>
                      ) : (
                        <>
                          <span className="text-[11px] text-gray-500 block">Còn phải trả</span>
                          <strong className="text-sm font-black text-amber-600">
                            {formatCurrency(booking.remaining_amount || 0)}
                          </strong>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom row: Nút hành động */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setReceiptBooking(booking)}
                    className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition cursor-pointer"
                  >
                    🧾 Xem biên lai & Lịch sử giao dịch ({booking.transactions?.length || 0})
                  </button>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {canPay && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalInitialTab('VIETQR');
                            setPaymentModalBooking(booking);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition cursor-pointer"
                        >
                          📲 Quét mã VietQR (Dự phòng R2)
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalInitialTab('VNPAY');
                            setPaymentModalBooking(booking);
                          }}
                          className="px-4 py-2 rounded-xl bg-[#1d63ed] hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                          💳 Thanh toán Sandbox (VNPay / MoMo)
                        </button>
                      </>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => {
                          setCancelTarget(booking);
                          setCancelReason(CANCEL_PRESETS[0]);
                          setCancelError(null);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold transition cursor-pointer"
                      >
                        ✕ Hủy đặt & Hoàn tiền
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: CỔNG THANH TOÁN SANDBOX & PHƯƠNG ÁN DỰ PHÒNG VIETQR          */}
      {/* ===================================================================== */}
      {paymentModalBooking && (
        <PaymentSandboxModal
          isOpen={Boolean(paymentModalBooking)}
          bookingId={paymentModalBooking.booking_id}
          courtName={paymentModalBooking.court_name}
          facilityName={paymentModalBooking.facility_name}
          bookingDate={paymentModalBooking.booking_date}
          startTime={paymentModalBooking.start_time}
          endTime={paymentModalBooking.end_time}
          totalPrice={paymentModalBooking.total_price}
          paidAmount={
            Math.max(
              0,
              Number(paymentModalBooking.paid_amount || 0) -
                Number(paymentModalBooking.refunded_amount || 0)
            )
          }
          initialTab={paymentModalInitialTab}
          onClose={() => setPaymentModalBooking(null)}
          onPaymentSuccess={() => {
            loadBookings();
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: BIÊN LAI ĐIỆN TỬ & LỊCH SỬ GIAO DỊCH (TRANSACTIONS - S3-10) */}
      {/* ===================================================================== */}
      {receiptBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[11px] font-bold uppercase text-blue-600">
                  Biên lai điện tử & Đối soát giao dịch
                </span>
                <h3 className="text-lg font-black text-gray-900 mt-0.5">
                  Đơn đặt sân #SPL-{receiptBooking.booking_id}
                </h3>
                <p className="text-xs text-gray-500">
                  {receiptBooking.court_name} · {receiptBooking.booking_date} (
                  {receiptBooking.start_time} - {receiptBooking.end_time})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptBooking(null)}
                className="text-gray-400 hover:text-gray-700 text-lg p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Cơ sở thể thao:</span>
                <span className="font-bold text-gray-900">
                  {receiptBooking.facility_name || 'Cơ sở SportLink'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tổng tiền thuê sân:</span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(receiptBooking.total_price)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tổng tiền đã thanh toán:</span>
                <span className="font-bold text-emerald-700">
                  {formatCurrency(receiptBooking.paid_amount || 0)}
                </span>
              </div>
              {Number(receiptBooking.refunded_amount || 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Số tiền đã hoàn trả (REFUND):</span>
                  <span className="font-bold text-purple-700">
                    {formatCurrency(receiptBooking.refunded_amount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-gray-200">
                <span className="text-gray-500 font-semibold">Số tiền còn lại:</span>
                <span className="font-black text-amber-700">
                  {formatCurrency(receiptBooking.remaining_amount || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-extrabold text-gray-800 uppercase tracking-wider">
                Lịch sử giao dịch ({receiptBooking.transactions?.length || 0})
              </h4>

              {!receiptBooking.transactions || receiptBooking.transactions.length === 0 ? (
                <div className="p-6 text-center bg-gray-50 rounded-2xl text-xs text-gray-500 border border-gray-100">
                  Chưa phát sinh giao dịch thanh toán trực tuyến nào cho đơn đặt sân này.
                </div>
              ) : (
                <div className="space-y-2">
                  {receiptBooking.transactions.map((tx) => {
                    const isRefund = tx.transaction_type === 'REFUND';
                    const isSuccess = tx.status === 'SUCCESS';
                    return (
                      <div
                        key={tx.transaction_id}
                        className="p-3.5 rounded-2xl border border-gray-200 bg-white text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                isRefund
                                  ? 'bg-purple-100 text-purple-800'
                                  : tx.transaction_type === 'DEPOSIT'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isRefund
                                ? '↩ HOÀN TIỀN (REFUND)'
                                : tx.transaction_type === 'DEPOSIT'
                                  ? 'ĐẶT CỌC (DEPOSIT)'
                                  : 'THANH TOÁN (FULL)'}
                            </span>
                            <span className="font-mono font-bold text-gray-800">
                              {tx.payment_method}
                            </span>
                          </div>

                          <span
                            className={`font-black text-sm ${
                              isRefund
                                ? 'text-purple-700'
                                : isSuccess
                                  ? 'text-emerald-600'
                                  : 'text-gray-400 line-through'
                            }`}
                          >
                            {isRefund ? '+' : ''}
                            {formatCurrency(tx.amount)}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-[11px] text-gray-500">
                          <span>
                            Mã GD: <strong className="font-mono">{tx.order_code}</strong>
                          </span>
                          <span>
                            Trạng thái:{' '}
                            <strong
                              className={
                                isSuccess
                                  ? 'text-emerald-600'
                                  : tx.status === 'FAILED'
                                    ? 'text-red-600'
                                    : 'text-amber-600'
                              }
                            >
                              {tx.status}
                            </strong>
                          </span>
                        </div>

                        {tx.note && (
                          <p className="text-[11px] text-gray-600 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                            {tx.note}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setReceiptBooking(null)}
                className="px-5 py-2 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-800 cursor-pointer"
              >
                Đóng biên lai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: HỦY ĐẶT SÂN & HOÀN TIỀN TỰ ĐỘNG (S3-10 / R04)                */}
      {/* ===================================================================== */}
      {cancelTarget && (() => {
        const est = getRefundEstimate(cancelTarget);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-gray-100 space-y-4">
              <div className="flex items-start justify-between pb-3 border-b border-gray-100">
                <div>
                  <span className="text-[11px] font-bold uppercase text-red-600">
                    Xác nhận hủy lịch & Hoàn tiền tự động (S3-10)
                  </span>
                  <h3 className="text-lg font-black text-gray-900 mt-0.5">
                    Hủy đơn đặt sân #SPL-{cancelTarget.booking_id}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {cancelTarget.court_name} ({cancelTarget.booking_date} ·{' '}
                    {cancelTarget.start_time} - {cancelTarget.end_time})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="text-gray-400 hover:text-gray-700 text-lg p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Bảng tính hoàn tiền tự động */}
              <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Số tiền bạn đã thanh toán:</span>
                  <strong className="text-gray-900">{formatCurrency(est.netPaid)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tỷ lệ hoàn tiền áp dụng:</span>
                  <strong className="text-purple-700">
                    {Math.round(est.rate * 100)}% (
                    {est.rate === 1
                      ? 'Hủy trước giờ bóng lăn >= 2 tiếng'
                      : 'Hủy sát giờ < 2 tiếng trước trận'}
                    )
                  </strong>
                </div>
                <div className="flex justify-between pt-2 border-t border-purple-200">
                  <span className="font-bold text-purple-900">Số tiền hoàn trả tự động:</span>
                  <strong className="text-base font-black text-purple-700">
                    {formatCurrency(est.refundAmount)}
                  </strong>
                </div>
                <p className="text-[11px] text-gray-500 pt-1">
                  * Ngay sau khi hủy, khung giờ sân sẽ được giải phóng tức thì để người chơi khác có thể đặt (Kiểm soát rủi ro R04).
                </p>
              </div>

              <form onSubmit={handleConfirmCancel} className="space-y-3.5">
                {cancelError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                    ⚠️ {cancelError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Chọn nhanh lý do hủy lịch:
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {CANCEL_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCancelReason(preset)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                          cancelReason === preset
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do hủy đặt sân..."
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-black focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setCancelTarget(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                  >
                    Giữ lại lịch đặt
                  </button>
                  <button
                    type="submit"
                    disabled={cancelling}
                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    {cancelling
                      ? 'Đang xử lý hủy & hoàn tiền...'
                      : est.refundAmount > 0
                        ? `Xác nhận Hủy & Nhận hoàn ${formatCurrency(est.refundAmount)}`
                        : 'Xác nhận Hủy lịch đặt sân'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}


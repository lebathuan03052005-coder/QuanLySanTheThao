import { useState, useEffect, useMemo } from 'react';
import {
  fetchCustomersApi,
  fetchCustomerHistoryApi,
  updateCustomerReputationApi,
  type CustomerItem,
  type CustomerHistoryResponse,
  type CustomerSegment,
} from './customer.api';
import {
  fetchScheduleApi,
  createWalkInBookingApi,
  updateBookingStatusApi,
  type ScheduleCourt,
} from '../booking/booking.api';
import { useAuthStore } from '../../shared/stores/authStore';

type RolePerspective = 'OWNER' | 'STAFF';

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 -> 23:00

const SEGMENT_META: Record<
  CustomerSegment,
  {
    label: string;
    bg: string;
    text: string;
    border: string;
    desc: string;
    staffHint: string;
  }
> = {
  VIP: {
    label: 'Khách VIP / Thân thiết',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    desc: 'Đặt từ 4 lần hoặc chi tiêu ≥ 1.5M',
    staffHint: '💎 Ưu tiên tiếp đón • Miễn cọc giữ sân',
  },
  REGULAR: {
    label: 'Khách quen',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    desc: 'Đặt từ 2–3 lần, uy tín tốt',
    staffHint: '✓ Khách quen đúng giờ • Uy tín tốt',
  },
  NEW: {
    label: 'Khách mới',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    desc: 'Khách mới đặt sân lần đầu',
    staffHint: '👋 Hướng dẫn nội quy & vị trí sân',
  },
  WARNING: {
    label: 'Cần lưu ý',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
    desc: 'Có lịch sử hủy sát giờ / No-show',
    staffHint: '⚠️ Nhắc thu cọc trước khi giữ sân',
  },
};

const BOOKING_STATUS_BADGE: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  COMPLETED: {
    label: 'Hoàn thành',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  CONFIRMED: {
    label: 'Đã xác nhận',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
  },
  'CHECKED-IN': {
    label: 'Đang chơi (Checked-in)',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
  },
  PENDING: {
    label: 'Chờ xác nhận',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  CANCELLED: {
    label: 'Đã hủy',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
  },
  'NO-SHOW': {
    label: 'Bỏ kèo (No-show)',
    bg: 'bg-slate-200',
    text: 'text-slate-700',
  },
};

function formatVnd(n: number): string {
  return `${Math.round(n || 0).toLocaleString('vi-VN')}đ`;
}

function formatDateVi(iso: string | null): string {
  if (!iso) return 'Chưa đặt sân';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function formatDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isPastSlot(bookingDateIso: string, startTimeStr: string): boolean {
  const now = new Date();
  const todayIso = formatDateIso(now);
  if (bookingDateIso < todayIso) return true;
  if (bookingDateIso > todayIso) return false;
  const [h, m] = (startTimeStr || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0) < now.getHours() * 60 + now.getMinutes();
}

function timeToHourFloat(timeStr: string): number {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

function estimateQuickBookingPrice(
  court: ScheduleCourt | undefined,
  bookingDate: string,
  startTime: string,
  endTime: string
): number {
  if (!court) return 0;
  const startH = timeToHourFloat(startTime);
  const endH = timeToHourFloat(endTime);
  if (endH <= startH) return 0;

  const [y, m, d] = bookingDate.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const dayOfWeek = dt.getDay();
  const mmdd = bookingDate.slice(5, 10);
  const isHoliday = ['01-01', '04-30', '05-01', '09-02'].includes(mmdd);
  const dayType = isHoliday
    ? 'HOLIDAY'
    : dayOfWeek === 0 || dayOfWeek === 6
      ? 'WEEKEND'
      : 'WEEKDAY';

  let rules = (court.prices || []).filter(
    (p) => (p.dayType || '').toUpperCase() === dayType
  );
  if (rules.length === 0) {
    rules = (court.prices || []).filter(
      (p) => (p.dayType || '').toUpperCase() === 'WEEKDAY'
    );
  }
  if (rules.length === 0) {
    return Math.round((endH - startH) * 200000);
  }

  let total = 0;
  for (let cur = startH; cur < endH; cur += 0.5) {
    const mid = cur + 0.25;
    const matched = rules.find((r) => {
      const rs = timeToHourFloat(r.startTime);
      const re = timeToHourFloat(r.endTime);
      return mid >= rs && mid <= re;
    });
    const rate = matched ? matched.price : rules[rules.length - 1].price;
    total += rate * 0.5;
  }
  return Math.round(total);
}

export default function CustomerManagementPage() {
  const { user } = useAuthStore();
  const isStaffAccount = (user?.role || '').toLowerCase() === 'staff';

  const [perspective, setPerspective] = useState<RolePerspective>(
    isStaffAccount ? 'STAFF' : 'OWNER'
  );

  useEffect(() => {
    if (isStaffAccount) {
      setPerspective('STAFF');
    }
  }, [isStaffAccount]);

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [courts, setCourts] = useState<ScheduleCourt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedSegment, setSelectedSegment] = useState<string>('ALL');
  const [onlyActiveToday, setOnlyActiveToday] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [historyModal, setHistoryModal] =
    useState<CustomerHistoryResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<string>('CASH');

  const [quickBookCust, setQuickBookCust] = useState<CustomerItem | null>(null);
  const [quickBookForm, setQuickBookForm] = useState({
    courtId: 0,
    bookingDate: formatDateIso(new Date()),
    startTime: '17:00',
    endTime: '19:00',
    depositAmount: 0,
    status: 'CONFIRMED',
  });
  const [submittingQuickBook, setSubmittingQuickBook] =
    useState<boolean>(false);

  async function loadCustomers() {
    setLoading(true);
    try {
      const todayIso = formatDateIso(new Date());
      const [custData, schedData] = await Promise.all([
        fetchCustomersApi(),
        fetchScheduleApi({ startDate: todayIso, endDate: todayIso }).catch(
          () => null
        ),
      ]);
      setCustomers(custData);
      if (schedData?.courts) {
        setCourts(schedData.courts);
      }
    } catch {
      setErrorMsg('Không thể tải danh sách khách hàng.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  }

  async function handleOpenHistory(customerId: number) {
    setLoadingHistory(true);
    setErrorMsg(null);
    try {
      const detail = await fetchCustomerHistoryApi(customerId);
      setHistoryModal(detail);
    } catch {
      setErrorMsg('Không thể tải lịch sử đặt sân của khách hàng này.');
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleToggleCustomerStatus(c: CustomerItem) {
    if (isStaffAccount) return;
    const nextStatus = c.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE';
    const confirmText =
      nextStatus === 'LOCKED'
        ? `Khóa tạm thời khách hàng "${c.fullName}" (do vi phạm / bỏ kèo nhiều lần)?`
        : `Mở khóa cho khách hàng "${c.fullName}"?`;

    if (!window.confirm(confirmText)) return;

    try {
      await updateCustomerReputationApi(c.id, { status: nextStatus });
      showToast(
        nextStatus === 'LOCKED'
          ? `Đã khóa tài khoản khách hàng ${c.fullName}`
          : `Đã mở khóa tài khoản khách hàng ${c.fullName}`
      );
      await loadCustomers();
      if (historyModal && historyModal.customer.id === c.id) {
        const refreshed = await fetchCustomerHistoryApi(c.id);
        setHistoryModal(refreshed);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(
        e.response?.data?.message || 'Cập nhật trạng thái khách hàng thất bại.'
      );
    }
  }

  async function handleStaffUpdateBookingStatus(
    bookingId: number,
    newStatus: string,
    paymentMethod?: string
  ) {
    if (!historyModal) return;
    setStatusUpdatingId(bookingId);
    setErrorMsg(null);
    try {
      await updateBookingStatusApi(bookingId, newStatus, paymentMethod);
      showToast(
        newStatus === 'CHECKED-IN'
          ? `✓ Đã Check-in nhận sân cho đơn #${bookingId}!`
          : newStatus === 'COMPLETED'
            ? `💰 Đã thu tiền phần còn lại & hoàn tất đơn #${bookingId}!`
            : `Đã cập nhật đơn #${bookingId} sang trạng thái ${newStatus}`
      );
      const [refreshedDetail] = await Promise.all([
        fetchCustomerHistoryApi(historyModal.customer.id),
        loadCustomers(),
      ]);
      setHistoryModal(refreshedDetail);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(
        e.response?.data?.message || 'Không thể cập nhật trạng thái đơn đặt sân.'
      );
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function handleOpenQuickBookingForCustomer(c: CustomerItem) {
    if (c.status === 'LOCKED') {
      setErrorMsg(
        `Khách hàng "${c.fullName}" đang bị khóa tạm thời, không thể tạo đơn đặt sân mới.`
      );
      return;
    }
    const nowH = new Date().getHours();
    const defaultStartH = Math.min(22, Math.max(6, nowH + 1));
    const defaultEndH = Math.min(23, defaultStartH + 1);

    setQuickBookCust(c);
    setQuickBookForm({
      courtId: courts[0]?.courtId || 0,
      bookingDate: formatDateIso(new Date()),
      startTime: `${String(defaultStartH).padStart(2, '0')}:00`,
      endTime: `${String(defaultEndH).padStart(2, '0')}:00`,
      depositAmount: 0,
      status: 'CONFIRMED',
    });
  }

  const quickBookingEstimatedPrice = useMemo(() => {
    const court = courts.find(
      (c) => c.courtId === Number(quickBookForm.courtId)
    );
    return estimateQuickBookingPrice(
      court,
      quickBookForm.bookingDate,
      quickBookForm.startTime,
      quickBookForm.endTime
    );
  }, [
    courts,
    quickBookForm.courtId,
    quickBookForm.bookingDate,
    quickBookForm.startTime,
    quickBookForm.endTime,
  ]);

  async function handleSubmitQuickBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!quickBookCust || !quickBookForm.courtId) return;

    if (isPastSlot(quickBookForm.bookingDate, quickBookForm.startTime)) {
      setErrorMsg(
        `Khung giờ ${quickBookForm.startTime} ngày ${formatDateVi(quickBookForm.bookingDate)} đã qua. Vui lòng chọn giờ trong tương lai.`
      );
      return;
    }

    setSubmittingQuickBook(true);
    setErrorMsg(null);
    try {
      await createWalkInBookingApi({
        courtId: Number(quickBookForm.courtId),
        bookingDate: quickBookForm.bookingDate,
        startTime: quickBookForm.startTime,
        endTime: quickBookForm.endTime,
        depositAmount: Number(quickBookForm.depositAmount || 0),
        status: quickBookForm.status,
        customerName: quickBookCust.fullName,
        customerPhone: quickBookCust.phone,
        customerEmail: quickBookCust.email,
      });
      showToast(
        `Đã tạo lịch đặt sân mới cho khách hàng ${quickBookCust.fullName}!`
      );
      setQuickBookCust(null);
      await loadCustomers();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(
        e.response?.data?.message ||
          'Không thể đặt sân (khung giờ đã có người đặt hoặc bảo trì).'
      );
    } finally {
      setSubmittingQuickBook(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (selectedSegment !== 'ALL' && c.segment !== selectedSegment) {
        return false;
      }
      if (onlyActiveToday && (c.todayActiveBookings || c.activeBookings || 0) <= 0) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = (c.fullName || '').toLowerCase().includes(q);
        const matchPhone = (c.phone || '').toLowerCase().includes(q);
        const matchEmail = (c.email || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchEmail) return false;
      }
      return true;
    });
  }, [customers, selectedSegment, onlyActiveToday, search]);

  const summary = useMemo(() => {
    const total = customers.length;
    const vipCount = customers.filter((c) => c.segment === 'VIP').length;
    const regularCount = customers.filter((c) => c.segment === 'REGULAR').length;
    const warningCount = customers.filter((c) => c.segment === 'WARNING').length;
    const totalRevenueFromCustomers = customers.reduce(
      (s, c) => s + (c.totalSpent || 0),
      0
    );
    const avgReputation =
      total > 0
        ? Math.round(
            (customers.reduce((s, c) => s + (c.reputationScore || 5), 0) /
              total) *
              10
          ) / 10
        : 5.0;

    // Thống kê ca trực dành cho Nhân viên (STAFF)
    const customersWithActiveBookings = customers.filter(
      (c) => (c.todayActiveBookings ?? c.activeBookings) > 0
    ).length;
    const totalActiveBookingsCount = customers.reduce(
      (s, c) => s + (c.todayActiveBookings ?? c.activeBookings ?? 0),
      0
    );
    const needDepositCount = customers.filter(
      (c) => c.segment === 'WARNING' || (c.unpaidDepositBookings || 0) > 0
    ).length;

    return {
      total,
      vipCount,
      regularCount,
      warningCount,
      needDepositCount,
      totalRevenueFromCustomers,
      avgReputation,
      customersWithActiveBookings,
      totalActiveBookingsCount,
    };
  }, [customers]);

  return (
    <div className="flex-1 flex flex-col gap-4">
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-medium">
          ✓ {toastMsg}
        </div>
      )}

      {/* Header & Chuyển đổi góc nhìn Chủ sân (CRM) / Nhân viên (Ca trực) */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200">
              WBS 3.1 • Quản lý Khách hàng & Lịch sử Đặt sân
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                perspective === 'STAFF'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-purple-50 text-purple-700 border border-purple-200'
              }`}
            >
              {perspective === 'STAFF'
                ? '🏃 Giao diện Nhân viên trực sân (Check-in & Thu tiền)'
                : '👑 Giao diện Chủ sân (Quản trị CRM & Uy tín)'}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 mt-1">
            {perspective === 'STAFF'
              ? 'Tra Cứu Khách Hàng & Hỗ Trợ Check-in Tại Sân'
              : 'Danh Sách Khách Hàng & Lịch Sử Đặt Sân'}
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            {perspective === 'STAFF'
              ? 'Tra cứu nhanh theo SĐT khách đến sân, kiểm tra đơn đặt hôm nay, làm thủ tục Check-in nhận sân và thu tiền còn lại tại quầy.'
              : 'Theo dõi hồ sơ người chơi, phân nhóm khách hàng thân thiết (VIP), điểm uy tín và kiểm soát tài khoản vi phạm.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isStaffAccount && (
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setPerspective('OWNER');
                  setOnlyActiveToday(false);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  perspective === 'OWNER'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                👑 Góc nhìn Chủ sân
              </button>
              <button
                type="button"
                onClick={() => setPerspective('STAFF')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  perspective === 'STAFF'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏃 Góc nhìn Nhân viên
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={loadCustomers}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            ↻ Làm mới
          </button>
        </div>
      </div>

      {/* 4 Thẻ KPI */}
      {perspective === 'STAFF' ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-emerald-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-emerald-700">
                Khách có lịch đặt cần tiếp đón
              </p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {summary.customersWithActiveBookings}{' '}
                <span className="text-xs font-normal text-slate-400">khách</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Có đơn Chờ duyệt / Đã xác nhận / Đang chơi
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
              🏃
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Tổng ca đặt chờ phục vụ
              </p>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {summary.totalActiveBookingsCount}{' '}
                <span className="text-xs font-normal text-slate-400">ca đặt</span>
              </p>
              <p className="text-[11px] text-blue-600 font-medium mt-1">
                Sẵn sàng Check-in tại quầy
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
              📋
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Khách quen & VIP tại sân
              </p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {summary.vipCount + summary.regularCount}{' '}
                <span className="text-xs font-normal text-slate-400">khách</span>
              </p>
              <p className="text-[11px] text-purple-600 font-medium mt-1">
                💎 {summary.vipCount} VIP • ✓ {summary.regularCount} Khách quen
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg font-bold">
              💎
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-amber-200 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700">
                Khách cần lưu ý / Thu cọc
              </p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {summary.needDepositCount}{' '}
                <span className="text-xs font-normal text-slate-400">khách</span>
              </p>
              <p className="text-[11px] text-amber-600 font-medium mt-1">
                ⚠️ Nhắc thu cọc trước khi giữ sân
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold">
              ⚠️
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Tổng khách hàng</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {summary.total}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Khách đã đặt sân tại cơ sở
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
              👥
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Khách thân thiết (VIP)
              </p>
              <p className="text-2xl font-bold text-purple-600 mt-1">
                {summary.vipCount}
              </p>
              <p className="text-[11px] text-purple-600 font-medium mt-1">
                + {summary.regularCount} khách quen thường xuyên
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg font-bold">
              💎
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Tổng chi tiêu khách hàng
              </p>
              <p className="text-xl md:text-2xl font-bold text-emerald-600 mt-1">
                {formatVnd(summary.totalRevenueFromCustomers)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Lũy kế các đơn hợp lệ
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
              💳
            </div>
          </div>

          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Điểm uy tín trung bình
              </p>
              <p className="text-2xl font-bold text-amber-500 mt-1">
                ★ {summary.avgReputation} / 5.0
              </p>
              <p className="text-[11px] text-rose-500 font-medium mt-1">
                {summary.warningCount} khách cần lưu ý (No-show/Hủy)
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-lg font-bold">
              ⭐
            </div>
          </div>
        </div>
      )}

      {/* Thanh tìm kiếm & Bộ lọc phân nhóm */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              perspective === 'STAFF'
                ? 'Nhập SĐT hoặc tên khách đến nhận sân...'
                : 'Tìm theo tên khách hàng, số điện thoại hoặc email...'
            }
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 pl-4 pr-10 py-2.5 text-xs md:text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {perspective === 'STAFF' && (
            <button
              type="button"
              onClick={() => setOnlyActiveToday(!onlyActiveToday)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                onlyActiveToday
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              🟢 Đang có lịch đặt ({summary.customersWithActiveBookings})
            </button>
          )}

          {[
            { id: 'ALL', label: `Tất cả (${customers.length})` },
            { id: 'VIP', label: '💎 VIP / Thân thiết' },
            { id: 'REGULAR', label: '✓ Khách quen' },
            { id: 'NEW', label: '🌱 Khách mới' },
            { id: 'WARNING', label: '⚠️ Cần lưu ý' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedSegment(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedSegment === tab.id
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs md:text-sm flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bảng danh sách khách hàng */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 flex-1 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Đang tải danh sách khách hàng...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-base font-bold text-slate-700">
              Không tìm thấy khách hàng nào phù hợp
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc phân nhóm khách hàng.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                  <th className="p-4 text-left font-bold">
                    Khách hàng / Liên hệ
                  </th>
                  <th className="p-4 text-left font-bold">
                    {perspective === 'STAFF'
                      ? 'Phân hạng & Lưu ý tiếp đón'
                      : 'Phân nhóm'}
                  </th>
                  <th className="p-4 text-center font-bold">Điểm uy tín</th>
                  <th className="p-4 text-center font-bold">
                    {perspective === 'STAFF'
                      ? 'Trạng thái ca đặt'
                      : 'Lượt đặt sân'}
                  </th>
                  {perspective === 'OWNER' && (
                    <th className="p-4 text-right font-bold">Tổng chi tiêu</th>
                  )}
                  <th className="p-4 text-center font-bold">Lần đặt gần nhất</th>
                  {perspective === 'OWNER' && (
                    <th className="p-4 text-center font-bold">Trạng thái TK</th>
                  )}
                  <th className="p-4 text-right font-bold">
                    {perspective === 'STAFF'
                      ? 'Thao tác phục vụ tại quầy'
                      : 'Thao tác quản trị'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs md:text-sm">
                {filteredCustomers.map((c) => {
                  const seg = SEGMENT_META[c.segment] || SEGMENT_META.NEW;
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center shrink-0">
                            {(c.fullName || 'K')[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <span>{c.fullName}</span>
                              {c.status === 'LOCKED' && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                                  ĐÃ KHÓA
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              📞{' '}
                              <strong className="text-slate-700">
                                {c.phone}
                              </strong>{' '}
                              {c.email ? `• ✉️ ${c.email}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${seg.bg} ${seg.text} ${seg.border}`}
                        >
                          {seg.label}
                        </span>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {perspective === 'STAFF' ? seg.staffHint : seg.desc}
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold text-xs ${
                            c.reputationScore >= 4.5
                              ? 'bg-emerald-50 text-emerald-700'
                              : c.reputationScore >= 4.0
                                ? 'bg-blue-50 text-blue-700'
                                : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          ★ {c.reputationScore.toFixed(1)}
                        </span>
                      </td>

                      <td className="p-4 text-center">
                        {perspective === 'STAFF' ? (
                          c.activeBookings > 0 ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                                🟢 {c.activeBookings} ca đang đặt
                              </span>
                              <div className="text-[11px] text-slate-500 mt-1">
                                Bấm "Xử lý đơn" để Check-in / Thu tiền
                              </div>
                            </div>
                          ) : (
                            <div>
                              <span className="inline-block px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                                Đã xong {c.completedBookings} ca
                              </span>
                              {c.noShowCount > 0 && (
                                <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
                                  ⚠️ {c.noShowCount} lần bỏ kèo
                                </div>
                              )}
                            </div>
                          )
                        ) : (
                          <>
                            <div className="font-bold text-slate-800">
                              {c.totalBookings} đơn
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              <span className="text-emerald-600 font-medium">
                                {c.completedBookings} xong
                              </span>
                              {' • '}
                              <span className="text-blue-600 font-medium">
                                {c.activeBookings} đang đặt
                              </span>
                              {c.cancelledBookings > 0 && (
                                <span className="text-rose-500">
                                  {' '}
                                  • {c.cancelledBookings} hủy
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </td>

                      {perspective === 'OWNER' && (
                        <td className="p-4 text-right font-bold text-emerald-600">
                          {formatVnd(c.totalSpent)}
                        </td>
                      )}

                      <td className="p-4 text-center text-xs text-slate-600 font-medium">
                        {formatDateVi(c.lastBookingDate)}
                      </td>

                      {perspective === 'OWNER' && (
                        <td className="p-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              c.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {c.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                      )}

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(c.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                              perspective === 'STAFF' && c.activeBookings > 0
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
                            }`}
                          >
                            {perspective === 'STAFF'
                              ? c.activeBookings > 0
                                ? '🏃 Check-in / Xử lý đơn'
                                : '📋 Xem lịch sử đặt'
                              : 'Lịch sử đặt'}
                          </button>

                          {perspective === 'STAFF' ? (
                            <button
                              type="button"
                              disabled={c.status === 'LOCKED'}
                              onClick={() => handleOpenQuickBookingForCustomer(c)}
                              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                              + Đặt sân
                            </button>
                          ) : (
                            !isStaffAccount && (
                              <button
                                type="button"
                                onClick={() => handleToggleCustomerStatus(c)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                                  c.status === 'ACTIVE'
                                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                                }`}
                              >
                                {c.status === 'ACTIVE' ? 'Khóa TK' : 'Mở khóa'}
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ======================== MODAL 1: LỊCH SỬ ĐẶT SÂN & XỬ LÝ ĐƠN TẠI QUẦY ======================== */}
      {(loadingHistory || historyModal) && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col p-6 shadow-2xl border border-slate-200">
            {loadingHistory || !historyModal ? (
              <div className="p-12 text-center text-sm text-slate-500">
                Đang tải hồ sơ và lịch sử đặt sân của khách hàng...
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between pb-4 border-b border-slate-200 gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white font-bold text-lg flex items-center justify-center">
                      {historyModal.customer.fullName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-800">
                          {historyModal.customer.fullName}
                        </h2>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            SEGMENT_META[historyModal.customer.segment]?.bg
                          } ${SEGMENT_META[historyModal.customer.segment]?.text}`}
                        >
                          {SEGMENT_META[historyModal.customer.segment]?.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        📞 <strong>{historyModal.customer.phone}</strong> • ✉️{' '}
                        {historyModal.customer.email || 'Chưa cập nhật email'} •
                        Uy tín:{' '}
                        <strong className="text-amber-600">
                          ★ {historyModal.customer.reputationScore}
                        </strong>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={historyModal.customer.status === 'LOCKED'}
                      onClick={() => {
                        const cust = historyModal.customer;
                        setHistoryModal(null);
                        handleOpenQuickBookingForCustomer(cust);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-bold cursor-pointer"
                    >
                      + Đặt sân mới cho khách này
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryModal(null)}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Tóm tắt chỉ số của khách */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
                  <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/70">
                    <p className="text-[11px] text-slate-500">Tổng lượt đặt</p>
                    <p className="text-lg font-bold text-slate-800">
                      {historyModal.customer.totalBookings} đơn
                    </p>
                  </div>
                  <div className="bg-emerald-50/60 rounded-2xl p-3 border border-emerald-200/70">
                    <p className="text-[11px] text-emerald-700">Đã hoàn thành</p>
                    <p className="text-lg font-bold text-emerald-700">
                      {historyModal.customer.completedBookings} đơn
                    </p>
                  </div>
                  <div className="bg-rose-50/60 rounded-2xl p-3 border border-rose-200/70">
                    <p className="text-[11px] text-rose-700">
                      Đã hủy / Bỏ kèo (No-show)
                    </p>
                    <p className="text-lg font-bold text-rose-700">
                      {historyModal.customer.cancelledBookings} hủy /{' '}
                      {historyModal.customer.noShowCount} bỏ kèo
                    </p>
                  </div>
                  <div className="bg-blue-50/60 rounded-2xl p-3 border border-blue-200/70">
                    <p className="text-[11px] text-blue-700">
                      Tổng chi tiêu tại cụm sân
                    </p>
                    <p className="text-lg font-bold text-blue-700">
                      {formatVnd(historyModal.customer.totalSpent)}
                    </p>
                  </div>
                </div>

                {/* Chọn phương thức thanh toán khi thu tiền tại quầy */}
                <div className="bg-slate-50 rounded-2xl px-4 py-2.5 mb-3 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-slate-700">
                    💳 Phương thức thanh toán khi bấm "Thu tiền & Hoàn tất":
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'CASH', label: '💵 Tiền mặt tại quầy' },
                      { id: 'BANK_TRANSFER', label: '🏦 Chuyển khoản VietQR' },
                      { id: 'MOMO', label: '📱 Ví MoMo' },
                      { id: 'VNPAY', label: '💳 Ví VNPay' },
                    ].map((pm) => (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(pm.id)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                          selectedPaymentMethod === pm.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Danh sách lịch sử các đơn đặt sân */}
                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
                  {historyModal.bookings.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Khách hàng này chưa có lịch sử đặt sân tại cơ sở của bạn.
                    </div>
                  ) : (
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <th className="p-3 text-left font-bold">Mã đơn</th>
                          <th className="p-3 text-left font-bold">
                            Sân thể thao
                          </th>
                          <th className="p-3 text-left font-bold">
                            Ngày & Khung giờ
                          </th>
                          <th className="p-3 text-right font-bold">Tổng tiền</th>
                          <th className="p-3 text-right font-bold">
                            Đã thanh toán / Cọc
                          </th>
                          <th className="p-3 text-right font-bold">
                            Còn phải thu
                          </th>
                          <th className="p-3 text-center font-bold">
                            Trạng thái
                          </th>
                          <th className="p-3 text-right font-bold">
                            Thao tác xử lý đơn
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historyModal.bookings.map((b) => {
                          const badge = BOOKING_STATUS_BADGE[b.status] || {
                            label: b.status,
                            bg: 'bg-slate-100',
                            text: 'text-slate-700',
                          };
                          const remainingToPay =
                            b.remainingAmount !== undefined
                              ? b.remainingAmount
                              : b.status === 'COMPLETED' ||
                                  b.status === 'CANCELLED'
                                ? 0
                                : Math.max(
                                    0,
                                    (b.totalPrice || 0) - (b.paidAmount || 0)
                                  );
                          const isUpdating = statusUpdatingId === b.bookingId;

                          return (
                            <tr
                              key={b.bookingId}
                              className="hover:bg-slate-50/70"
                            >
                              <td className="p-3 font-bold text-slate-700">
                                #{b.bookingId}
                              </td>
                              <td className="p-3">
                                <div className="font-semibold text-slate-800">
                                  {b.courtName}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  {b.sportName}
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="font-semibold text-blue-600">
                                  {formatDateVi(b.bookingDate)}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {b.startTime} - {b.endTime}
                                </div>
                              </td>
                              <td className="p-3 text-right font-bold text-slate-800">
                                {formatVnd(b.totalPrice)}
                              </td>
                              <td className="p-3 text-right text-slate-600">
                                {formatVnd(b.paidAmount)}
                              </td>
                              <td className="p-3 text-right font-bold">
                                {remainingToPay > 0 ? (
                                  <span className="text-rose-600">
                                    {formatVnd(remainingToPay)}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600">0đ</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${badge.bg} ${badge.text}`}
                                >
                                  {badge.label}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {b.status === 'PENDING' && (
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() =>
                                        handleStaffUpdateBookingStatus(
                                          b.bookingId,
                                          'CONFIRMED'
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
                                    >
                                      ✓ Xác nhận
                                    </button>
                                  )}

                                  {['PENDING', 'CONFIRMED'].includes(
                                    b.status
                                  ) && (
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() =>
                                        handleStaffUpdateBookingStatus(
                                          b.bookingId,
                                          'CHECKED-IN'
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                                    >
                                      🏃 Check-in
                                    </button>
                                  )}

                                  {['CONFIRMED', 'CHECKED-IN'].includes(
                                    b.status
                                  ) && (
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() =>
                                        handleStaffUpdateBookingStatus(
                                          b.bookingId,
                                          'COMPLETED',
                                          selectedPaymentMethod
                                        )
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold cursor-pointer"
                                    >
                                      💰 Thu tiền & Hoàn tất
                                    </button>
                                  )}

                                  {['PENDING', 'CONFIRMED'].includes(
                                    b.status
                                  ) && (
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() =>
                                        handleStaffUpdateBookingStatus(
                                          b.bookingId,
                                          'NO-SHOW'
                                        )
                                      }
                                      className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-[11px] font-semibold cursor-pointer"
                                      title="Khách không đến nhận sân"
                                    >
                                      Bỏ kèo
                                    </button>
                                  )}

                                  {['COMPLETED', 'CANCELLED', 'NO-SHOW'].includes(
                                    b.status
                                  ) && (
                                    <span className="text-[11px] text-slate-400 italic">
                                      Đã đóng
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ======================== MODAL 2: ĐẶT SÂN NHANH CHO KHÁCH TẠI QUẦY ======================== */}
      {quickBookCust && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-blue-600">
                  Đặt sân nhanh cho khách quen
                </span>
                <h3 className="text-lg font-bold text-slate-800">
                  {quickBookCust.fullName} ({quickBookCust.phone})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setQuickBookCust(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmitQuickBooking}
              className="mt-4 space-y-3.5"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn sân thể thao *
                </label>
                <select
                  value={quickBookForm.courtId}
                  onChange={(e) =>
                    setQuickBookForm({
                      ...quickBookForm,
                      courtId: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-2xl border border-slate-300 px-3.5 py-2 text-sm"
                  required
                >
                  {courts.map((c) => (
                    <option key={c.courtId} value={c.courtId}>
                      {c.courtName} ({c.sportName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày đặt *
                  </label>
                  <input
                    type="date"
                    min={formatDateIso(new Date())}
                    value={quickBookForm.bookingDate}
                    onChange={(e) =>
                      setQuickBookForm({
                        ...quickBookForm,
                        bookingDate: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-2.5 py-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Giờ bắt đầu
                  </label>
                  <select
                    value={quickBookForm.startTime}
                    onChange={(e) =>
                      setQuickBookForm({
                        ...quickBookForm,
                        startTime: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-2.5 py-2 text-xs"
                  >
                    {HOURS.map((h) => {
                      const t = `${String(h).padStart(2, '0')}:00`;
                      const disabled = isPastSlot(quickBookForm.bookingDate, t);
                      return (
                        <option key={t} value={t} disabled={disabled}>
                          {t} {disabled ? '(Đã qua)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Giờ kết thúc
                  </label>
                  <select
                    value={quickBookForm.endTime}
                    onChange={(e) =>
                      setQuickBookForm({
                        ...quickBookForm,
                        endTime: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-2.5 py-2 text-xs"
                  >
                    {HOURS.map((h) => {
                      const t = `${String(h + 1).padStart(2, '0')}:00`;
                      return (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tiền cọc / Đã thu (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={quickBookForm.depositAmount}
                    onChange={(e) =>
                      setQuickBookForm({
                        ...quickBookForm,
                        depositAmount: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Trạng thái nhận sân
                  </label>
                  <select
                    value={quickBookForm.status}
                    onChange={(e) =>
                      setQuickBookForm({
                        ...quickBookForm,
                        status: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="CONFIRMED">Giữ sân (Đã xác nhận)</option>
                    <option value="CHECKED-IN">Nhận sân ngay (Check-in)</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-800">
                  Tổng tiền tính tự động:
                </span>
                <span className="text-base font-bold text-blue-700">
                  {formatVnd(quickBookingEstimatedPrice)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickBookCust(null)}
                  className="px-4 py-2 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingQuickBook || quickBookingEstimatedPrice <= 0}
                  className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold text-center cursor-pointer"
                >
                  {submittingQuickBook ? 'Đang tạo đơn...' : 'Xác nhận đặt sân'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


import { useState, useEffect, useMemo } from 'react';
import {
  fetchScheduleApi,
  createWalkInBookingApi,
  updateBookingStatusApi,
  createMaintenanceApi,
  deleteMaintenanceApi,
  type ScheduleResponse,
  type ScheduleBooking,
  type ScheduleCourt,
  type ScheduleMaintenance,
} from './booking.api';
import { useAuthStore } from '../../shared/stores/authStore';

type ViewMode = 'day' | 'week' | 'month';

// Ma trận khung giờ hoạt động tiêu chuẩn từ 06:00 đến 23:00 (17 ca x 1 giờ: 06:00..22:00 -> 23:00)
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);

const WEEKDAY_LABELS = [
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
  'Chủ nhật',
];

function formatDateIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function getMondayOfWeek(d: Date): Date {
  const clone = new Date(d);
  const day = clone.getDay(); // 0: CN, 1: T2...
  const diff = clone.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(clone.setDate(diff));
}

function formatVnd(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString('vi-VN')}đ`;
}

function formatDateVi(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function timeToHourFloat(timeStr: string): number {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

function isPastSlot(bookingDateIso: string, startTimeStr: string): boolean {
  const now = new Date();
  const todayIso = formatDateIso(now);
  if (bookingDateIso < todayIso) return true;
  if (bookingDateIso > todayIso) return false;

  const [h, m] = (startTimeStr || '00:00').split(':').map(Number);
  const slotMinutes = (h || 0) * 60 + (m || 0);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slotMinutes < nowMinutes;
}

function isHolidayDate(bookingDate: string): boolean {
  const mmdd = (bookingDate || '').slice(5, 10);
  return ['01-01', '04-30', '05-01', '09-02'].includes(mmdd);
}

function estimateDynamicPriceClient(
  court: ScheduleCourt | undefined,
  bookingDate: string,
  startTime: string,
  endTime: string
): number {
  if (!court) return 0;
  const startH = timeToHourFloat(startTime);
  const endH = timeToHourFloat(endTime);
  if (endH <= startH) return 0;

  const dt = parseDateIso(bookingDate);
  const dayOfWeek = dt.getDay();
  const isHoliday = isHolidayDate(bookingDate);
  const targetDayType = isHoliday
    ? 'HOLIDAY'
    : dayOfWeek === 0 || dayOfWeek === 6
      ? 'WEEKEND'
      : 'NORMAL';

  let rules = (court.prices || []).filter((p) => {
    const pDt = (p.dayType || '').toUpperCase();
    if (targetDayType === 'NORMAL') {
      return pDt === 'NORMAL' || pDt === 'WEEKDAY';
    }
    return pDt === targetDayType;
  });

  if (rules.length === 0) {
    rules = (court.prices || []).filter((p) => {
      const pDt = (p.dayType || '').toUpperCase();
      return pDt === 'NORMAL' || pDt === 'WEEKDAY';
    });
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

const STATUS_BADGE: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  CONFIRMED: {
    label: 'Đã xác nhận',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-300',
    dot: 'bg-blue-500',
  },
  PENDING: {
    label: 'Chờ xác nhận',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
    dot: 'bg-amber-500',
  },
  'CHECKED-IN': {
    label: 'Đang chơi',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-300',
    dot: 'bg-emerald-500',
  },
  COMPLETED: {
    label: 'Hoàn thành',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-300',
    dot: 'bg-indigo-500',
  },
  CANCELLED: {
    label: 'Đã hủy',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  'NO-SHOW': {
    label: 'Bỏ kèo (No-show)',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-300',
    dot: 'bg-slate-500',
  },
};

export default function CourtSchedulePage() {
  const { user } = useAuthStore();
  const isOwner = (user?.role || '').toLowerCase() === 'owner';

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    formatDateIso(new Date())
  );
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('ALL');
  const [selectedSportId, setSelectedSportId] = useState<string>('ALL');
  const [selectedCourtId, setSelectedCourtId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  const [scheduleData, setScheduleData] = useState<ScheduleResponse>({
    startDate: selectedDate,
    endDate: selectedDate,
    facilities: [],
    sports: [],
    courts: [],
    bookings: [],
    maintenances: [],
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal tạo đơn đặt sân tại quầy (Walk-in booking)
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingForm, setBookingForm] = useState({
    courtId: 0,
    bookingDate: selectedDate,
    startTime: '17:00',
    endTime: '19:00',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    depositAmount: 0,
    status: 'CONFIRMED',
  });
  const [submittingBooking, setSubmittingBooking] = useState<boolean>(false);

  // Modal chi tiết đơn đặt sân & cập nhật trạng thái
  const [activeBooking, setActiveBooking] = useState<ScheduleBooking | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // Modal khóa sân bảo trì
  const [isMaintModalOpen, setIsMaintModalOpen] = useState<boolean>(false);
  const [maintForm, setMaintForm] = useState({
    courtId: 0,
    date: selectedDate,
    startTime: '12:00',
    endTime: '14:00',
    reason: 'Bảo trì mặt sân & hệ thống đèn',
  });

  // Tính khoảng ngày [startDate, endDate] dựa theo chế độ xem Ngày / Tuần / Tháng
  const dateRange = useMemo(() => {
    const base = parseDateIso(selectedDate);
    if (viewMode === 'day') {
      return { startDate: selectedDate, endDate: selectedDate };
    }
    if (viewMode === 'week') {
      const monday = getMondayOfWeek(base);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        startDate: formatDateIso(monday),
        endDate: formatDateIso(sunday),
      };
    }
    const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return {
      startDate: formatDateIso(firstDay),
      endDate: formatDateIso(lastDay),
    };
  }, [selectedDate, viewMode]);

  async function loadSchedule() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchScheduleApi({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        facilityId: selectedFacilityId,
        sportId: selectedSportId,
        courtId: selectedCourtId,
        status: selectedStatus,
      });
      setScheduleData(res);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(
        e.response?.data?.message || 'Không thể tải dữ liệu lịch hoạt động sân.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dateRange.startDate,
    dateRange.endDate,
    selectedFacilityId,
    selectedSportId,
    selectedCourtId,
    selectedStatus,
  ]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  const displayedCourts = useMemo(() => {
    let list = scheduleData.courts;
    if (selectedFacilityId !== 'ALL') {
      list = list.filter((c) => String(c.facilityId) === selectedFacilityId);
    }
    if (selectedCourtId !== 'ALL') {
      list = list.filter((c) => String(c.courtId) === selectedCourtId);
    }
    return list;
  }, [scheduleData.courts, selectedFacilityId, selectedCourtId]);

  const kpiStats = useMemo(() => {
    const activeBookings = scheduleData.bookings.filter(
      (b) => b.status !== 'CANCELLED'
    );
    const confirmedOrPlaying = activeBookings.filter(
      (b) =>
        b.status === 'CONFIRMED' ||
        b.status === 'CHECKED-IN' ||
        b.status === 'COMPLETED'
    );
    const pendingCount = activeBookings.filter(
      (b) => b.status === 'PENDING'
    ).length;
    const totalRevenue = confirmedOrPlaying.reduce(
      (sum, b) => sum + (b.totalPrice || 0),
      0
    );

    const totalBookedHours = activeBookings.reduce((sum, b) => {
      const dur = Math.max(
        0,
        timeToHourFloat(b.endTime) - timeToHourFloat(b.startTime)
      );
      return sum + dur;
    }, 0);

    const numDays =
      viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30;
    const totalAvailableHours = Math.max(
      1,
      displayedCourts.length * 17 * numDays
    );
    const occupancyRate = Math.min(
      100,
      Math.round((totalBookedHours / totalAvailableHours) * 100)
    );

    return {
      totalBookings: activeBookings.length,
      confirmedCount: confirmedOrPlaying.length,
      pendingCount,
      totalRevenue,
      totalBookedHours: Math.round(totalBookedHours * 10) / 10,
      occupancyRate,
    };
  }, [scheduleData.bookings, displayedCourts.length, viewMode]);

  function handleNavigateDate(direction: -1 | 1) {
    const cur = parseDateIso(selectedDate);
    if (viewMode === 'day') {
      cur.setDate(cur.getDate() + direction);
    } else if (viewMode === 'week') {
      cur.setDate(cur.getDate() + direction * 7);
    } else {
      cur.setMonth(cur.getMonth() + direction);
    }
    setSelectedDate(formatDateIso(cur));
  }

  function handleOpenWalkInModal(courtId?: number, dateIso?: string, hour?: number) {
    const defaultCourt = courtId || displayedCourts[0]?.courtId || 0;
    const targetDate = dateIso || selectedDate;
    const startH = hour !== undefined ? hour : 17;
    const endH = Math.min(23, startH + 1);
    const startStr = `${String(startH).padStart(2, '0')}:00`;
    const endStr = `${String(endH).padStart(2, '0')}:00`;

    if (isPastSlot(targetDate, startStr)) {
      setErrorMsg(
        `Khung giờ ${startStr} - ${endStr} ngày ${formatDateVi(targetDate)} đã qua. Không thể đặt sân cho thời gian trong quá khứ.`
      );
      return;
    }

    setBookingForm({
      courtId: defaultCourt,
      bookingDate: targetDate,
      startTime: startStr,
      endTime: endStr,
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      depositAmount: 0,
      status: 'CONFIRMED',
    });
    setIsBookingModalOpen(true);
  }

  const estimatedWalkInPrice = useMemo(() => {
    const court = scheduleData.courts.find(
      (c) => c.courtId === Number(bookingForm.courtId)
    );
    return estimateDynamicPriceClient(
      court,
      bookingForm.bookingDate,
      bookingForm.startTime,
      bookingForm.endTime
    );
  }, [
    scheduleData.courts,
    bookingForm.courtId,
    bookingForm.bookingDate,
    bookingForm.startTime,
    bookingForm.endTime,
  ]);

  async function handleSubmitWalkInBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingForm.courtId) {
      setErrorMsg('Vui lòng chọn sân thể thao.');
      return;
    }
    if (!bookingForm.customerPhone.trim()) {
      setErrorMsg('Vui lòng nhập Số điện thoại khách hàng.');
      return;
    }
    if (isPastSlot(bookingForm.bookingDate, bookingForm.startTime)) {
      setErrorMsg(
        `Khung giờ ${bookingForm.startTime} ngày ${formatDateVi(bookingForm.bookingDate)} đã qua. Vui lòng chọn khung giờ trong tương lai.`
      );
      return;
    }

    setSubmittingBooking(true);
    setErrorMsg(null);
    try {
      await createWalkInBookingApi({
        courtId: Number(bookingForm.courtId),
        bookingDate: bookingForm.bookingDate,
        startTime: bookingForm.startTime,
        endTime: bookingForm.endTime,
        depositAmount: Number(bookingForm.depositAmount || 0),
        status: bookingForm.status,
        customerName: bookingForm.customerName,
        customerPhone: bookingForm.customerPhone,
        customerEmail: bookingForm.customerEmail,
      });
      setIsBookingModalOpen(false);
      showToast('Đã tạo đơn đặt sân mới thành công!');
      await loadSchedule();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(
        e.response?.data?.message ||
          'Không thể tạo lịch đặt sân (kiểm tra trùng giờ hoặc quyền hạn).'
      );
    } finally {
      setSubmittingBooking(false);
    }
  }

  async function handleChangeBookingStatus(newStatus: string) {
    if (!activeBooking) return;
    setUpdatingStatus(true);
    try {
      await updateBookingStatusApi(activeBooking.bookingId, newStatus);
      showToast(`Đã cập nhật trạng thái đơn #${activeBooking.bookingId} thành ${newStatus}`);
      setActiveBooking(null);
      await loadSchedule();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(
        e.response?.data?.message || 'Cập nhật trạng thái đơn thất bại.'
      );
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleSubmitMaintenance(e: React.FormEvent) {
    e.preventDefault();
    if (!maintForm.courtId) return;
    try {
      await createMaintenanceApi({
        courtId: Number(maintForm.courtId),
        date: maintForm.date,
        startTime: maintForm.startTime,
        endTime: maintForm.endTime,
        reason: maintForm.reason,
      });
      setIsMaintModalOpen(false);
      showToast('Đã khóa khung giờ bảo trì sân thành công!');
      await loadSchedule();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(
        e.response?.data?.message || 'Không thể thêm lịch bảo trì sân.'
      );
    }
  }

  async function handleDeleteMaintenance(m: ScheduleMaintenance) {
    if (!isOwner) return;
    if (
      !window.confirm(
        `Mở khóa bảo trì sân "${m.courtName}" (${m.startTime} - ${m.endTime})?`
      )
    )
      return;
    try {
      await deleteMaintenanceApi(m.maintenanceId);
      showToast('Đã mở khóa lịch bảo trì sân.');
      await loadSchedule();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Không thể xóa lịch bảo trì.');
    }
  }

  const weekDays = useMemo(() => {
    const mon = getMondayOfWeek(parseDateIso(selectedDate));
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + idx);
      const iso = formatDateIso(d);
      return {
        iso,
        dayLabel: WEEKDAY_LABELS[idx],
        dayNum: d.getDate(),
        monthNum: d.getMonth() + 1,
        isToday: iso === formatDateIso(new Date()),
      };
    });
  }, [selectedDate]);

  const monthCells = useMemo(() => {
    const base = parseDateIso(selectedDate);
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOffset = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();

    const cells: Array<{
      iso: string | null;
      dayNum: number | null;
      bookings: ScheduleBooking[];
      completedCount: number;
      pendingCount: number;
      revenue: number;
    }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({
        iso: null,
        dayNum: null,
        bookings: [],
        completedCount: 0,
        pendingCount: 0,
        revenue: 0,
      });
    }

    for (let day = 1; day <= totalDays; day++) {
      const iso = formatDateIso(new Date(year, month, day));
      const dayBookings = scheduleData.bookings.filter(
        (b) => b.bookingDate === iso && b.status !== 'CANCELLED'
      );
      const completedCount = dayBookings.filter(
        (b) => b.status === 'COMPLETED'
      ).length;
      const pendingCount = dayBookings.filter(
        (b) =>
          b.status === 'PENDING' ||
          b.status === 'CONFIRMED' ||
          b.status === 'CHECKED-IN'
      ).length;
      const rev = dayBookings
        .filter((b) =>
          ['CONFIRMED', 'CHECKED-IN', 'COMPLETED'].includes(b.status)
        )
        .reduce((s, b) => s + (b.totalPrice || 0), 0);

      cells.push({
        iso,
        dayNum: day,
        bookings: dayBookings,
        completedCount,
        pendingCount,
        revenue: rev,
      });
    }

    return cells;
  }, [selectedDate, scheduleData.bookings]);

  return (
    <div className="flex-1 flex flex-col gap-4">
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl text-sm font-medium flex items-center gap-2">
          <span>✓</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
              WBS 3.1 • Quản lý lịch sân
            </span>
            <span className="text-xs text-slate-400">
              Cập nhật theo thời gian thực (06:00 – 23:00)
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 mt-1">
            Lịch Hoạt Động Sân (Ngày / Tuần / Tháng)
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Theo dõi trực quan các khung giờ trống, đã đặt, đang chơi hoặc bảo trì và tạo đơn đặt sân tại quầy.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setMaintForm({
                  courtId: displayedCourts[0]?.courtId || 0,
                  date: selectedDate,
                  startTime: '12:00',
                  endTime: '14:00',
                  reason: 'Bảo trì mặt sân & hệ thống đèn',
                });
                setIsMaintModalOpen(true);
              }}
              className="px-3.5 py-2.5 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs md:text-sm font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>🔧</span>
              <span>Khóa bảo trì</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenWalkInModal()}
            className="px-4 py-2.5 rounded-2xl bg-[#2563eb] hover:bg-blue-700 text-white text-xs md:text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>＋</span>
            <span>Đặt sân trực tiếp (Walk-in)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Tổng lượt đặt sân</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {kpiStats.totalBookings}{' '}
              <span className="text-xs font-normal text-slate-400">ca</span>
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">
              ✓ {kpiStats.confirmedCount} ca đã xác nhận / hoàn thành
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
            📅
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Đơn chờ xác nhận</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {kpiStats.pendingCount}{' '}
              <span className="text-xs font-normal text-slate-400">đơn</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Cần kiểm tra cọc & duyệt lịch
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg">
            ⏳
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Tỷ lệ lấp đầy lịch</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">
              {kpiStats.occupancyRate}%
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {kpiStats.totalBookedHours} giờ đã được đặt
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
            📊
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Doanh thu lịch đặt</p>
            <p className="text-xl md:text-2xl font-bold text-emerald-600 mt-1">
              {formatVnd(kpiStats.totalRevenue)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Tính theo bảng giá khung giờ động
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
            💰
          </div>
        </div>
      </div>

      {/* Thanh công cụ điều hướng Ngày/Tuần/Tháng & Bộ lọc Cơ sở / Sân con / Môn thể thao / Trạng thái */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center">
            {(
              [
                { id: 'day', label: 'Theo Ngày' },
                { id: 'week', label: 'Theo Tuần' },
                { id: 'month', label: 'Theo Tháng' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === tab.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl px-2 py-1">
            <button
              type="button"
              onClick={() => handleNavigateDate(-1)}
              className="p-1.5 rounded-xl hover:bg-slate-200/70 text-slate-600 text-xs font-bold cursor-pointer"
              title="Trước"
            >
              ◀
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) =>
                e.target.value && setSelectedDate(e.target.value)
              }
              className="bg-transparent text-xs md:text-sm font-semibold text-slate-800 px-1.5 focus:outline-none cursor-pointer"
            />
            <button
              type="button"
              onClick={() => handleNavigateDate(1)}
              className="p-1.5 rounded-xl hover:bg-slate-200/70 text-slate-600 text-xs font-bold cursor-pointer"
              title="Tiếp theo"
            >
              ▶
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSelectedDate(formatDateIso(new Date()))}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            Hôm nay
          </button>
        </div>

        {/* Bộ lọc Cơ sở, Môn thể thao, Sân con & Trạng thái */}
        <div className="flex flex-wrap items-center gap-2">
          {(scheduleData.facilities || []).length > 0 && (
            <select
              value={selectedFacilityId}
              onChange={(e) => {
                setSelectedFacilityId(e.target.value);
                setSelectedCourtId('ALL');
              }}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">🏢 Tất cả cơ sở</option>
              {(scheduleData.facilities || []).map((f) => (
                <option key={f.facilityId} value={String(f.facilityId)}>
                  {f.facilityName}
                </option>
              ))}
            </select>
          )}

          <select
            value={selectedSportId}
            onChange={(e) => {
              setSelectedSportId(e.target.value);
              setSelectedCourtId('ALL');
            }}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">🏅 Tất cả môn thể thao</option>
            {scheduleData.sports.map((sp) => (
              <option key={sp.sportId} value={String(sp.sportId)}>
                {sp.sportName}
              </option>
            ))}
          </select>

          <select
            value={selectedCourtId}
            onChange={(e) => setSelectedCourtId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">
              🏟️ Tất cả sân ({scheduleData.courts.length})
            </option>
            {scheduleData.courts.map((c) => (
              <option key={c.courtId} value={String(c.courtId)}>
                {c.courtName} ({c.sportName})
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">📌 Mọi trạng thái đơn</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="PENDING">Chờ xác nhận</option>
            <option value="CHECKED-IN">Đang chơi (Checked-in)</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Chú thích màu sắc trạng thái */}
      <div className="bg-white rounded-2xl px-4 py-2.5 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-slate-700">Chú thích trạng thái:</span>
          <span className="flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-3 rounded bg-white border border-dashed border-slate-300 inline-block" />
            Trống (Bấm để đặt)
          </span>
          <span className="flex items-center gap-1.5 text-blue-700 font-medium">
            <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
            Đã xác nhận
          </span>
          <span className="flex items-center gap-1.5 text-amber-700 font-medium">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            Chờ xác nhận
          </span>
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            Đang chơi (Check-in)
          </span>
          <span className="flex items-center gap-1.5 text-indigo-700 font-medium">
            <span className="w-3 h-3 rounded bg-indigo-500 inline-block" />
            Hoàn thành
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-3 h-3 rounded bg-slate-400 inline-block" />
            Bảo trì sân
          </span>
        </div>
        <div className="text-slate-400 text-[11px]">
          Khoảng ngày:{' '}
          <strong className="text-slate-600">
            {formatDateVi(dateRange.startDate)}
          </strong>{' '}
          →{' '}
          <strong className="text-slate-600">
            {formatDateVi(dateRange.endDate)}
          </strong>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs md:text-sm flex items-center justify-between">
          <span>⚠️ {errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-rose-500 hover:text-rose-800 font-bold ml-4 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Nội dung chính theo chế độ xem Ngày / Tuần / Tháng */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12 text-slate-500 text-sm">
            Đang tải lịch hoạt động sân...
          </div>
        ) : displayedCourts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <p className="text-base font-semibold text-slate-700">
              Không tìm thấy sân thể thao nào phù hợp với bộ lọc
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Hãy chọn lại Cơ sở hoặc Môn thể thao để xem lịch.
            </p>
          </div>
        ) : viewMode === 'day' ? (
          /* ======================== 1. VIEW THEO NGÀY (06:00 - 23:00) ======================== */
          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse min-w-[1150px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                  <th className="sticky left-0 z-10 bg-slate-50 p-3.5 text-left font-bold w-60 border-r border-slate-200">
                    Sân thể thao / Khung giờ ({formatDateVi(selectedDate)})
                  </th>
                  {HOURS.map((h) => (
                    <th
                      key={h}
                      className="p-2 text-center font-semibold border-r border-slate-200/70 min-w-[78px]"
                    >
                      <div>{String(h).padStart(2, '0')}:00</div>
                      <div className="text-[10px] font-normal text-slate-400">
                        -{String(h + 1).padStart(2, '0')}:00
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedCourts.map((court) => {
                  const courtBookings = scheduleData.bookings.filter(
                    (b) =>
                      b.courtId === court.courtId &&
                      b.bookingDate === selectedDate &&
                      b.status !== 'CANCELLED'
                  );
                  const courtMaints = scheduleData.maintenances.filter(
                    (m) => m.courtId === court.courtId && m.date === selectedDate
                  );

                  const cells: React.ReactNode[] = [];
                  let hIdx = 0;

                  while (hIdx < HOURS.length) {
                    const hour = HOURS[hIdx];

                    const matchedBooking = courtBookings.find((b) => {
                      const sh = Math.floor(timeToHourFloat(b.startTime));
                      const eh = Math.ceil(timeToHourFloat(b.endTime));
                      return hour >= sh && hour < eh;
                    });

                    if (matchedBooking) {
                      const eh = Math.min(
                        23,
                        Math.ceil(timeToHourFloat(matchedBooking.endTime))
                      );
                      const span = Math.max(1, eh - hour);
                      const badge =
                        STATUS_BADGE[matchedBooking.status] ||
                        STATUS_BADGE.CONFIRMED;

                      cells.push(
                        <td
                          key={`b-${court.courtId}-${hour}`}
                          colSpan={span}
                          onClick={() => setActiveBooking(matchedBooking)}
                          className="p-1.5 border-r border-b border-slate-200/80 align-top cursor-pointer"
                        >
                          <div
                            className={`h-full min-h-[76px] rounded-2xl p-2.5 border ${badge.bg} ${badge.border} hover:shadow-md transition-all flex flex-col justify-between`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wide ${badge.text} flex items-center gap-1`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}
                                  />
                                  {badge.label}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500">
                                  {matchedBooking.startTime} -{' '}
                                  {matchedBooking.endTime}
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-800 truncate mt-1">
                                {matchedBooking.playerName}
                              </p>
                              {matchedBooking.playerPhone && (
                                <p className="text-[11px] font-medium text-slate-600 truncate">
                                  📞 {matchedBooking.playerPhone}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-200/60 text-[11px]">
                              <span className="text-slate-500 truncate">
                                #{matchedBooking.bookingId}
                              </span>
                              <span className="font-bold text-slate-800">
                                {formatVnd(matchedBooking.totalPrice)}
                              </span>
                            </div>
                          </div>
                        </td>
                      );
                      hIdx += span;
                      continue;
                    }

                    const matchedMaint = courtMaints.find((m) => {
                      const sh = Math.floor(timeToHourFloat(m.startTime));
                      const eh = Math.ceil(timeToHourFloat(m.endTime));
                      return hour >= sh && hour < eh;
                    });

                    if (matchedMaint) {
                      const eh = Math.min(
                        23,
                        Math.ceil(timeToHourFloat(matchedMaint.endTime))
                      );
                      const span = Math.max(1, eh - hour);
                      cells.push(
                        <td
                          key={`m-${court.courtId}-${hour}`}
                          colSpan={span}
                          onClick={() => handleDeleteMaintenance(matchedMaint)}
                          title={
                            isOwner
                              ? 'Bấm để mở khóa bảo trì'
                              : matchedMaint.reason
                          }
                          className={`p-1.5 border-r border-b border-slate-200/80 align-top ${
                            isOwner ? 'cursor-pointer' : ''
                          }`}
                        >
                          <div className="h-full min-h-[76px] rounded-2xl p-2.5 bg-slate-100 border border-slate-300 text-slate-600 flex flex-col justify-between hover:bg-slate-200/70 transition-colors">
                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-500">
                                🔧 Đang bảo trì
                              </span>
                              <p className="text-xs font-semibold text-slate-700 mt-1 line-clamp-2">
                                {matchedMaint.reason}
                              </p>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {matchedMaint.startTime} - {matchedMaint.endTime}
                            </span>
                          </div>
                        </td>
                      );
                      hIdx += span;
                      continue;
                    }

                    const slotStartStr = `${String(hour).padStart(2, '0')}:00`;
                    const slotEndStr = `${String(hour + 1).padStart(2, '0')}:00`;
                    const slotPrice = estimateDynamicPriceClient(
                      court,
                      selectedDate,
                      slotStartStr,
                      slotEndStr
                    );
                    const isPeak = hour >= 16 && hour < 21;
                    const pastSlot = isPastSlot(selectedDate, slotStartStr);

                    cells.push(
                      <td
                        key={`empty-${court.courtId}-${hour}`}
                        onClick={() => {
                          if (!pastSlot) {
                            handleOpenWalkInModal(
                              court.courtId,
                              selectedDate,
                              hour
                            );
                          }
                        }}
                        title={
                          pastSlot
                            ? `Khung giờ ${slotStartStr} - ${slotEndStr} đã qua`
                            : `Bấm để đặt ${court.courtName} lúc ${slotStartStr}`
                        }
                        className={`p-1.5 border-r border-b border-slate-200/70 group transition-colors ${
                          pastSlot
                            ? 'bg-slate-100/70 cursor-not-allowed'
                            : 'cursor-pointer hover:bg-blue-50/50'
                        }`}
                      >
                        <div
                          className={`h-full min-h-[76px] rounded-2xl border border-dashed p-2 flex flex-col items-center justify-center text-center transition-all ${
                            pastSlot
                              ? 'border-slate-200 bg-slate-100/80 opacity-60'
                              : isPeak
                                ? 'border-orange-200/80 bg-orange-50/20 group-hover:border-blue-400'
                                : 'border-slate-200 group-hover:border-blue-400'
                          }`}
                        >
                          <span
                            className={`text-[11px] font-medium ${
                              pastSlot
                                ? 'text-slate-400 line-through'
                                : 'text-slate-400 group-hover:text-blue-600'
                            }`}
                          >
                            {formatVnd(slotPrice)}
                          </span>
                          {pastSlot ? (
                            <span className="text-[10px] text-slate-400 mt-1">
                              Đã qua
                            </span>
                          ) : (
                            <span className="text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 mt-1">
                              + Đặt sân
                            </span>
                          )}
                        </div>
                      </td>
                    );
                    hIdx += 1;
                  }

                  return (
                    <tr
                      key={court.courtId}
                      className="hover:bg-slate-50/40 transition-colors"
                    >
                      <td className="sticky left-0 z-10 bg-white p-3.5 border-r border-b border-slate-200 align-top">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 mb-1">
                              {court.sportName}
                            </span>
                            <h3 className="text-sm font-bold text-slate-800 leading-snug">
                              {court.courtName}
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                              {court.facilityName || court.address}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              court.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-600'
                                : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {court.status === 'ACTIVE' ? 'Mở' : 'Bảo trì'}
                          </span>
                        </div>
                      </td>
                      {cells}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : viewMode === 'week' ? (
          /* ======================== 2. VIEW THEO TUẦN (7 NGÀY) ======================== */
          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse min-w-[980px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <th className="p-3.5 text-left font-bold w-44 border-r border-slate-200">
                    Ca trong ngày / Thứ
                  </th>
                  {weekDays.map((wd) => {
                    const dayCount = scheduleData.bookings.filter(
                      (b) => b.bookingDate === wd.iso && b.status !== 'CANCELLED'
                    ).length;
                    return (
                      <th
                        key={wd.iso}
                        onClick={() => {
                          setSelectedDate(wd.iso);
                          setViewMode('day');
                        }}
                        className={`p-3 text-center border-r border-slate-200 cursor-pointer hover:bg-blue-50/50 transition-colors ${
                          wd.isToday ? 'bg-blue-50/60 text-blue-700' : ''
                        }`}
                      >
                        <div className="font-bold">{wd.dayLabel}</div>
                        <div className="text-xs font-medium text-slate-500 mt-0.5">
                          {String(wd.dayNum).padStart(2, '0')}/
                          {String(wd.monthNum).padStart(2, '0')}
                        </div>
                        <div className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/70 text-slate-700">
                          {dayCount} lượt đặt
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    id: 'morning',
                    label: '🌅 Ca Sáng',
                    sub: '06:00 – 12:00',
                    minH: 6,
                    maxH: 12,
                  },
                  {
                    id: 'afternoon',
                    label: '☀️ Ca Chiều',
                    sub: '12:00 – 17:00',
                    minH: 12,
                    maxH: 17,
                  },
                  {
                    id: 'evening',
                    label: '🔥 Ca Tối (Cao điểm)',
                    sub: '17:00 – 23:00',
                    minH: 17,
                    maxH: 23,
                  },
                ].map((shift) => (
                  <tr key={shift.id} className="border-b border-slate-200">
                    <td className="p-3.5 border-r border-slate-200 bg-slate-50/50 align-top">
                      <div className="font-bold text-xs md:text-sm text-slate-800">
                        {shift.label}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {shift.sub}
                      </div>
                    </td>
                    {weekDays.map((wd) => {
                      const shiftBookings = scheduleData.bookings.filter((b) => {
                        if (b.bookingDate !== wd.iso || b.status === 'CANCELLED')
                          return false;
                        if (
                          selectedCourtId !== 'ALL' &&
                          String(b.courtId) !== selectedCourtId
                        )
                          return false;
                        const sh = timeToHourFloat(b.startTime);
                        return sh >= shift.minH && sh < shift.maxH;
                      });

                      return (
                        <td
                          key={`${shift.id}-${wd.iso}`}
                          className="p-2 border-r border-slate-200 align-top min-w-[140px]"
                        >
                          <div className="flex flex-col gap-1.5 min-h-[115px]">
                            {shiftBookings.map((b) => {
                              const badge =
                                STATUS_BADGE[b.status] || STATUS_BADGE.CONFIRMED;
                              return (
                                <div
                                  key={b.bookingId}
                                  onClick={() => setActiveBooking(b)}
                                  className={`p-2 rounded-xl border ${badge.bg} ${badge.border} cursor-pointer hover:shadow-sm transition-all`}
                                >
                                  <div className="flex items-center justify-between text-[10px] font-bold">
                                    <span className={badge.text}>
                                      {b.startTime}-{b.endTime}
                                    </span>
                                    <span className="text-slate-600">
                                      {formatVnd(b.totalPrice)}
                                    </span>
                                  </div>
                                  <div className="text-xs font-bold text-slate-800 truncate mt-0.5">
                                    {b.playerName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {b.courtName}
                                  </div>
                                </div>
                              );
                            })}

                            {(() => {
                              const defaultSlotHour =
                                shift.minH === 6
                                  ? 8
                                  : shift.minH === 12
                                    ? 14
                                    : 18;
                              const isShiftPast = isPastSlot(
                                wd.iso,
                                `${String(shift.maxH - 1).padStart(2, '0')}:00`
                              );
                              if (isShiftPast) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleOpenWalkInModal(
                                      displayedCourts[0]?.courtId,
                                      wd.iso,
                                      Math.max(
                                        defaultSlotHour,
                                        wd.iso === formatDateIso(new Date())
                                          ? Math.min(22, new Date().getHours() + 1)
                                          : defaultSlotHour
                                      )
                                    )
                                  }
                                  className="mt-auto py-1.5 rounded-xl border border-dashed border-slate-300 text-[11px] text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/40 transition-colors cursor-pointer"
                                >
                                  + Đặt ca này
                                </button>
                              );
                            })()}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ======================== 3. VIEW THEO THÁNG ======================== */
          <div className="p-4 flex-1">
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-600">
              {WEEKDAY_LABELS.map((lbl) => (
                <div key={lbl} className="py-2 bg-slate-50 rounded-xl">
                  {lbl}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {monthCells.map((cell, idx) => {
                if (!cell.iso) {
                  return (
                    <div
                      key={`blank-${idx}`}
                      className="min-h-[115px] rounded-2xl bg-slate-50/50 border border-slate-100"
                    />
                  );
                }
                const isToday = cell.iso === formatDateIso(new Date());
                return (
                  <div
                    key={cell.iso}
                    onClick={() => {
                      if (cell.iso) {
                        setSelectedDate(cell.iso);
                        setViewMode('day');
                      }
                    }}
                    className={`min-h-[115px] rounded-2xl p-2.5 border transition-all cursor-pointer flex flex-col justify-between hover:shadow-md ${
                      isToday
                        ? 'border-blue-400 bg-blue-50/20'
                        : 'border-slate-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${
                          isToday
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-700'
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {cell.bookings.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                          {cell.bookings.length} ca
                        </span>
                      )}
                    </div>

                    {cell.bookings.length > 0 ? (
                      <div className="my-1.5 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                            ✓ {cell.completedCount} xong
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">
                            ⏳ {cell.pendingCount} chờ/đặt
                          </span>
                        </div>
                        {cell.bookings.slice(0, 1).map((b) => (
                          <div
                            key={b.bookingId}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 truncate"
                          >
                            {b.startTime} • {b.playerName}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-300 my-auto text-center">
                        Trống lịch
                      </div>
                    )}

                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Doanh thu:</span>
                      <span className="font-bold text-emerald-600">
                        {formatVnd(cell.revenue)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ======================== MODAL 1: TẠO ĐƠN ĐẶT SÂN TẠI QUẦY (WALK-IN) ======================== */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Đặt Sân Trực Tiếp Tại Quầy (Walk-in)
                </h2>
                <p className="text-xs text-slate-500">
                  Hệ thống tự động kiểm tra chống trùng giờ và tính giá theo khung giờ động.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBookingModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitWalkInBooking} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn sân thể thao *
                </label>
                <select
                  value={bookingForm.courtId}
                  onChange={(e) =>
                    setBookingForm({
                      ...bookingForm,
                      courtId: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-2xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  required
                >
                  {scheduleData.courts.map((c) => (
                    <option key={c.courtId} value={c.courtId}>
                      {c.courtName} ({c.sportName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày đặt *
                  </label>
                  <input
                    type="date"
                    min={formatDateIso(new Date())}
                    value={bookingForm.bookingDate}
                    onChange={(e) =>
                      setBookingForm({
                        ...bookingForm,
                        bookingDate: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs md:text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Giờ bắt đầu *
                  </label>
                  <select
                    value={bookingForm.startTime}
                    onChange={(e) =>
                      setBookingForm({
                        ...bookingForm,
                        startTime: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs md:text-sm focus:outline-none focus:border-blue-500"
                  >
                    {HOURS.map((h) => {
                      const t = `${String(h).padStart(2, '0')}:00`;
                      const disabled = isPastSlot(bookingForm.bookingDate, t);
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
                    Giờ kết thúc *
                  </label>
                  <select
                    value={bookingForm.endTime}
                    onChange={(e) =>
                      setBookingForm({
                        ...bookingForm,
                        endTime: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-xs md:text-sm focus:outline-none focus:border-blue-500"
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
                    Tên khách hàng
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Nguyễn Văn A"
                    value={bookingForm.customerName}
                    onChange={(e) =>
                      setBookingForm({
                        ...bookingForm,
                        customerName: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số điện thoại khách *
                  </label>
                  <input
                    type="tel"
                    placeholder="VD: 0912345678"
                    value={bookingForm.customerPhone}
                    onChange={(e) =>
                      setBookingForm({
                        ...bookingForm,
                        customerPhone: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tiền cọc / Đã thu trước (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={10000}
                    value={bookingForm.depositAmount}
                    onChange={(e) =>
                      setBookingForm({
                        ...bookingForm,
                        depositAmount: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Trạng thái ban đầu
                  </label>
                  <select
                    value={bookingForm.status}
                    onChange={(e) =>
                      setBookingForm({
                        ...bookingForm,
                        status: e.target.value,
                      })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="CONFIRMED">Đã xác nhận (Giữ sân)</option>
                    <option value="CHECKED-IN">Khách nhận sân ngay (Check-in)</option>
                    <option value="PENDING">Chờ xác nhận</option>
                  </select>
                </div>
              </div>

              <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-blue-800">
                    Tổng tiền tính tự động (Giá động TC01)
                  </p>
                  <p className="text-[11px] text-blue-600">
                    Tự động tách giá giờ thường / cao điểm / cuối tuần / ngày lễ
                  </p>
                </div>
                <div className="text-lg font-bold text-blue-700">
                  {formatVnd(estimatedWalkInPrice)}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="px-4 py-2 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingBooking || estimatedWalkInPrice <= 0}
                  className="px-5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-xs font-semibold shadow-md cursor-pointer"
                >
                  {submittingBooking ? 'Đang lưu...' : 'Xác nhận đặt sân'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================== MODAL 2: CHI TIẾT ĐƠN & CẬP NHẬT TRẠNG THÁI ======================== */}
      {activeBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-blue-600">
                  Mã đơn #{activeBooking.bookingId}
                </span>
                <h3 className="text-lg font-bold text-slate-800">
                  Chi Tiết Lịch Đặt Sân
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveBooking(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-2.5 text-xs md:text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Sân thể thao:</span>
                <span className="font-bold text-slate-800">
                  {activeBooking.courtName} ({activeBooking.sportName})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Ngày & Khung giờ:</span>
                <span className="font-bold text-blue-600">
                  {formatDateVi(activeBooking.bookingDate)} •{' '}
                  {activeBooking.startTime} - {activeBooking.endTime}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Khách đặt sân:</span>
                <span className="font-semibold text-slate-800">
                  {activeBooking.playerName} (★ {activeBooking.reputationScore})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Số điện thoại:</span>
                <span className="font-medium text-slate-700">
                  {activeBooking.playerPhone || 'Chưa cập nhật'}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Tổng tiền sân:</span>
                <span className="font-bold text-emerald-600">
                  {formatVnd(activeBooking.totalPrice)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Tiền đã cọc:</span>
                <span className="font-semibold text-slate-700">
                  {formatVnd(activeBooking.depositAmount)}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Trạng thái hiện tại:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    STATUS_BADGE[activeBooking.status]?.bg
                  } ${STATUS_BADGE[activeBooking.status]?.text}`}
                >
                  {STATUS_BADGE[activeBooking.status]?.label ||
                    activeBooking.status}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2.5">
                Thao tác chuyển trạng thái nhanh:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {activeBooking.status === 'PENDING' && (
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleChangeBookingStatus('CONFIRMED')}
                    className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    ✓ Xác nhận giữ sân
                  </button>
                )}
                {['PENDING', 'CONFIRMED'].includes(activeBooking.status) && (
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleChangeBookingStatus('CHECKED-IN')}
                    className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    🏃 Khách nhận sân (Check-in)
                  </button>
                )}
                {['CONFIRMED', 'CHECKED-IN'].includes(activeBooking.status) && (
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleChangeBookingStatus('COMPLETED')}
                    className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    💰 Hoàn thành & Thu đủ tiền
                  </button>
                )}
                {['PENDING', 'CONFIRMED'].includes(activeBooking.status) && (
                  <button
                    type="button"
                    disabled={updatingStatus}
                    onClick={() => handleChangeBookingStatus('NO-SHOW')}
                    className="py-2 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    ⚠️ Khách không đến (No-show)
                  </button>
                )}
                {activeBooking.status !== 'CANCELLED' &&
                  activeBooking.status !== 'COMPLETED' && (
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => handleChangeBookingStatus('CANCELLED')}
                      className="py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-semibold cursor-pointer col-span-2"
                    >
                      ✕ Hủy lịch đặt sân này
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================== MODAL 3: KHÓA BẢO TRÌ SÂN ======================== */}
      {isMaintModalOpen && isOwner && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                🔧 Khóa Khung Giờ Bảo Trì Sân
              </h3>
              <button
                type="button"
                onClick={() => setIsMaintModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitMaintenance} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chọn sân bảo trì *
                </label>
                <select
                  value={maintForm.courtId}
                  onChange={(e) =>
                    setMaintForm({
                      ...maintForm,
                      courtId: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-2xl border border-slate-300 px-3.5 py-2 text-sm"
                  required
                >
                  {scheduleData.courts.map((c) => (
                    <option key={c.courtId} value={c.courtId}>
                      {c.courtName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày
                  </label>
                  <input
                    type="date"
                    value={maintForm.date}
                    onChange={(e) =>
                      setMaintForm({ ...maintForm, date: e.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-2.5 py-2 text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Từ giờ
                  </label>
                  <select
                    value={maintForm.startTime}
                    onChange={(e) =>
                      setMaintForm({ ...maintForm, startTime: e.target.value })
                    }
                    className="w-full rounded-2xl border border-slate-300 px-2.5 py-2 text-xs"
                  >
                    {HOURS.map((h) => {
                      const t = `${String(h).padStart(2, '0')}:00`;
                      return (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Đến giờ
                  </label>
                  <select
                    value={maintForm.endTime}
                    onChange={(e) =>
                      setMaintForm({ ...maintForm, endTime: e.target.value })
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý do bảo trì *
                </label>
                <input
                  type="text"
                  value={maintForm.reason}
                  onChange={(e) =>
                    setMaintForm({ ...maintForm, reason: e.target.value })
                  }
                  className="w-full rounded-2xl border border-slate-300 px-3.5 py-2 text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMaintModalOpen(false)}
                  className="px-4 py-2 rounded-2xl border border-slate-300 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold cursor-pointer"
                >
                  Khóa lịch bảo trì
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

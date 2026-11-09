import { useState, useEffect, useMemo } from "react";
import {
  getScheduleDataApi,
  createWalkInBookingApi,
  updateBookingStatusApi,
  createMaintenanceApi,
  deleteMaintenanceApi,
  type ScheduleCourtItem,
  type ScheduleBookingItem,
  type ScheduleMaintenanceItem,
  type ScheduleSportOption,
  type BookingStatus,
} from "./booking.api";
import { formatCurrency } from "../../shared/utils/format";

type ViewMode = "DAY" | "WEEK" | "MONTH";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00 -> 21:00 (kết thúc 22:00)

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMondayOfWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function timeToHourNumber(t: string): number {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return (h || 0) + (m || 0) / 60;
}

function estimatePriceFromCourt(
  court: ScheduleCourtItem | undefined,
  dateStr: string,
  startTime: string,
  endTime: string
): number {
  const startH = timeToHourNumber(startTime);
  const endH = timeToHourNumber(endTime);
  if (endH <= startH) return 0;

  if (!court || !court.prices || court.prices.length === 0) {
    return Math.round((endH - startH) * 200000);
  }

  const dt = new Date(`${dateStr}T00:00:00`);
  const dow = dt.getDay();
  const dayType = dow === 0 || dow === 6 ? "WEEKEND" : "WEEKDAY";

  let rules = court.prices.filter((p) => p.dayType === dayType);
  if (rules.length === 0) rules = court.prices;

  let total = 0;
  for (let h = startH; h < endH; h += 0.5) {
    const mid = h + 0.25;
    const rule = rules.find(
      (r) => mid >= timeToHourNumber(r.startTime) && mid <= timeToHourNumber(r.endTime)
    );
    const rate = rule ? rule.price : rules[0].price;
    total += rate * 0.5;
  }
  return Math.round(total);
}

const STATUS_META: Record<
  BookingStatus,
  { label: string; badgeClass: string; slotClass: string; dotColor: string }
> = {
  PENDING: {
    label: "Chờ xác nhận",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    slotClass: "bg-amber-50/90 border-amber-300 text-amber-900 hover:bg-amber-100",
    dotColor: "bg-amber-500",
  },
  CONFIRMED: {
    label: "Đã xác nhận",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    slotClass: "bg-blue-50/90 border-blue-300 text-blue-900 hover:bg-blue-100",
    dotColor: "bg-blue-500",
  },
  "CHECKED-IN": {
    label: "Đang thi đấu",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
    slotClass: "bg-indigo-50/90 border-indigo-300 text-indigo-900 hover:bg-indigo-100",
    dotColor: "bg-indigo-500",
  },
  COMPLETED: {
    label: "Hoàn thành",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    slotClass: "bg-emerald-50/90 border-emerald-300 text-emerald-900 hover:bg-emerald-100",
    dotColor: "bg-emerald-500",
  },
  CANCELLED: {
    label: "Đã hủy",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    slotClass: "bg-slate-100 border-slate-300 text-slate-500 line-through",
    dotColor: "bg-slate-400",
  },
  "NO-SHOW": {
    label: "Khách bỏ kèo",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    slotClass: "bg-rose-50/90 border-rose-300 text-rose-900 hover:bg-rose-100",
    dotColor: "bg-rose-500",
  },
};

export default function CourtSchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("DAY");
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateStr(new Date()));
  const [selectedCourtId, setSelectedCourtId] = useState<string>("ALL");
  const [selectedSportId, setSelectedSportId] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const [sports, setSports] = useState<ScheduleSportOption[]>([]);
  const [courts, setCourts] = useState<ScheduleCourtItem[]>([]);
  const [bookings, setBookings] = useState<ScheduleBookingItem[]>([]);
  const [maintenances, setMaintenances] = useState<ScheduleMaintenanceItem[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal chi tiết đơn đặt sân
  const [activeBooking, setActiveBooking] = useState<ScheduleBookingItem | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);

  // Modal tạo đơn đặt sân trực tiếp (Walk-in Booking)
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [bookingForm, setBookingForm] = useState({
    courtId: 0,
    bookingDate: toDateStr(new Date()),
    startTime: "17:00",
    endTime: "19:00",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    depositAmount: 0,
    status: "CONFIRMED" as BookingStatus,
  });

  // Modal khóa bảo trì sân
  const [isMaintOpen, setIsMaintOpen] = useState<boolean>(false);
  const [maintSubmitting, setMaintSubmitting] = useState<boolean>(false);
  const [maintForm, setMaintForm] = useState({
    courtId: 0,
    date: toDateStr(new Date()),
    startTime: "13:00",
    endTime: "15:00",
    reason: "Bảo dưỡng mặt sân & kiểm tra đèn chiếu sáng",
  });

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  // Tính toán khoảng ngày [startDate, endDate] dựa theo chế độ Ngày / Tuần / Tháng
  const dateRange = useMemo(() => {
    const base = new Date(`${selectedDate}T00:00:00`);
    if (viewMode === "DAY") {
      return { startDate: selectedDate, endDate: selectedDate };
    }
    if (viewMode === "WEEK") {
      const monday = getMondayOfWeek(base);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { startDate: toDateStr(monday), endDate: toDateStr(sunday) };
    }
    // MONTH
    const firstDay = new Date(base.getFullYear(), base.getMonth(), 1);
    const lastDay = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return { startDate: toDateStr(firstDay), endDate: toDateStr(lastDay) };
  }, [selectedDate, viewMode]);

  useEffect(() => {
    loadSchedule();
  }, [dateRange.startDate, dateRange.endDate, selectedSportId, selectedStatus]);

  async function loadSchedule() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getScheduleDataApi({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        sportId: selectedSportId,
        status: selectedStatus,
      });
      setSports(data.sports || []);
      setCourts(data.courts || []);
      setBookings(data.bookings || []);
      setMaintenances(data.maintenances || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Không thể tải dữ liệu lịch sân.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  // Danh sách sân hiển thị sau khi lọc theo sân được chọn
  const visibleCourts = useMemo(() => {
    if (selectedCourtId === "ALL") return courts;
    return courts.filter((c) => String(c.courtId) === selectedCourtId);
  }, [courts, selectedCourtId]);

  // Danh sách bookings sau khi lọc theo sân
  const visibleBookings = useMemo(() => {
    if (selectedCourtId === "ALL") return bookings;
    return bookings.filter((b) => String(b.courtId) === selectedCourtId);
  }, [bookings, selectedCourtId]);

  // Thống kê nhanh trên thanh KPI
  const kpiStats = useMemo(() => {
    const activeList = visibleBookings.filter((b) => b.status !== "CANCELLED");
    const total = visibleBookings.length;
    const pending = visibleBookings.filter((b) => b.status === "PENDING").length;
    const confirmedOrPlaying = visibleBookings.filter((b) =>
      ["CONFIRMED", "CHECKED-IN"].includes(b.status)
    ).length;
    const completed = visibleBookings.filter((b) => b.status === "COMPLETED").length;

    const bookedHours = activeList.reduce((sum, b) => {
      return sum + Math.max(0, timeToHourNumber(b.endTime) - timeToHourNumber(b.startTime));
    }, 0);

    const numDays =
      viewMode === "DAY" ? 1 : viewMode === "WEEK" ? 7 : 30;
    const totalSlotHours = Math.max(1, visibleCourts.length * 16 * numDays);
    const emptyHours = Math.max(0, totalSlotHours - bookedHours);

    return {
      total,
      pending,
      confirmedOrPlaying,
      completed,
      bookedHours: Math.round(bookedHours * 10) / 10,
      emptyHours: Math.round(emptyHours * 10) / 10,
    };
  }, [visibleBookings, visibleCourts, viewMode]);

  // Điều hướng ngày / tuần / tháng trước - sau
  function shiftDate(direction: -1 | 1) {
    const cur = new Date(`${selectedDate}T00:00:00`);
    if (viewMode === "DAY") {
      cur.setDate(cur.getDate() + direction);
    } else if (viewMode === "WEEK") {
      cur.setDate(cur.getDate() + direction * 7);
    } else {
      cur.setMonth(cur.getMonth() + direction);
    }
    setSelectedDate(toDateStr(cur));
  }

  // Mở modal đặt sân nhanh khi bấm vào ô trống trên lịch
  function openQuickBookModal(courtId?: number, dateStr?: string, hour?: number) {
    const defaultCourt = courtId || visibleCourts[0]?.courtId || courts[0]?.courtId || 0;
    const dStr = dateStr || selectedDate;
    const startH = hour !== undefined ? String(hour).padStart(2, "0") + ":00" : "17:00";
    const endH =
      hour !== undefined
        ? String(Math.min(22, hour + 2)).padStart(2, "0") + ":00"
        : "19:00";

    setCreateError(null);
    setBookingForm({
      courtId: defaultCourt,
      bookingDate: dStr,
      startTime: startH,
      endTime: endH,
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      depositAmount: 0,
      status: "CONFIRMED",
    });
    setIsCreateOpen(true);
  }

  const estimatedTotalPrice = useMemo(() => {
    const court = courts.find((c) => c.courtId === Number(bookingForm.courtId));
    return estimatePriceFromCourt(
      court,
      bookingForm.bookingDate,
      bookingForm.startTime,
      bookingForm.endTime
    );
  }, [
    courts,
    bookingForm.courtId,
    bookingForm.bookingDate,
    bookingForm.startTime,
    bookingForm.endTime,
  ]);

  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateError(null);
    try {
      await createWalkInBookingApi({
        courtId: Number(bookingForm.courtId),
        bookingDate: bookingForm.bookingDate,
        startTime: bookingForm.startTime,
        endTime: bookingForm.endTime,
        totalPrice: estimatedTotalPrice,
        depositAmount: Number(bookingForm.depositAmount || 0),
        status: bookingForm.status,
        customerName: bookingForm.customerName,
        customerPhone: bookingForm.customerPhone,
        customerEmail: bookingForm.customerEmail,
      });
      setIsCreateOpen(false);
      showToast("Đã tạo đơn đặt sân mới trên lịch thành công!");
      await loadSchedule();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Không thể tạo đơn đặt sân. Vui lòng kiểm tra lại khung giờ.";
      setCreateError(msg);
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function handleStatusChange(bookingId: number, nextStatus: BookingStatus) {
    setUpdatingStatus(true);
    try {
      await updateBookingStatusApi(bookingId, nextStatus, "CASH");
      showToast(`Đã cập nhật trạng thái đơn #${bookingId} sang "${STATUS_META[nextStatus].label}".`);
      setActiveBooking(null);
      await loadSchedule();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Không thể cập nhật trạng thái đơn.";
      alert(msg);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleCreateMaintenance(e: React.FormEvent) {
    e.preventDefault();
    setMaintSubmitting(true);
    try {
      await createMaintenanceApi({
        courtId: Number(maintForm.courtId || courts[0]?.courtId),
        date: maintForm.date,
        startTime: maintForm.startTime,
        endTime: maintForm.endTime,
        reason: maintForm.reason,
      });
      setIsMaintOpen(false);
      showToast("Đã khóa khung giờ bảo trì sân thành công.");
      await loadSchedule();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Không thể tạo lịch bảo trì.";
      alert(msg);
    } finally {
      setMaintSubmitting(false);
    }
  }

  async function handleRemoveMaintenance(maintenanceId: number) {
    if (!confirm("Bạn có chắc muốn mở khóa khung giờ bảo trì này?")) return;
    try {
      await deleteMaintenanceApi(maintenanceId);
      showToast("Đã mở khóa lịch bảo trì sân.");
      await loadSchedule();
    } catch {
      alert("Không thể xóa lịch bảo trì.");
    }
  }

  // Danh sách 7 ngày của chế độ xem Tuần (Week View)
  const weekDays = useMemo(() => {
    const monday = getMondayOfWeek(new Date(`${selectedDate}T00:00:00`));
    const labels = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];
    return labels.map((label, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const dateStr = toDateStr(d);
      const [, m, day] = dateStr.split("-");
      return {
        label,
        shortDate: `${day}/${m}`,
        dateStr,
      };
    });
  }, [selectedDate]);

  // Danh sách các ô lịch của chế độ xem Tháng (Month View)
  const monthCalendarCells = useMemo(() => {
    const base = new Date(`${selectedDate}T00:00:00`);
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startOffset = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;
    const totalDays = lastDayOfMonth.getDate();

    const cells: Array<{
      dateStr: string | null;
      dayNum: number | null;
      bookings: ScheduleBookingItem[];
      revenue: number;
    }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateStr: null, dayNum: null, bookings: [], revenue: 0 });
    }

    for (let day = 1; day <= totalDays; day++) {
      const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayBookings = visibleBookings.filter((b) => b.bookingDate === ds);
      const dayRevenue = dayBookings
        .filter((b) => ["COMPLETED", "CONFIRMED", "CHECKED-IN"].includes(b.status))
        .reduce((s, b) => s + b.totalPrice, 0);

      cells.push({
        dateStr: ds,
        dayNum: day,
        bookings: dayBookings,
        revenue: dayRevenue,
      });
    }

    return cells;
  }, [selectedDate, visibleBookings]);

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-[calc(100vh-2rem)]">
      {/* Toast thông báo */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl shadow-2xl font-medium text-sm">
          <span>✓</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Header Thẻ Trắng */}
      <div className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Lịch Hoạt Động & Đặt Sân
            </h1>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-200">
              Ngày / Tuần / Tháng
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi trực quan các khung giờ sân trống, sân đã đặt, lịch bảo trì và xử lý check-in tại sân
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setMaintForm({
                courtId: courts[0]?.courtId || 0,
                date: selectedDate,
                startTime: "13:00",
                endTime: "15:00",
                reason: "Bảo dưỡng định kỳ mặt sân",
              });
              setIsMaintOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-2xl transition-colors cursor-pointer"
          >
            <span>🔧</span>
            <span>Khóa bảo trì sân</span>
          </button>

          <button
            type="button"
            onClick={() => openQuickBookModal()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-blue-500/25 cursor-pointer transition-all"
          >
            <span>+ Đặt sân tại quầy</span>
          </button>
        </div>
      </div>

      {/* 2. Thẻ KPI Tổng quan Lịch sân */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Tổng lượt đặt trong kỳ
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {kpiStats.total} <span className="text-xs font-medium text-slate-400">đơn</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
            Khung giờ còn trống
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {kpiStats.emptyHours} <span className="text-xs font-medium text-slate-400">giờ</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
            Đã đặt / Đang thi đấu
          </span>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {kpiStats.confirmedOrPlaying} <span className="text-xs font-medium text-slate-400">ca</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">
            Chờ xác nhận
          </span>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {kpiStats.pending} <span className="text-xs font-medium text-slate-400">đơn</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm col-span-2 lg:col-span-1">
          <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider block">
            Đã hoàn thành
          </span>
          <div className="text-2xl font-black text-indigo-600 mt-1">
            {kpiStats.completed} <span className="text-xs font-medium text-slate-400">trận</span>
          </div>
        </div>
      </div>

      {/* 3. Thanh công cụ Chuyển đổi Ngày / Tuần / Tháng & Bộ lọc Sân */}
      <div className="shrink-0 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        {/* Chuyển đổi chế độ xem Ngày / Tuần / Tháng */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(
              [
                { key: "DAY", label: "Theo Ngày" },
                { key: "WEEK", label: "Theo Tuần" },
                { key: "MONTH", label: "Theo Tháng" },
              ] as { key: ViewMode; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setViewMode(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === tab.key
                    ? "bg-[#202230] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Điều hướng thời gian */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              ← Trước
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => shiftDate(1)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
            >
              Sau →
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(toDateStr(new Date()))}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold cursor-pointer"
            >
              Hôm nay
            </button>
          </div>
        </div>

        {/* Bộ lọc Môn thể thao, Sân con & Trạng thái */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedSportId}
            onChange={(e) => {
              setSelectedSportId(e.target.value);
              setSelectedCourtId("ALL");
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Tất cả môn thể thao</option>
            {sports.map((sp) => (
              <option key={sp.sportId} value={String(sp.sportId)}>
                Môn: {sp.sportName}
              </option>
            ))}
          </select>

          <select
            value={selectedCourtId}
            onChange={(e) => setSelectedCourtId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Tất cả các sân ({courts.length})</option>
            {courts.map((c) => (
              <option key={c.courtId} value={String(c.courtId)}>
                {c.courtName} ({c.sportName})
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Mọi trạng thái đơn</option>
            <option value="PENDING">Chờ xác nhận</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="CHECKED-IN">Đang thi đấu</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>
      </div>

      {/* Chú thích màu sắc trạng thái */}
      <div className="shrink-0 flex flex-wrap items-center gap-4 px-2 text-xs text-slate-600">
        <span className="font-bold text-slate-700">Chú thích:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-300 inline-block" />
          <span>Còn trống (Bấm để đặt)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-200 border border-amber-400 inline-block" />
          <span>Chờ xác nhận</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-200 border border-blue-400 inline-block" />
          <span>Đã xác nhận</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-indigo-200 border border-indigo-400 inline-block" />
          <span>Đang thi đấu (Checked-in)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-500 inline-block" />
          <span>Hoàn thành</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-300 border border-slate-400 inline-block" />
          <span>Đang bảo trì</span>
        </span>
      </div>

      {/* 4. Nội dung Lịch sân chính */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16 text-slate-500 gap-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Đang tải dữ liệu lịch hoạt động sân...</span>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <p className="text-red-600 font-semibold">{errorMsg}</p>
            <button
              type="button"
              onClick={loadSchedule}
              className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        ) : visibleCourts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <p className="font-semibold text-base text-slate-700">
              Chưa có sân thể thao nào trong phạm vi hiển thị
            </p>
            <p className="text-xs mt-1">
              Vui lòng chọn lại bộ lọc môn thể thao hoặc thêm sân mới.
            </p>
          </div>
        ) : viewMode === "DAY" ? (
          /* ================= CHẾ ĐỘ XEM THEO NGÀY (DAY VIEW) ================= */
          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-xs min-w-[960px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3.5 text-left font-bold w-56 border-r border-slate-200">
                    Sân thể thao / Khung giờ ({selectedDate})
                  </th>
                  {HOURS.map((h) => (
                    <th
                      key={h}
                      className="px-1.5 py-3 text-center font-bold border-r border-slate-100 min-w-[74px]"
                    >
                      {String(h).padStart(2, "0")}:00
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleCourts.map((court) => {
                  const courtBookings = visibleBookings.filter(
                    (b) =>
                      b.courtId === court.courtId &&
                      b.bookingDate === selectedDate &&
                      b.status !== "CANCELLED"
                  );
                  const courtMaints = maintenances.filter(
                    (m) => m.courtId === court.courtId && m.date === selectedDate
                  );

                  return (
                    <tr key={court.courtId} className="hover:bg-slate-50/40">
                      {/* Cột Tên sân */}
                      <td className="sticky left-0 z-10 bg-white px-4 py-4 border-r border-slate-200 align-top">
                        <div className="font-bold text-slate-900 text-xs leading-snug">
                          {court.courtName}
                        </div>
                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-semibold">
                          <span>🏅 {court.sportName}</span>
                        </div>
                      </td>

                      {/* Các ô giờ từ 06:00 -> 21:00 */}
                      {HOURS.map((hour) => {
                        const matchedBooking = courtBookings.find((b) => {
                          const s = timeToHourNumber(b.startTime);
                          const e = timeToHourNumber(b.endTime);
                          return hour >= s && hour < e;
                        });

                        const matchedMaint = courtMaints.find((m) => {
                          const s = timeToHourNumber(m.startTime);
                          const e = timeToHourNumber(m.endTime);
                          return hour >= s && hour < e;
                        });

                        if (matchedMaint) {
                          return (
                            <td
                              key={hour}
                              onClick={() => handleRemoveMaintenance(matchedMaint.maintenanceId)}
                              title={`Đang bảo trì: ${matchedMaint.reason} (Bấm để mở khóa)`}
                              className="p-1 border-r border-slate-100 bg-slate-200/80 text-slate-700 cursor-pointer hover:bg-slate-300/70 transition-colors"
                            >
                              <div className="p-1.5 rounded-lg text-[10px] font-semibold leading-tight">
                                <div>🔧 Bảo trì</div>
                                <div className="truncate text-[9px] text-slate-500">
                                  {matchedMaint.reason}
                                </div>
                              </div>
                            </td>
                          );
                        }

                        if (matchedBooking) {
                          const meta = STATUS_META[matchedBooking.status] || STATUS_META.CONFIRMED;
                          const isStartHour =
                            Math.floor(timeToHourNumber(matchedBooking.startTime)) === hour;

                          return (
                            <td
                              key={hour}
                              onClick={() => setActiveBooking(matchedBooking)}
                              className="p-1 border-r border-slate-100 align-top cursor-pointer"
                            >
                              <div
                                className={`h-full min-h-[60px] p-1.5 rounded-xl border transition-all ${meta.slotClass}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dotColor}`}
                                  />
                                  <span className="text-[9px] font-bold truncate">
                                    {matchedBooking.startTime}-{matchedBooking.endTime}
                                  </span>
                                </div>
                                <div className="font-bold text-[10px] truncate mt-1">
                                  {matchedBooking.playerName}
                                </div>
                                {isStartHour && (
                                  <div className="text-[9px] opacity-80 truncate">
                                    {formatCurrency(matchedBooking.totalPrice)}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        }

                        // Ô Trống -> Cho phép bấm để đặt sân
                        return (
                          <td
                            key={hour}
                            onClick={() =>
                              openQuickBookModal(court.courtId, selectedDate, hour)
                            }
                            className="p-1 border-r border-slate-100 group cursor-pointer"
                          >
                            <div className="h-full min-h-[60px] rounded-xl border border-dashed border-emerald-200/80 bg-emerald-50/25 group-hover:bg-emerald-50 group-hover:border-emerald-400 transition-all flex flex-col items-center justify-center text-center p-1">
                              <span className="text-[10px] font-semibold text-emerald-700 opacity-60 group-hover:opacity-100">
                                Trống
                              </span>
                              <span className="text-[9px] text-emerald-600 opacity-0 group-hover:opacity-100 font-bold">
                                + Đặt
                              </span>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : viewMode === "WEEK" ? (
          /* ================= CHẾ ĐỘ XEM THEO TUẦN (WEEK VIEW) ================= */
          <div className="flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-xs min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <th className="px-4 py-3.5 text-left font-bold w-32 border-r border-slate-200">
                    Khung giờ
                  </th>
                  {weekDays.map((wd) => {
                    const dayCount = visibleBookings.filter(
                      (b) => b.bookingDate === wd.dateStr && b.status !== "CANCELLED"
                    ).length;
                    const isToday = wd.dateStr === toDateStr(new Date());
                    return (
                      <th
                        key={wd.dateStr}
                        className={`px-3 py-3 text-center border-r border-slate-200 ${
                          isToday ? "bg-blue-50/70" : ""
                        }`}
                      >
                        <div className="font-extrabold text-slate-900">{wd.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{wd.shortDate}</div>
                        <span className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-700">
                          {dayCount} ca đặt
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[
                  { label: "Ca Sáng (06:00 - 10:00)", start: 6, end: 10 },
                  { label: "Ca Trưa (10:00 - 14:00)", start: 10, end: 14 },
                  { label: "Ca Chiều (14:00 - 17:00)", start: 14, end: 17 },
                  { label: "Giờ Cao Điểm (17:00 - 20:00)", start: 17, end: 20 },
                  { label: "Ca Tối Muộn (20:00 - 23:00)", start: 20, end: 23 },
                ].map((block) => (
                  <tr key={block.label} className="hover:bg-slate-50/40">
                    <td className="px-4 py-4 font-bold text-slate-800 border-r border-slate-200 bg-slate-50/50">
                      {block.label}
                    </td>
                    {weekDays.map((wd) => {
                      const slotBookings = visibleBookings.filter((b) => {
                        if (b.bookingDate !== wd.dateStr) return false;
                        const s = timeToHourNumber(b.startTime);
                        return s >= block.start && s < block.end;
                      });

                      return (
                        <td
                          key={wd.dateStr}
                          className="p-2 border-r border-slate-100 align-top min-w-[130px]"
                        >
                          <div className="flex flex-col gap-1.5">
                            {slotBookings.map((b) => {
                              const meta = STATUS_META[b.status] || STATUS_META.CONFIRMED;
                              return (
                                <div
                                  key={b.bookingId}
                                  onClick={() => setActiveBooking(b)}
                                  className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${meta.slotClass}`}
                                >
                                  <div className="flex items-center justify-between font-bold text-[10px]">
                                    <span>
                                      {b.startTime} - {b.endTime}
                                    </span>
                                    <span>{formatCurrency(b.totalPrice)}</span>
                                  </div>
                                  <div className="font-bold text-xs truncate mt-0.5">
                                    {b.playerName}
                                  </div>
                                  <div className="text-[10px] opacity-75 truncate">
                                    {b.courtName}
                                  </div>
                                </div>
                              );
                            })}

                            <button
                              type="button"
                              onClick={() =>
                                openQuickBookModal(
                                  visibleCourts[0]?.courtId,
                                  wd.dateStr,
                                  block.start
                                )
                              }
                              className="w-full py-1.5 rounded-lg border border-dashed border-emerald-300 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              + Đặt sân trống
                            </button>
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
          /* ================= CHẾ ĐỘ XEM THEO THÁNG (MONTH VIEW) ================= */
          <div className="p-4 flex-1 flex flex-col">
            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-600 uppercase">
              {["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"].map(
                (d) => (
                  <div key={d} className="py-2 bg-slate-50 rounded-xl border border-slate-200/70">
                    {d}
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-7 gap-2 flex-1">
              {monthCalendarCells.map((cell, idx) => {
                if (!cell.dateStr) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[105px] rounded-2xl bg-slate-50/50 border border-slate-100"
                    />
                  );
                }

                const isSelected = cell.dateStr === selectedDate;
                const activeCount = cell.bookings.filter(
                  (b) => b.status !== "CANCELLED"
                ).length;

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => {
                      setSelectedDate(cell.dateStr!);
                      setViewMode("DAY");
                    }}
                    className={`min-h-[105px] p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/30 shadow-sm"
                        : "border-slate-200 hover:border-blue-400 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center">
                        {cell.dayNum}
                      </span>
                      {activeCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                          {activeCount} ca đặt
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-emerald-600">
                          Còn trống
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 my-1.5">
                      {cell.bookings.slice(0, 2).map((b) => (
                        <div
                          key={b.bookingId}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 truncate font-medium"
                        >
                          {b.startTime} • {b.playerName}
                        </div>
                      ))}
                      {cell.bookings.length > 2 && (
                        <div className="text-[10px] text-blue-600 font-semibold pl-1">
                          +{cell.bookings.length - 2} lượt khác...
                        </div>
                      )}
                    </div>

                    {cell.revenue > 0 && (
                      <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg text-right">
                        {formatCurrency(cell.revenue)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================= MODAL XEM CHI TIẾT & CẬP NHẬT TRẠNG THÁI ĐƠN ================= */}
      {activeBooking && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fade-in">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                    STATUS_META[activeBooking.status]?.badgeClass
                  }`}
                >
                  {STATUS_META[activeBooking.status]?.label}
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-2">
                  Chi Tiết Đơn Đặt Sân #{activeBooking.bookingId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveBooking(null)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Sân thể thao:</span>
                <span className="font-bold text-slate-900">{activeBooking.courtName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Môn thể thao:</span>
                <span className="font-semibold text-blue-600">{activeBooking.sportName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Ngày & Khung giờ:</span>
                <span className="font-bold text-slate-900">
                  {activeBooking.bookingDate} ({activeBooking.startTime} - {activeBooking.endTime})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Khách hàng:</span>
                <span className="font-bold text-slate-900">
                  {activeBooking.playerName} (⭐ {activeBooking.reputationScore.toFixed(1)})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Số điện thoại:</span>
                <span className="font-semibold text-slate-800">
                  {activeBooking.playerPhone || "Chưa cập nhật"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Tổng tiền sân:</span>
                <span className="font-extrabold text-emerald-600 text-base">
                  {formatCurrency(activeBooking.totalPrice)}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Tiền đã cọc:</span>
                <span className="font-bold text-blue-600">
                  {formatCurrency(activeBooking.depositAmount)}
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2.5">
                Cập nhật trạng thái vận hành:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={updatingStatus || activeBooking.status === "CONFIRMED"}
                  onClick={() => handleStatusChange(activeBooking.bookingId, "CONFIRMED")}
                  className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                >
                  ✓ Xác nhận sân
                </button>
                <button
                  type="button"
                  disabled={updatingStatus || activeBooking.status === "CHECKED-IN"}
                  onClick={() => handleStatusChange(activeBooking.bookingId, "CHECKED-IN")}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                >
                  🏃 Check-in nhận sân
                </button>
                <button
                  type="button"
                  disabled={updatingStatus || activeBooking.status === "COMPLETED"}
                  onClick={() => handleStatusChange(activeBooking.bookingId, "COMPLETED")}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
                >
                  💰 Hoàn thành & Thu tiền
                </button>
                <button
                  type="button"
                  disabled={updatingStatus || activeBooking.status === "NO-SHOW"}
                  onClick={() => handleStatusChange(activeBooking.bookingId, "NO-SHOW")}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-40 text-xs font-bold cursor-pointer"
                >
                  ⚠ Khách không đến
                </button>
                <button
                  type="button"
                  disabled={updatingStatus || activeBooking.status === "CANCELLED"}
                  onClick={() => handleStatusChange(activeBooking.bookingId, "CANCELLED")}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 text-xs font-bold cursor-pointer"
                >
                  ✕ Hủy đơn đặt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL ĐẶT SÂN TẠI QUẦY (WALK-IN BOOKING) ================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900">
                Tạo Đơn Đặt Sân Trực Tiếp
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateBooking} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Chọn sân thể thao</label>
                <select
                  value={bookingForm.courtId}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, courtId: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-semibold text-slate-800"
                  required
                >
                  {courts.map((c) => (
                    <option key={c.courtId} value={c.courtId}>
                      {c.courtName} ({c.sportName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày đặt</label>
                  <input
                    type="date"
                    value={bookingForm.bookingDate}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, bookingDate: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giờ bắt đầu</label>
                  <select
                    value={bookingForm.startTime}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, startTime: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                  >
                    {HOURS.map((h) => {
                      const t = `${String(h).padStart(2, "0")}:00`;
                      return (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giờ kết thúc</label>
                  <select
                    value={bookingForm.endTime}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, endTime: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                  >
                    {HOURS.map((h) => {
                      const t = `${String(h + 1).padStart(2, "0")}:00`;
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
                  <label className="font-bold text-slate-700 block mb-1">
                    Tên khách hàng
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Nguyễn Văn A"
                    value={bookingForm.customerName}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, customerName: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Số điện thoại khách
                  </label>
                  <input
                    type="text"
                    placeholder="VD: 0909123456"
                    value={bookingForm.customerPhone}
                    onChange={(e) =>
                      setBookingForm({ ...bookingForm, customerPhone: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                    required
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-600 font-semibold block">
                    Giá tự động theo khung giờ (Giá động):
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Tự động tách giá giờ thường / cao điểm / cuối tuần
                  </span>
                </div>
                <span className="text-lg font-black text-blue-700">
                  {formatCurrency(estimatedTotalPrice)}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md cursor-pointer"
                >
                  {createSubmitting ? "Đang lưu..." : "Xác nhận đặt sân"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL KHÓA BẢO TRÌ SÂN ================= */}
      {isMaintOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900">
                🔧 Khóa Khung Giờ Bảo Trì Sân
              </h3>
              <button
                type="button"
                onClick={() => setIsMaintOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMaintenance} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Sân bảo trì</label>
                <select
                  value={maintForm.courtId}
                  onChange={(e) =>
                    setMaintForm({ ...maintForm, courtId: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-semibold"
                >
                  {courts.map((c) => (
                    <option key={c.courtId} value={c.courtId}>
                      {c.courtName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Ngày</label>
                  <input
                    type="date"
                    value={maintForm.date}
                    onChange={(e) => setMaintForm({ ...maintForm, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Từ giờ</label>
                  <input
                    type="time"
                    value={maintForm.startTime}
                    onChange={(e) =>
                      setMaintForm({ ...maintForm, startTime: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Đến giờ</label>
                  <input
                    type="time"
                    value={maintForm.endTime}
                    onChange={(e) =>
                      setMaintForm({ ...maintForm, endTime: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Lý do bảo trì</label>
                <input
                  type="text"
                  value={maintForm.reason}
                  onChange={(e) => setMaintForm({ ...maintForm, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMaintOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={maintSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
                >
                  {maintSubmitting ? "Đang lưu..." : "Khóa lịch sân"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


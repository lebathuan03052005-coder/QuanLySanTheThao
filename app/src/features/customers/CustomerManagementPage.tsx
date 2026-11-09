import { useState, useEffect, useMemo } from "react";
import {
  getCustomerListApi,
  getCustomerHistoryApi,
  updateCustomerReputationApi,
  type CustomerItem,
  type CustomerBookingHistoryItem,
  type CustomerSegment,
} from "./customer.api";
import { formatCurrency } from "../../shared/utils/format";

const SEGMENT_META: Record<
  CustomerSegment,
  { label: string; badgeClass: string; desc: string }
> = {
  VIP: {
    label: "Khách VIP / Thân thiết",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    desc: "Đặt thường xuyên & chi tiêu cao",
  },
  REGULAR: {
    label: "Khách quen",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    desc: "Có lịch sử đặt sân ổn định",
  },
  NEW: {
    label: "Khách mới",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    desc: "Mới đăng ký hoặc chưa phát sinh đơn",
  },
  WARNING: {
    label: "Cần lưu ý",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
    desc: "Có lịch sử hủy sát giờ hoặc No-show",
  },
};

export default function CustomerManagementPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [segmentFilter, setSegmentFilter] = useState<string>("ALL");

  // Phân trang
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Modal xem lịch sử đặt sân của khách hàng
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [historyList, setHistoryList] = useState<CustomerBookingHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>("ALL");

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, segmentFilter]);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function loadCustomers() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getCustomerListApi();
      setCustomers(data || []);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Không thể tải danh sách khách hàng.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenHistory(customer: CustomerItem) {
    setSelectedCustomer(customer);
    setHistoryStatusFilter("ALL");
    setHistoryLoading(true);
    try {
      const res = await getCustomerHistoryApi(customer.id);
      setSelectedCustomer(res.customer);
      setHistoryList(res.bookings || []);
    } catch {
      setHistoryList([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleToggleLockCustomer(customer: CustomerItem) {
    const nextStatus = customer.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
    try {
      await updateCustomerReputationApi(customer.id, { status: nextStatus });
      setCustomers((prev) =>
        prev.map((c) => (c.id === customer.id ? { ...c, status: nextStatus } : c))
      );
      showToast(
        nextStatus === "LOCKED"
          ? `Đã khóa tạm thời tài khoản khách hàng ${customer.fullName}.`
          : `Đã mở khóa tài khoản khách hàng ${customer.fullName}.`
      );
    } catch {
      alert("Không thể cập nhật trạng thái khách hàng.");
    }
  }

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q);
      const matchSegment =
        segmentFilter === "ALL" ? true : c.segment === segmentFilter;
      return matchSearch && matchSegment;
    });
  }, [customers, searchTerm, segmentFilter]);

  const kpiStats = useMemo(() => {
    const total = customers.length;
    const vipCount = customers.filter((c) => c.segment === "VIP").length;
    const totalBookings = customers.reduce((s, c) => s + c.totalBookings, 0);
    const totalRevenueFromCustomers = customers.reduce(
      (s, c) => s + c.totalSpent,
      0
    );
    const avgRep =
      total > 0
        ? (
            customers.reduce((s, c) => s + c.reputationScore, 0) / total
          ).toFixed(1)
        : "5.0";

    return {
      total,
      vipCount,
      totalBookings,
      totalRevenueFromCustomers,
      avgRep,
    };
  }, [customers]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCustomers.slice(start, start + pageSize);
  }, [filteredCustomers, currentPage]);

  const filteredHistory = useMemo(() => {
    if (historyStatusFilter === "ALL") return historyList;
    return historyList.filter((h) => h.status === historyStatusFilter);
  }, [historyList, historyStatusFilter]);

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-[calc(100vh-2rem)]">
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl shadow-2xl font-medium text-sm">
          <span>✓</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Header */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Quản Lý Khách Hàng & Lịch Sử Đặt Sân
            </h1>
            <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200">
              CRM Chủ Sân
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Tra cứu thông tin người chơi, điểm uy tín, tần suất đặt sân và toàn bộ lịch sử giao dịch tại cụm sân của bạn
          </p>
        </div>

        <button
          type="button"
          onClick={loadCustomers}
          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold cursor-pointer self-start sm:self-auto"
        >
          ↻ Làm mới dữ liệu
        </button>
      </div>

      {/* 2. Thẻ KPI Thống kê Khách hàng */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Tổng khách hàng
          </span>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {kpiStats.total}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Tài khoản người chơi trong hệ thống
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider block">
            Khách hàng thân thiết (VIP)
          </span>
          <div className="text-3xl font-black text-purple-600 mt-2">
            {kpiStats.vipCount}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Đặt thường xuyên / Chi tiêu cao
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
            Tổng chi tiêu khách hàng
          </span>
          <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-2 truncate">
            {formatCurrency(kpiStats.totalRevenueFromCustomers)}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Trên {kpiStats.totalBookings} lượt đặt sân
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">
            Điểm uy tín trung bình
          </span>
          <div className="text-3xl font-black text-amber-500 mt-2">
            ⭐ {kpiStats.avgRep} <span className="text-sm font-semibold text-slate-400">/ 5.0</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Đánh giá đúng giờ & fairplay
          </span>
        </div>
      </div>

      {/* 3. Thanh Tìm kiếm & Phân nhóm khách hàng */}
      <div className="shrink-0 flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên khách hàng, SĐT, email..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pl-9 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500"
          />
          <span className="absolute left-3 top-3 text-slate-400 text-xs">🔍</span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/70 w-full md:w-auto overflow-x-auto">
          {[
            { key: "ALL", label: "Tất cả khách" },
            { key: "VIP", label: "💎 Khách VIP" },
            { key: "REGULAR", label: "Khách quen" },
            { key: "NEW", label: "Khách mới" },
            { key: "WARNING", label: "⚠ Hay hủy / Bỏ kèo" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSegmentFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                segmentFilter === tab.key
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Bảng Danh Sách Khách Hàng */}
      <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16 text-slate-500 gap-3">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Đang tải danh sách khách hàng...</span>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-red-600">
            <p className="font-semibold">{errorMsg}</p>
            <button
              type="button"
              onClick={loadCustomers}
              className="mt-3 px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
            <div className="text-3xl mb-2">👤</div>
            <p className="font-bold text-slate-700">Không tìm thấy khách hàng phù hợp</p>
            <p className="text-xs mt-1">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc phân nhóm.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/90 text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-5 py-4">Liên hệ</th>
                    <th className="px-5 py-4 text-center">Điểm uy tín</th>
                    <th className="px-5 py-4 text-center">Lịch sử đặt (Hoàn thành / Hủy)</th>
                    <th className="px-5 py-4 text-right">Tổng chi tiêu</th>
                    <th className="px-5 py-4 text-center">Lần đặt gần nhất</th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedCustomers.map((cust) => {
                    const seg = SEGMENT_META[cust.segment] || SEGMENT_META.REGULAR;
                    return (
                      <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-blue-600 text-sm shrink-0">
                              {cust.fullName[0]?.toUpperCase() || "K"}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{cust.fullName}</div>
                              <span
                                className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${seg.badgeClass}`}
                              >
                                {seg.label}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-xs">
                          <div className="font-bold text-slate-800">{cust.phone}</div>
                          <div className="text-slate-500 mt-0.5">{cust.email}</div>
                        </td>

                        <td className="px-5 py-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-extrabold ${
                              cust.reputationScore >= 4.5
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : cust.reputationScore >= 4.0
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            ⭐ {cust.reputationScore.toFixed(1)}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-center text-xs">
                          <div className="font-bold text-slate-900">
                            Tổng: {cust.totalBookings} đơn
                          </div>
                          <div className="mt-0.5 flex items-center justify-center gap-2 text-[11px]">
                            <span className="text-emerald-600 font-semibold">
                              ✓ {cust.completedBookings + cust.activeBookings}
                            </span>
                            <span className="text-slate-300">|</span>
                            <span className="text-rose-600 font-semibold">
                              ✕ {cust.cancelledBookings + cust.noShowCount}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right font-extrabold text-slate-900">
                          {formatCurrency(cust.totalSpent)}
                        </td>

                        <td className="px-5 py-4 text-center text-xs text-slate-600 font-medium">
                          {cust.lastBookingDate || "Chưa đặt"}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenHistory(cust)}
                              className="px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-colors cursor-pointer"
                            >
                              📋 Lịch sử đặt ({cust.totalBookings})
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleLockCustomer(cust)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                                cust.status === "LOCKED"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-600"
                              }`}
                            >
                              {cust.status === "LOCKED" ? "Mở khóa" : "Khóa"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phân trang */}
            <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
              <span>
                Hiển thị {paginatedCustomers.length} / {filteredCustomers.length} khách hàng
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 font-semibold cursor-pointer"
                >
                  Trước
                </button>
                <span className="px-3 py-1.5 font-bold text-slate-800">
                  Trang {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40 font-semibold cursor-pointer"
                >
                  Sau
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ================= MODAL LỊCH SỬ ĐẶT SÂN CHI TIẾT CỦA KHÁCH HÀNG ================= */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-start justify-between gap-4 bg-slate-50/60">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center">
                  {selectedCustomer.fullName[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-lg font-extrabold text-slate-900">
                      {selectedCustomer.fullName}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      ⭐ {selectedCustomer.reputationScore.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    SĐT: <strong>{selectedCustomer.phone}</strong> • Email:{" "}
                    <strong>{selectedCustomer.email}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Thống kê tóm tắt của khách */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-white border-b border-slate-100 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                <span className="text-slate-500 block">Tổng lượt đặt sân</span>
                <span className="text-lg font-black text-slate-900">
                  {selectedCustomer.totalBookings} lần
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/70">
                <span className="text-emerald-700 block">Đã hoàn thành</span>
                <span className="text-lg font-black text-emerald-700">
                  {selectedCustomer.completedBookings} trận
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200/70">
                <span className="text-rose-700 block">Hủy / Bỏ kèo (No-show)</span>
                <span className="text-lg font-black text-rose-700">
                  {selectedCustomer.cancelledBookings + selectedCustomer.noShowCount} lần
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200/70">
                <span className="text-blue-700 block">Tổng chi tiêu tại sân</span>
                <span className="text-lg font-black text-blue-700">
                  {formatCurrency(selectedCustomer.totalSpent)}
                </span>
              </div>
            </div>

            {/* Bộ lọc trạng thái trong lịch sử */}
            <div className="px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700">
                Danh sách lịch sử đặt sân ({filteredHistory.length} đơn)
              </span>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="COMPLETED">Hoàn thành</option>
                <option value="CONFIRMED">Đã xác nhận</option>
                <option value="PENDING">Chờ xác nhận</option>
                <option value="CANCELLED">Đã hủy</option>
                <option value="NO-SHOW">Khách không đến</option>
              </select>
            </div>

            {/* Bảng lịch sử đặt sân */}
            <div className="flex-1 overflow-y-auto p-6">
              {historyLoading ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  Đang tải lịch sử đặt sân...
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  Khách hàng chưa có đơn đặt sân nào trong bộ lọc này.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-600 border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                      <th className="py-3 px-3">Mã đơn</th>
                      <th className="py-3 px-3">Sân thể thao</th>
                      <th className="py-3 px-3">Ngày & Giờ</th>
                      <th className="py-3 px-3 text-right">Tổng tiền</th>
                      <th className="py-3 px-3 text-center">Thanh toán</th>
                      <th className="py-3 px-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.map((item) => (
                      <tr key={item.bookingId} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-bold text-slate-900">
                          #{item.bookingId}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800">{item.courtName}</div>
                          <div className="text-[11px] text-blue-600">{item.sportName}</div>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-800">
                          <div>{item.bookingDate}</div>
                          <div className="text-[11px] text-slate-500">
                            {item.startTime} - {item.endTime}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-slate-900">
                          {formatCurrency(item.totalPrice)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                            {item.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              item.status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700"
                                : item.status === "CONFIRMED" || item.status === "CHECKED-IN"
                                  ? "bg-blue-50 text-blue-700"
                                  : item.status === "PENDING"
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-rose-50 text-rose-700"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


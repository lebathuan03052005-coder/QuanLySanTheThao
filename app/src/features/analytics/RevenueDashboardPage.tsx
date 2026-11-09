import { useState, useEffect, useMemo } from "react";
import {
  getRevenueDashboardApi,
  type RevenueDashboardData,
} from "./analytics.api";
import { formatCurrency } from "../../shared/utils/format";

type PeriodType = "day" | "week" | "month";

export default function RevenueDashboardPage() {
  const [period, setPeriod] = useState<PeriodType>("day");
  const [selectedCourtId, setSelectedCourtId] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [data, setData] = useState<RevenueDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadRevenue();
  }, [period, selectedCourtId]);

  async function loadRevenue(customStart?: string, customEnd?: string) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getRevenueDashboardApi({
        period,
        courtId: selectedCourtId,
        startDate: customStart || undefined,
        endDate: customEnd || undefined,
      });
      setData(res);
      if (!customStart) setStartDate(res.startDate);
      if (!customEnd) setEndDate(res.endDate);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Không thể tải dữ liệu báo cáo doanh thu.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  const maxChartRevenue = useMemo(() => {
    if (!data || data.chartData.length === 0) return 1;
    return Math.max(1, ...data.chartData.map((d) => d.revenue));
  }, [data]);

  function handleExportCsv() {
    if (!data) return;
    const headers = [
      "Ky bao cao",
      "So luot dat",
      "So don hoan thanh",
      "Doanh thu (VND)",
      "Tien coc (VND)",
    ];
    const rows = data.chartData.map((r) => [
      r.label,
      r.bookingCount,
      r.completedCount,
      r.revenue,
      r.deposit,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers, ...rows].map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bao_cao_doanh_thu_SportLink_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-[calc(100vh-2rem)]">
      {/* 1. Header */}
      <div className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Dashboard Doanh Thu & Tài Chính
            </h1>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              WBS 3.3 • Chỉ dành cho Chủ sân
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Thống kê doanh thu thực nhận, tiền đặt cọc, tỷ trọng theo từng sân và phương thức thanh toán theo Ngày / Tuần / Tháng
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-2xl transition-colors cursor-pointer"
          >
            <span>📥</span>
            <span>Xuất CSV</span>
          </button>
          <button
            type="button"
            onClick={() => loadRevenue(startDate, endDate)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-md cursor-pointer"
          >
            <span>↻ Làm mới</span>
          </button>
        </div>
      </div>

      {/* 2. Bộ lọc Kỳ báo cáo (Ngày / Tuần / Tháng) & Sân */}
      <div className="shrink-0 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(
              [
                { key: "day", label: "Theo Ngày" },
                { key: "week", label: "Theo Tuần" },
                { key: "month", label: "Theo Tháng" },
              ] as { key: PeriodType; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPeriod(tab.key)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === tab.key
                    ? "bg-[#202230] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-500">Từ:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700"
            />
            <span className="font-semibold text-slate-500">Đến:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-semibold text-slate-700"
            />
            <button
              type="button"
              onClick={() => loadRevenue(startDate, endDate)}
              className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold cursor-pointer"
            >
              Áp dụng
            </button>
          </div>
        </div>

        <select
          value={selectedCourtId}
          onChange={(e) => setSelectedCourtId(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700"
        >
          <option value="ALL">Tất cả các sân thuộc hệ thống</option>
          {(data?.courts || []).map((c) => (
            <option key={c.courtId} value={String(c.courtId)}>
              {c.courtName} ({c.sportName})
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Đang tổng hợp báo cáo doanh thu...</span>
        </div>
      ) : errorMsg ? (
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center text-red-600">
          <p className="font-bold">{errorMsg}</p>
        </div>
      ) : data ? (
        <>
          {/* 3. Hàng 4 Thẻ KPI Tài chính (Khớp thiết kế O-01) */}
          <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Tổng doanh thu trong kỳ
              </span>
              <div className="text-2xl md:text-3xl font-black text-emerald-600 mt-2">
                {formatCurrency(data.summary.totalRevenue)}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                Đã thu cọc: {formatCurrency(data.summary.totalDeposit)}
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Tổng số đơn đặt sân
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2">
                {data.summary.totalBookings} <span className="text-sm font-semibold text-slate-400">đơn</span>
              </div>
              <span className="text-xs text-emerald-600 font-semibold mt-1 block">
                ✓ {data.summary.completedBookings + data.summary.confirmedBookings} đơn thành công
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Giá trị đơn trung bình (AOV)
              </span>
              <div className="text-2xl md:text-3xl font-black text-blue-600 mt-2">
                {formatCurrency(data.summary.averageOrderValue)}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                Trung bình mỗi ca đặt sân
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Đơn hủy & Hoàn tiền
              </span>
              <div className="text-3xl font-black text-rose-600 mt-2">
                {data.summary.cancelledBookings + data.summary.noShowBookings}{" "}
                <span className="text-sm font-semibold text-slate-400">đơn</span>
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                Hoàn trả: {formatCurrency(data.summary.totalRefund)}
              </span>
            </div>
          </div>

          {/* 4. Biểu đồ cột Doanh thu & Cơ cấu theo Sân */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Biểu đồ cột Doanh thu theo Ngày / Tuần / Tháng */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Biểu Đồ Doanh Thu ({period === "day" ? "Theo Ngày" : period === "week" ? "Theo Tuần" : "Theo Tháng"})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Di chuột vào từng cột để xem chi tiết doanh thu và số lượt đặt sân
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                    {data.startDate} → {data.endDate}
                  </span>
                </div>

                {data.chartData.length === 0 ? (
                  <div className="h-60 flex items-center justify-center text-slate-400 text-sm">
                    Chưa có dữ liệu phát sinh trong khoảng thời gian này.
                  </div>
                ) : (
                  <div className="h-64 flex items-end gap-2.5 pt-8 pb-2 px-2 overflow-x-auto border-b border-slate-100">
                    {data.chartData.map((pt) => {
                      const heightPct = Math.max(
                        6,
                        Math.round((pt.revenue / maxChartRevenue) * 100)
                      );
                      return (
                        <div
                          key={pt.key}
                          className="flex-1 min-w-[44px] flex flex-col items-center justify-end h-full group"
                        >
                          {/* Giá trị nổi trên đầu cột */}
                          <span className="text-[10px] font-bold text-slate-600 mb-1 opacity-80 group-hover:opacity-100 group-hover:text-blue-600">
                            {pt.revenue > 0
                              ? `${Math.round(pt.revenue / 1000)}k`
                              : "0"}
                          </span>

                          {/* Cột biểu đồ */}
                          <div className="w-full max-w-[38px] bg-slate-100 rounded-t-xl h-44 flex items-end overflow-hidden">
                            <div
                              style={{ height: `${heightPct}%` }}
                              title={`${pt.label}: ${formatCurrency(pt.revenue)} (${pt.bookingCount} đơn)`}
                              className={`w-full rounded-t-xl transition-all duration-300 ${
                                pt.revenue > 0
                                  ? "bg-gradient-to-t from-blue-600 to-sky-400 group-hover:from-indigo-600 group-hover:to-blue-500"
                                  : "bg-slate-200"
                              }`}
                            />
                          </div>

                          {/* Nhãn trục X */}
                          <span className="text-[10px] font-bold text-slate-600 mt-2 truncate max-w-[60px]">
                            {pt.label}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {pt.bookingCount} đơn
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tỷ trọng theo Phương thức thanh toán */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-700 mb-2.5">
                  Phân bổ theo phương thức thanh toán:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {data.revenueByPaymentMethod.map((pm) => (
                    <div
                      key={pm.method}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-slate-700">
                        <span>{pm.label}</span>
                        <span className="text-blue-600">{pm.sharePercent}%</span>
                      </div>
                      <div className="font-extrabold text-slate-900 mt-1">
                        {formatCurrency(pm.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bảng Doanh thu theo từng Sân */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Doanh Thu Theo Sân Con
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">
                  Xếp hạng đóng góp doanh thu của từng sân trong hệ thống
                </p>

                <div className="space-y-3.5">
                  {data.revenueByCourt.map((court) => (
                    <div
                      key={court.courtId}
                      className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/70"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs truncate">
                            {court.courtName}
                          </div>
                          <span className="text-[11px] text-blue-600 font-semibold">
                            {court.sportName} • {court.bookingCount} lượt đặt
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-extrabold text-emerald-600 text-xs">
                            {formatCurrency(court.revenue)}
                          </div>
                          <span className="text-[10px] font-bold text-slate-500">
                            {court.sharePercent}% tổng DT
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mt-2">
                        <div
                          style={{ width: `${Math.min(100, court.sharePercent)}%` }}
                          className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Bảng Lịch sử giao dịch gần nhất */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Biên Lai Giao Dịch Gần Nhất ({data.recentTransactions.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-6">Mã GD</th>
                    <th className="py-3.5 px-4">Khách hàng</th>
                    <th className="py-3.5 px-4">Sân thể thao</th>
                    <th className="py-3.5 px-4">Loại giao dịch</th>
                    <th className="py-3.5 px-4">Phương thức</th>
                    <th className="py-3.5 px-6 text-right">Số tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.recentTransactions.map((tx) => (
                    <tr key={tx.transactionId} className="hover:bg-slate-50">
                      <td className="py-3 px-6 font-bold text-slate-900">
                        #TX-{tx.transactionId}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{tx.playerName}</div>
                        <div className="text-[11px] text-slate-400">{tx.playerPhone}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {tx.courtName}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            tx.transactionType === "FULL_PAYMENT"
                              ? "bg-emerald-50 text-emerald-700"
                              : tx.transactionType === "DEPOSIT"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {tx.transactionType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {tx.paymentMethod}
                      </td>
                      <td className="py-3 px-6 text-right font-extrabold text-emerald-600">
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}


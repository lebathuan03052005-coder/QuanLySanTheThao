import { useState, useEffect } from "react";
import {
  getOccupancyAnalyticsApi,
  type OccupancyAnalyticsData,
} from "./analytics.api";
import { formatCurrency } from "../../shared/utils/format";

type PeriodType = "day" | "week" | "month";

function getHeatmapCellStyle(rate: number): string {
  if (rate >= 70) {
    return "bg-blue-600 text-white font-bold shadow-xs";
  }
  if (rate >= 45) {
    return "bg-blue-400 text-white font-bold";
  }
  if (rate >= 20) {
    return "bg-blue-200 text-blue-900 font-semibold";
  }
  if (rate > 0) {
    return "bg-blue-50 text-blue-700 font-medium border border-blue-200";
  }
  return "bg-slate-50 text-slate-400 border border-slate-100";
}

export default function OccupancyAnalyticsPage() {
  const [period, setPeriod] = useState<PeriodType>("month");
  const [selectedCourtId, setSelectedCourtId] = useState<string>("ALL");
  const [data, setData] = useState<OccupancyAnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadOccupancy();
  }, [period, selectedCourtId]);

  async function loadOccupancy() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getOccupancyAnalyticsApi({
        period,
        courtId: selectedCourtId,
      });
      setData(res);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Không thể tải dữ liệu thống kê tỷ lệ lấp đầy sân.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-[calc(100vh-2rem)]">
      {/* 1. Header */}
      <div className="shrink-0 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Thống Kê Tỷ Lệ Lấp Đầy & Khung Giờ Vắng
            </h1>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              WBS 3.3 • Hiệu suất khai thác sân
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Phân tích mật độ đặt sân theo ma trận Giờ × Thứ trong tuần và đề xuất khuyến mãi cho các khung giờ vắng khách
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {(
              [
                { key: "day", label: "7 ngày qua" },
                { key: "week", label: "4 tuần qua" },
                { key: "month", label: "30 ngày qua" },
              ] as { key: PeriodType; label: string }[]
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPeriod(tab.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  period === tab.key
                    ? "bg-[#202230] text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={selectedCourtId}
            onChange={(e) => setSelectedCourtId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-700"
          >
            <option value="ALL">Tất cả các sân</option>
            {(data?.courts || []).map((c) => (
              <option key={c.courtId} value={String(c.courtId)}>
                {c.courtName} ({c.sportName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Đang phân tích tỷ lệ lấp đầy sân...</span>
        </div>
      ) : errorMsg ? (
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 p-12 flex flex-col items-center justify-center text-center text-red-600">
          <p className="font-bold">{errorMsg}</p>
        </div>
      ) : data ? (
        <>
          {/* 2. Hàng 4 Thẻ KPI Lấp đầy sân */}
          <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Tỷ lệ lấp đầy trung bình
              </span>
              <div className="text-3xl font-black text-blue-600 mt-2">
                {data.summary.overallOccupancyRate}%
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                {data.summary.totalBookedHours}h đặt / {data.summary.totalAvailableHours}h khả dụng
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
                Khung giờ vàng (Cao điểm)
              </span>
              <div className="text-2xl font-black text-emerald-600 mt-2">
                🔥 {data.summary.peakHourSlot}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                Mật độ đặt sân cao nhất
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider block">
                Khung giờ vắng nhất
              </span>
              <div className="text-2xl font-black text-amber-600 mt-2">
                📉 {data.summary.quietHourSlot}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                Cần ưu đãi hoặc đẩy mạnh cáp kèo
              </span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Số sân đang khai thác
              </span>
              <div className="text-3xl font-black text-slate-900 mt-2">
                {data.summary.activeCourtsCount}{" "}
                <span className="text-sm font-semibold text-slate-400">sân</span>
              </div>
              <span className="text-xs text-slate-400 mt-1 block">
                Chu kỳ phân tích: {data.numDays} ngày
              </span>
            </div>
          </div>

          {/* 3. Ma trận Heatmap Giờ × Thứ & Hiệu suất từng sân */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Heatmap: Lấp đầy Giờ × Thứ (Khớp thiết kế Figma O-01) */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Biểu Đồ Nhiệt Tỷ Lệ Lấp Đầy: Khung Giờ × Thứ Trong Tuần
                  </h3>
                  <p className="text-xs text-slate-500">
                    Màu xanh càng đậm thể hiện tỷ lệ lấp đầy sân càng cao; ô nhạt màu là các khung giờ đang trống nhiều
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                  <span>0%</span>
                  <span className="w-3 h-3 rounded bg-slate-100 inline-block" />
                  <span className="w-3 h-3 rounded bg-blue-200 inline-block" />
                  <span className="w-3 h-3 rounded bg-blue-400 inline-block" />
                  <span className="w-3 h-3 rounded bg-blue-600 inline-block" />
                  <span>100%</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs border-separate border-spacing-1.5 min-w-[620px]">
                  <thead>
                    <tr className="text-slate-600 font-bold">
                      <th className="text-left py-2 px-2 w-32">Khung giờ</th>
                      {[
                        "Thứ 2",
                        "Thứ 3",
                        "Thứ 4",
                        "Thứ 5",
                        "Thứ 6",
                        "Thứ 7",
                        "Chủ Nhật",
                      ].map((d) => (
                        <th key={d} className="text-center py-2 px-2">
                          {d}
                        </th>
                      ))}
                      <th className="text-right py-2 px-2">TB Khung giờ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.heatmap.map((row) => (
                      <tr key={row.slotLabel}>
                        <td className="font-bold text-slate-800 py-2 px-2 whitespace-nowrap">
                          {row.slotLabel}
                        </td>
                        {row.days.map((cell) => (
                          <td
                            key={cell.dayIndex}
                            title={`${cell.dayName} (${row.slotLabel}): Lấp đầy ${cell.occupancyRate}% (${cell.bookedHours}h đặt)`}
                            className={`py-2.5 px-2 rounded-xl text-center transition-transform hover:scale-105 ${getHeatmapCellStyle(
                              cell.occupancyRate
                            )}`}
                          >
                            {cell.occupancyRate}%
                          </td>
                        ))}
                        <td className="text-right font-extrabold text-slate-700 px-2">
                          {row.avgOccupancyRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tỷ lệ lấp đầy theo từng Sân */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md flex flex-col justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Hiệu Suất Khai Thác Từng Sân
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">
                  So sánh số giờ được đặt và tỷ lệ lấp đầy giữa các sân
                </p>

                <div className="space-y-4">
                  {data.occupancyByCourt.map((court) => (
                    <div
                      key={court.courtId}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-xs truncate">
                            {court.courtName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {court.bookedHours}h đặt / {court.availableHours}h mở cửa
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                            court.occupancyRate >= 40
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {court.occupancyRate}%
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden mt-2.5">
                        <div
                          style={{
                            width: `${Math.max(4, Math.min(100, court.occupancyRate))}%`,
                          }}
                          className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full"
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                        <span>{court.bookingCount} lượt đặt</span>
                        <span className="font-bold text-emerald-600">
                          {formatCurrency(court.revenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Danh sách Khung Giờ Vắng Nhất & Gợi Ý Tối Ưu Doanh Thu (Khớp Figma O-01) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  💡 Phân Tích Khung Giờ Vắng Khách & Đề Xuất Khuyến Mãi / Cáp Kèo
                </h3>
                <p className="text-xs text-slate-500">
                  Hệ thống tự động phát hiện các khung giờ có tỷ lệ lấp đầy thấp (&lt; 25%) để Chủ sân điều chỉnh giá động hoặc mở kèo
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.quietSlots.map((slot, idx) => (
                <div
                  key={`${slot.courtId}-${slot.timeSlot}-${idx}`}
                  className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 text-[10px] font-bold mb-1">
                        {slot.sportName} • Khung giờ: {slot.timeSlot}
                      </span>
                      <div className="font-bold text-slate-900 text-sm">
                        {slot.courtName}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800 text-xs font-black shrink-0">
                      Lấp đầy: {slot.occupancyRate}%
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 bg-white/90 p-2.5 rounded-xl border border-amber-200/60 font-medium">
                    🎯 <strong>Đề xuất:</strong> {slot.suggestion}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}


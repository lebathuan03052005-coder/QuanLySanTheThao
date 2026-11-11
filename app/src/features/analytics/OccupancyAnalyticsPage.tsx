import { useState, useEffect } from 'react';
import {
  fetchOccupancyAnalyticsApi,
  type OccupancyAnalyticsResponse,
} from './analytics.api';

function formatVnd(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString('vi-VN')}đ`;
}

function formatDateVi(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function getHeatmapColor(rate: number): string {
  if (rate >= 70) return 'bg-emerald-600 text-white font-bold';
  if (rate >= 45) return 'bg-emerald-400 text-white font-semibold';
  if (rate >= 30) return 'bg-emerald-100 text-emerald-800 font-semibold';
  if (rate > 0) return 'bg-amber-50 text-amber-700 border border-amber-200';
  return 'bg-slate-50 text-slate-400 border border-dashed border-slate-200';
}

export default function OccupancyAnalyticsPage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [selectedCourtId, setSelectedCourtId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [data, setData] = useState<OccupancyAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadOccupancy() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchOccupancyAnalyticsApi({
        period,
        courtId: selectedCourtId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setData(res);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(
        e.response?.data?.message ||
          'Không thể tải thống kê tỷ lệ lấp đầy sân.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOccupancy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, selectedCourtId, startDate, endDate]);

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              WBS 3.3 • Phân tích hiệu suất khai thác sân (O-01)
            </span>
            {data && (
              <span className="text-xs text-slate-400">
                Phân tích {data.numDays} ngày ({formatDateVi(data.startDate)} →{' '}
                {formatDateVi(data.endDate)})
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 mt-1">
            Thống Kê Tỷ Lệ Lấp Đầy Sân & Khung Giờ Vắng Khách
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Biểu đồ nhiệt (Heatmap) mật độ đặt sân theo khung giờ × thứ trong tuần và gợi ý giảm giá / cáp kèo cho các khung giờ vắng (&lt; 30%).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center">
            {(
              [
                { id: 'day', label: '7 ngày' },
                { id: 'week', label: '4 tuần' },
                { id: 'month', label: '30 ngày' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setPeriod(t.id);
                  setStartDate('');
                  setEndDate('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  period === t.id
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5">
            <span>Từ:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none"
            />
            <span>Đến:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-rose-500 font-bold ml-1 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={selectedCourtId}
            onChange={(e) => setSelectedCourtId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">🏟️ Tất cả sân thể thao</option>
            {data?.courts.map((c) => (
              <option key={c.courtId} value={String(c.courtId)}>
                {c.courtName} ({c.sportName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs md:text-sm">
          ⚠️ {errorMsg}
        </div>
      )}

      {loading || !data ? (
        <div className="bg-white rounded-3xl p-12 text-center text-sm text-slate-500 shadow-sm border border-slate-200/80">
          Đang tính toán tỷ lệ lấp đầy sân và phân tích khung giờ vắng...
        </div>
      ) : (
        <>
          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Tỷ lệ lấp đầy tổng thể
                </p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  {data.summary.overallOccupancyRate}%
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {data.summary.totalBookedHours}h đặt /{' '}
                  {data.summary.totalAvailableHours}h mở cửa
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
                📊
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Khung giờ vàng (Cao điểm)
                </p>
                <p className="text-lg md:text-xl font-bold text-emerald-600 mt-1">
                  {data.summary.peakHourSlot}
                </p>
                <p className="text-[11px] text-emerald-600 font-medium mt-1">
                  🔥 Mật độ đặt sân cao nhất
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
                🔥
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Khung giờ vắng khách nhất
                </p>
                <p className="text-lg md:text-xl font-bold text-amber-600 mt-1">
                  {data.summary.quietHourSlot}
                </p>
                <p className="text-[11px] text-amber-600 font-medium mt-1">
                  💡 Cần ưu đãi giá / Mở cáp kèo
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold">
                📉
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Số sân đang khai thác
                </p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {data.summary.activeCourtsCount}{' '}
                  <span className="text-xs font-normal text-slate-400">sân</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hoạt động 16 giờ / ngày (06h-22h)
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg font-bold">
                🏟️
              </div>
            </div>
          </div>

          {/* Ma trận Heatmap Khung giờ x Thứ trong tuần */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Biểu Đồ Nhiệt (Heatmap) Tỷ Lệ Lấp Đầy Theo Khung Giờ × Thứ Trong Tuần
                </h2>
                <p className="text-xs text-slate-400">
                  Màu càng đậm thể hiện khung giờ càng đông khách đặt sân; ô màu vàng/xám là khung giờ vắng khách (&lt; 30%).
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                  0% (Trống)
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                  &lt; 30% (Vắng)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  30–45% (Khá)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-400 text-white">
                  45–70% (Đông)
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
                  ≥ 70% (Kín sân)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[780px] text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="p-3 text-left font-bold w-40">
                      Khung giờ trong ngày
                    </th>
                    {[
                      'Thứ 2',
                      'Thứ 3',
                      'Thứ 4',
                      'Thứ 5',
                      'Thứ 6',
                      'Thứ 7',
                      'Chủ Nhật',
                    ].map((d) => (
                      <th key={d} className="p-3 text-center font-bold">
                        {d}
                      </th>
                    ))}
                    <th className="p-3 text-center font-bold bg-slate-100/80">
                      TB Khung giờ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.heatmap.map((row) => (
                    <tr key={row.slotLabel}>
                      <td className="p-3 font-bold text-slate-700 bg-slate-50/50">
                        {row.slotLabel}
                      </td>
                      {row.days.map((cell) => (
                        <td key={cell.dayIndex} className="p-1.5 text-center">
                          <div
                            title={`${row.slotLabel} (${cell.dayName}): Đã đặt ${cell.bookedHours}h / ${cell.capacityHours}h (${cell.occupancyRate}%)`}
                            className={`rounded-xl py-2.5 px-2 transition-all ${getHeatmapColor(cell.occupancyRate)}`}
                          >
                            <div>{cell.occupancyRate}%</div>
                            <div className="text-[10px] opacity-80">
                              {cell.bookedHours}h đặt
                            </div>
                          </div>
                        </td>
                      ))}
                      <td className="p-2 text-center bg-slate-50/80 font-bold text-slate-800">
                        {row.avgOccupancyRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tỷ lệ lấp đầy từng sân & Đề xuất tối ưu khung giờ vắng (< 30%) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* So sánh tỷ lệ lấp đầy theo từng sân */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
              <h2 className="text-base font-bold text-slate-800 mb-1">
                Tỷ Lệ Lấp Đầy Theo Từng Sân Thể Thao
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Đánh giá mức độ khai thác thực tế của từng sân con trong cụm
              </p>

              <div className="space-y-3.5">
                {data.occupancyByCourt.map((c) => (
                  <div
                    key={c.courtId}
                    className="p-3.5 rounded-2xl border border-slate-200/80"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="text-xs font-bold text-slate-800">
                          {c.courtName}
                        </span>
                        <span className="ml-2 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {c.sportName}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          c.occupancyRate >= 40
                            ? 'text-emerald-600'
                            : c.occupancyRate >= 30
                              ? 'text-blue-600'
                              : 'text-amber-600'
                        }`}
                      >
                        {c.occupancyRate}% lấp đầy
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(4, c.occupancyRate)}%` }}
                        className={`h-full rounded-full ${
                          c.occupancyRate >= 40
                            ? 'bg-emerald-500'
                            : c.occupancyRate >= 30
                              ? 'bg-blue-500'
                              : 'bg-amber-500'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                      <span>
                        Đã khai thác: <strong>{c.bookedHours} giờ</strong> /{' '}
                        {c.availableHours} giờ khả dụng ({c.bookingCount} đơn)
                      </span>
                      <span className="font-semibold text-emerald-600">
                        Doanh thu: {formatVnd(c.revenue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Danh sách khung giờ vắng (< 30%) & Gợi ý tối ưu */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-base font-bold text-slate-800">
                  Phát Hiện Khung Giờ Vắng (&lt; 30%) & Đề Xuất Tối Ưu
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
                  {data.quietSlots.length} khung giờ cần tối ưu
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Các khung giờ có tỷ lệ lấp đầy dưới 30% kèm gợi ý khuyến mãi / cáp kèo tự động
              </p>

              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {data.quietSlots.map((q, idx) => (
                  <div
                    key={`${q.courtId}-${q.timeSlot}-${idx}`}
                    className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/80 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold">
                          {q.timeSlot}
                        </span>
                        <span className="text-xs font-bold text-slate-800">
                          {q.courtName}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-amber-700">
                        Lấp đầy: {q.occupancyRate}% ({q.bookedHours}h/
                        {q.capacityHours}h)
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 flex items-center gap-1.5">
                      <span>💡</span>
                      <span>{q.suggestion}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


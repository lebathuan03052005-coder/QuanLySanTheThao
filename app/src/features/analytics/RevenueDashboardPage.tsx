import { useState, useEffect, useMemo } from 'react';
import {
  fetchRevenueDashboardApi,
  type RevenueDashboardResponse,
} from './analytics.api';

function formatVnd(amount: number): string {
  return `${Math.round(amount || 0).toLocaleString('vi-VN')}đ`;
}

function formatDateVi(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function escapeCsvCell(val: string | number | null | undefined): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function RevenueDashboardPage() {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [selectedCourtId, setSelectedCourtId] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [data, setData] = useState<RevenueDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function loadRevenue() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchRevenueDashboardApi({
        period,
        courtId: selectedCourtId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setData(res);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(
        e.response?.data?.message || 'Không thể tải báo cáo doanh thu.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRevenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, selectedCourtId, startDate, endDate]);

  const maxChartRevenue = useMemo(() => {
    if (!data || data.chartData.length === 0) return 1;
    return Math.max(1, ...data.chartData.map((d) => d.revenue));
  }, [data]);

  function handleExportCsv() {
    if (!data) return;
    const summaryHeaders = [
      'Kỳ/Ngày',
      'Số lượt đặt',
      'Số đơn hoàn thành',
      'Tiền cọc (VNĐ)',
      'Doanh thu (VNĐ)',
    ];
    const summaryRows = data.chartData.map((item) => [
      escapeCsvCell(item.label),
      escapeCsvCell(item.bookingCount),
      escapeCsvCell(item.completedCount),
      escapeCsvCell(item.deposit),
      escapeCsvCell(item.revenue),
    ]);

    const txHeaders = [
      'Mã GD',
      'Mã Đơn',
      'Khách hàng',
      'Số điện thoại',
      'Sân thể thao',
      'Loại giao dịch',
      'Phương thức thanh toán',
      'Ngày đặt',
      'Số tiền (VNĐ)',
    ];
    const txRows = data.recentTransactions.map((tx) => [
      escapeCsvCell(`#${tx.transactionId}`),
      escapeCsvCell(`#${tx.bookingId}`),
      escapeCsvCell(tx.playerName),
      escapeCsvCell(tx.playerPhone),
      escapeCsvCell(tx.courtName),
      escapeCsvCell(tx.transactionType),
      escapeCsvCell(tx.paymentMethod),
      escapeCsvCell(tx.bookingDate),
      escapeCsvCell(tx.amount),
    ]);

    const csvContent =
      '\uFEFF' +
      [
        '=== 1. TỔNG HỢP DOANH THU THEO KỲ ===',
        summaryHeaders.join(','),
        ...summaryRows.map((r) => r.join(',')),
        '',
        '=== 2. CHI TIẾT GIAO DỊCH THANH TOÁN ===',
        txHeaders.join(','),
        ...txRows.map((r) => r.join(',')),
      ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SportLink_DoanhThu_${data.startDate}_${data.endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              WBS 3.3 • Báo cáo tài chính & Billing
            </span>
            {data && (
              <span className="text-xs text-slate-400">
                Kỳ báo cáo: {formatDateVi(data.startDate)} →{' '}
                {formatDateVi(data.endDate)}
              </span>
            )}
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 mt-1">
            Dashboard Doanh Thu Theo Ngày / Tuần / Tháng / Năm
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-0.5">
            Phân tích dòng tiền đặt sân, tiền cọc, hoàn tiền, tỷ trọng doanh thu theo từng sân, môn thể thao và phương thức thanh toán.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!data}
            className="px-4 py-2.5 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <span>📥</span>
            <span>Xuất báo cáo CSV</span>
          </button>
          <button
            type="button"
            onClick={loadRevenue}
            className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm cursor-pointer"
          >
            ↻ Cập nhật số liệu
          </button>
        </div>
      </div>

      {/* Bộ lọc Ngày / Tuần / Tháng / Năm & Sân con */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center">
            {(
              [
                { id: 'day', label: 'Theo Ngày' },
                { id: 'week', label: 'Theo Tuần' },
                { id: 'month', label: 'Theo Tháng' },
                { id: 'year', label: 'Theo Năm' },
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
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  period === t.id
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5">
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
                title="Xóa lọc ngày"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCourtId}
            onChange={(e) => setSelectedCourtId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">🏟️ Tất cả sân thuộc cơ sở</option>
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
          Đang tổng hợp dữ liệu doanh thu...
        </div>
      ) : (
        <>
          {/* 4 KPI Cards kèm Tỷ lệ tăng trưởng (Growth %) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Tổng doanh thu trong kỳ
                </p>
                <p className="text-xl md:text-2xl font-bold text-emerald-600 mt-1">
                  {formatVnd(data.summary.totalRevenue)}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                      (data.summary.growthPercent || 0) >= 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {(data.summary.growthPercent || 0) >= 0 ? '▲ +' : '▼ '}
                    {data.summary.growthPercent ?? 0}%
                  </span>
                  <span className="text-[11px] text-slate-400">
                    so với kỳ trước
                  </span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
                💰
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Giá trị trung bình / đơn (AOV)
                </p>
                <p className="text-xl md:text-2xl font-bold text-blue-600 mt-1">
                  {formatVnd(data.summary.averageOrderValue)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  ✓ {data.summary.completedBookings + data.summary.confirmedBookings} đơn thành công ({data.summary.totalBookings} tổng đơn)
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
                📈
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Tổng tiền cọc đã thu
                </p>
                <p className="text-xl md:text-2xl font-bold text-indigo-600 mt-1">
                  {formatVnd(data.summary.totalDeposit)}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Đảm bảo tỷ lệ giữ sân
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg font-bold">
                🛡️
              </div>
            </div>

            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Đơn hủy & Hoàn tiền (REFUND)
                </p>
                <p className="text-xl md:text-2xl font-bold text-rose-600 mt-1">
                  {data.summary.cancelledBookings} hủy •{' '}
                  {data.summary.noShowBookings} bỏ kèo
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hoàn trả: {formatVnd(data.summary.totalRefund)}
                </p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg font-bold">
                ↩️
              </div>
            </div>
          </div>

          {/* Biểu đồ cột doanh thu + số đơn & Cơ cấu phương thức thanh toán */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Biểu đồ doanh thu */}
            <div className="lg:col-span-2 bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Biểu Đồ Biến Động Doanh Thu & Lượt Đặt Sân (
                    {period === 'day'
                      ? 'Theo Ngày'
                      : period === 'week'
                        ? 'Theo Tuần'
                        : period === 'year'
                          ? 'Theo Năm'
                          : 'Theo Tháng'}
                    )
                  </h2>
                  <p className="text-xs text-slate-400">
                    Hiển thị doanh thu (cột xanh) và số lượng đơn đặt sân tương ứng mỗi kỳ
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                    Doanh thu
                  </span>
                  <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                    Số đơn đặt
                  </span>
                </div>
              </div>

              {data.chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                  Không có dữ liệu doanh thu trong khoảng thời gian này.
                </div>
              ) : (
                <div className="h-64 flex items-end gap-2.5 pt-8 pb-2 px-2 overflow-x-auto border-b border-slate-100">
                  {data.chartData.map((bar) => {
                    const heightPct = Math.max(
                      6,
                      Math.round((bar.revenue / maxChartRevenue) * 100)
                    );
                    return (
                      <div
                        key={bar.key}
                        className="flex-1 min-w-[54px] h-full flex flex-col items-center justify-end group"
                      >
                        <div className="text-[10px] font-bold text-slate-600 mb-1 opacity-85 group-hover:opacity-100 group-hover:text-emerald-700 transition-opacity whitespace-nowrap">
                          {bar.revenue > 0
                            ? `${Math.round(bar.revenue / 1000)}k`
                            : '0đ'}
                        </div>
                        <div className="mb-1 px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[9px] font-bold border border-blue-200">
                          {bar.bookingCount} đơn
                        </div>
                        <div
                          style={{ height: `${heightPct}%` }}
                          title={`${bar.label}: ${formatVnd(bar.revenue)} (${bar.bookingCount} đơn)`}
                          className="w-full max-w-[42px] rounded-t-xl bg-gradient-to-t from-emerald-600 to-emerald-400 group-hover:from-blue-600 group-hover:to-blue-400 transition-all shadow-xs relative"
                        />
                        <div className="text-[11px] font-semibold text-slate-600 mt-2 truncate max-w-[76px]">
                          {bar.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cơ cấu theo phương thức thanh toán & Môn thể thao */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Phương Thức Thanh Toán
                </h2>
                <p className="text-xs text-slate-400 mb-3">
                  Tỷ trọng giao dịch qua Cổng thanh toán & Tiền mặt
                </p>

                <div className="space-y-3">
                  {data.revenueByPaymentMethod.map((pm) => (
                    <div key={pm.method} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">
                          {pm.label} ({pm.count} GD)
                        </span>
                        <span className="font-bold text-slate-800">
                          {formatVnd(pm.amount)}{' '}
                          <span className="text-slate-400 font-normal">
                            ({pm.sharePercent}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          style={{ width: `${Math.max(3, pm.sharePercent)}%` }}
                          className="h-full rounded-full bg-blue-600"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cơ cấu doanh thu theo Môn thể thao */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-2">
                  🏅 Doanh Thu Theo Môn Thể Thao
                </h3>
                <div className="space-y-2">
                  {data.revenueBySport.map((sp) => (
                    <div
                      key={sp.sportName}
                      className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded-xl"
                    >
                      <span className="font-semibold text-slate-700">
                        {sp.sportName} ({sp.bookingCount} đơn)
                      </span>
                      <span className="font-bold text-emerald-600">
                        {formatVnd(sp.revenue)} ({sp.sharePercent}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Doanh thu theo từng sân & Lịch sử giao dịch gần đây */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bảng xếp hạng doanh thu theo sân */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80">
              <h2 className="text-base font-bold text-slate-800 mb-1">
                Hiệu Quả Doanh Thu Theo Từng Sân Con
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                So sánh đóng góp doanh thu và số lượt đặt giữa các sân trong cụm
              </p>

              <div className="space-y-3">
                {data.revenueByCourt.map((c, idx) => (
                  <div
                    key={c.courtId}
                    className="p-3 rounded-2xl border border-slate-200/80 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-xs md:text-sm font-bold text-slate-800">
                            {c.courtName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {c.sportName} • {c.bookingCount} đơn đặt (
                            {c.completedCount} thành công, {c.cancelledCount}{' '}
                            hủy)
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-600">
                          {formatVnd(c.revenue)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Chiếm {c.sharePercent}%
                        </div>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
                      <div
                        style={{ width: `${Math.max(4, c.sharePercent)}%` }}
                        className="h-full rounded-full bg-emerald-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Lịch sử giao dịch gần đây */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/80 flex flex-col">
              <h2 className="text-base font-bold text-slate-800 mb-1">
                Nhật Ký Giao Dịch Thanh Toán ({data.recentTransactions.length})
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Các giao dịch đặt cọc (DEPOSIT), thanh toán đủ (FULL_PAYMENT) và hoàn tiền (REFUND) trong kỳ
              </p>

              <div className="flex-1 overflow-y-auto max-h-[380px] border border-slate-100 rounded-2xl">
                {data.recentTransactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Chưa có giao dịch thanh toán nào trong kỳ đã chọn.
                  </div>
                ) : (
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="p-2.5 text-left font-bold">Mã GD</th>
                        <th className="p-2.5 text-left font-bold">
                          Khách hàng / Sân
                        </th>
                        <th className="p-2.5 text-center font-bold">Loại</th>
                        <th className="p-2.5 text-center font-bold">Kênh TT</th>
                        <th className="p-2.5 text-right font-bold">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recentTransactions.map((tx) => (
                        <tr
                          key={tx.transactionId}
                          className="hover:bg-slate-50/70"
                        >
                          <td className="p-2.5 font-bold text-slate-700">
                            #{tx.transactionId}
                            <div className="text-[10px] font-normal text-slate-400">
                              Đơn #{tx.bookingId}
                            </div>
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-slate-800">
                              {tx.playerName}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                              {tx.courtName} • {formatDateVi(tx.bookingDate)}
                            </div>
                          </td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                tx.transactionType === 'FULL_PAYMENT'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : tx.transactionType === 'REFUND'
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {tx.transactionType === 'FULL_PAYMENT'
                                ? 'Thanh toán đủ'
                                : tx.transactionType === 'REFUND'
                                  ? 'Hoàn tiền'
                                  : 'Đặt cọc'}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-semibold text-slate-600">
                            {tx.paymentMethod}
                          </td>
                          <td
                            className={`p-2.5 text-right font-bold ${
                              tx.transactionType === 'REFUND'
                                ? 'text-rose-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {tx.transactionType === 'REFUND' ? '-' : '+'}
                            {formatVnd(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


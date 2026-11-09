import { getPool } from '../../core/config/db.js';

function formatTimeStr(val) {
  if (!val) return '00:00';
  if (val instanceof Date) {
    const h = String(val.getUTCHours()).padStart(2, '0');
    const m = String(val.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  const str = String(val);
  const match = str.match(/(\d{2}:\d{2})/);
  return match ? match[1] : str.slice(0, 5);
}

function formatDateStr(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return String(val).slice(0, 10);
}

function timeToHours(t) {
  const [h, m] = formatTimeStr(t).split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}

/**
 * Xác định khoảng ngày [startDate, endDate] dựa theo period ('day' | 'week' | 'month').
 */
function resolveDateRange(period = 'month', customStart, customEnd) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  const start = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + 7); // Bao gồm cả các đơn đặt trước trong 7 ngày tới

  if (period === 'day') {
    start.setDate(start.getDate() - 6); // 7 ngày gần nhất
  } else if (period === 'week') {
    start.setDate(start.getDate() - 27); // 4 tuần gần nhất
  } else {
    start.setDate(start.getDate() - 29); // 30 ngày trong tháng
  }

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: customEnd || todayStr,
    extendedEndDate: end.toISOString().split('T')[0],
  };
}

/**
 * [3.3] Dashboard doanh thu theo Ngày / Tuần / Tháng dành cho Chủ sân (S2-09).
 * @param {{ id: number, role: string }} user
 * @param {{ period?: string, startDate?: string, endDate?: string, courtId?: string }} query
 */
export async function getRevenueDashboard(user, query = {}) {
  const pool = await getPool();
  const userRole = (user.role || '').toLowerCase();
  const period = (query.period || 'day').toLowerCase(); // 'day' | 'week' | 'month'
  const courtIdFilter = query.courtId && query.courtId !== 'ALL' ? parseInt(query.courtId) : null;

  const { startDate, extendedEndDate } = resolveDateRange(
    period,
    query.startDate,
    query.endDate
  );
  const effectiveEnd = query.endDate || extendedEndDate;

  // 1. Lấy danh sách sân thuộc quyền quản lý của Chủ sân
  const courtReq = pool.request();
  let courtWhere = 'WHERE 1=1';
  if (userRole === 'owner') {
    courtReq.input('ownerId', user.id);
    courtWhere += ' AND c.owner_id = @ownerId';
  }

  const courtsRes = await courtReq.query(`
    SELECT c.court_id, c.court_name, c.sport_id, c.address, c.status,
           s.sport_name
    FROM courts c
    LEFT JOIN sports s ON c.sport_id = s.sport_id
    ${courtWhere}
    ORDER BY c.court_id ASC
  `);

  const allCourts = courtsRes.recordset;
  const scopedCourts = courtIdFilter
    ? allCourts.filter((c) => c.court_id === courtIdFilter)
    : allCourts;
  const courtIds = scopedCourts.map((c) => c.court_id);

  if (courtIds.length === 0) {
    return {
      period,
      startDate,
      endDate: effectiveEnd,
      courts: allCourts.map((c) => ({
        courtId: c.court_id,
        courtName: c.court_name,
        sportName: c.sport_name || 'Thể thao',
      })),
      summary: {
        totalRevenue: 0,
        totalDeposit: 0,
        totalRefund: 0,
        totalBookings: 0,
        completedBookings: 0,
        confirmedBookings: 0,
        cancelledBookings: 0,
        noShowBookings: 0,
        averageOrderValue: 0,
      },
      chartData: [],
      revenueByCourt: [],
      revenueBySport: [],
      revenueByPaymentMethod: [],
      recentTransactions: [],
    };
  }

  // 2. Lấy toàn bộ bookings của các sân trong khoảng thời gian
  const bookingsRes = await pool.request()
    .input('startDate', startDate)
    .input('endDate', effectiveEnd)
    .query(`
      SELECT 
        b.booking_id,
        b.court_id,
        b.user_id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.total_price,
        b.deposit_amount,
        b.status,
        b.created_at,
        c.court_name,
        c.sport_id,
        s.sport_name,
        u.full_name AS player_name,
        u.phone AS player_phone
      FROM bookings b
      JOIN courts c ON b.court_id = c.court_id
      LEFT JOIN sports s ON c.sport_id = s.sport_id
      LEFT JOIN users u ON b.user_id = u.user_id
      WHERE b.court_id IN (${courtIds.join(',')})
        AND b.booking_date >= @startDate
        AND b.booking_date <= @endDate
      ORDER BY b.booking_date ASC, b.start_time ASC
    `);

  const bookings = bookingsRes.recordset;

  // 3. Lấy danh sách giao dịch thanh toán (transactions) liên quan
  const txRes = await pool.request()
    .input('startDate', `${startDate}T00:00:00`)
    .input('endDate', `${effectiveEnd}T23:59:59`)
    .query(`
      SELECT 
        t.transaction_id,
        t.booking_id,
        t.user_id,
        t.amount,
        t.transaction_type,
        t.payment_method,
        t.status,
        t.created_at,
        b.court_id,
        b.booking_date,
        c.court_name,
        u.full_name AS player_name,
        u.phone AS player_phone
      FROM transactions t
      JOIN bookings b ON t.booking_id = b.booking_id
      JOIN courts c ON b.court_id = c.court_id
      LEFT JOIN users u ON t.user_id = u.user_id
      WHERE b.court_id IN (${courtIds.join(',')})
      ORDER BY t.created_at DESC
    `);

  const transactions = txRes.recordset;

  // 4. Tính toán các chỉ số KPI tổng quan
  let totalRevenue = 0;
  let totalDeposit = 0;
  let totalRefund = 0;
  let completedBookings = 0;
  let confirmedBookings = 0;
  let cancelledBookings = 0;
  let noShowBookings = 0;

  bookings.forEach((b) => {
    const st = (b.status || '').toUpperCase();
    const price = Number(b.total_price || 0);
    const dep = Number(b.deposit_amount || 0);

    if (st === 'COMPLETED') {
      totalRevenue += price;
      completedBookings += 1;
    } else if (st === 'CONFIRMED' || st === 'CHECKED-IN') {
      totalRevenue += price;
      confirmedBookings += 1;
    } else if (st === 'PENDING') {
      totalDeposit += dep;
    } else if (st === 'CANCELLED') {
      cancelledBookings += 1;
      totalRefund += dep * 0.5;
    } else if (st === 'NO-SHOW') {
      noShowBookings += 1;
      totalRevenue += dep; // Giữ tiền cọc khi khách bỏ kèo (No-show)
    }

    if (st !== 'CANCELLED') {
      totalDeposit += dep;
    }
  });

  const revenueBookingsCount = completedBookings + confirmedBookings;
  const averageOrderValue =
    revenueBookingsCount > 0 ? Math.round(totalRevenue / revenueBookingsCount) : 0;

  // 5. Nhóm dữ liệu biểu đồ theo Ngày / Tuần / Tháng
  const chartMap = new Map();

  if (period === 'day') {
    // Tạo danh sách các ngày liên tiếp để biểu đồ không bị đứt quãng
    const cur = new Date(`${startDate}T00:00:00`);
    const last = new Date(`${effectiveEnd}T00:00:00`);
    while (cur <= last) {
      const ds = cur.toISOString().split('T')[0];
      const [, m, d] = ds.split('-');
      chartMap.set(ds, {
        key: ds,
        label: `${d}/${m}`,
        fullDate: ds,
        revenue: 0,
        deposit: 0,
        bookingCount: 0,
        completedCount: 0,
      });
      cur.setDate(cur.getDate() + 1);
    }

    bookings.forEach((b) => {
      const ds = formatDateStr(b.booking_date);
      if (!chartMap.has(ds)) {
        const [, m, d] = ds.split('-');
        chartMap.set(ds, {
          key: ds,
          label: `${d}/${m}`,
          fullDate: ds,
          revenue: 0,
          deposit: 0,
          bookingCount: 0,
          completedCount: 0,
        });
      }
      const item = chartMap.get(ds);
      const st = (b.status || '').toUpperCase();
      item.bookingCount += 1;
      if (['COMPLETED', 'CONFIRMED', 'CHECKED-IN'].includes(st)) {
        item.revenue += Number(b.total_price || 0);
        item.completedCount += 1;
      } else if (st === 'NO-SHOW') {
        item.revenue += Number(b.deposit_amount || 0);
      }
      item.deposit += Number(b.deposit_amount || 0);
    });
  } else if (period === 'week') {
    bookings.forEach((b) => {
      const ds = formatDateStr(b.booking_date);
      const dt = new Date(`${ds}T00:00:00`);
      const day = dt.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(dt);
      monday.setDate(dt.getDate() + diffToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const wkKey = monday.toISOString().split('T')[0];
      const mStr = `${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')}`;
      const sStr = `${String(sunday.getDate()).padStart(2, '0')}/${String(sunday.getMonth() + 1).padStart(2, '0')}`;

      if (!chartMap.has(wkKey)) {
        chartMap.set(wkKey, {
          key: wkKey,
          label: `Tuần ${mStr} - ${sStr}`,
          fullDate: wkKey,
          revenue: 0,
          deposit: 0,
          bookingCount: 0,
          completedCount: 0,
        });
      }
      const item = chartMap.get(wkKey);
      const st = (b.status || '').toUpperCase();
      item.bookingCount += 1;
      if (['COMPLETED', 'CONFIRMED', 'CHECKED-IN'].includes(st)) {
        item.revenue += Number(b.total_price || 0);
        item.completedCount += 1;
      }
      item.deposit += Number(b.deposit_amount || 0);
    });
  } else {
    // Theo Tháng (YYYY-MM)
    bookings.forEach((b) => {
      const ds = formatDateStr(b.booking_date);
      const monthKey = ds.slice(0, 7); // YYYY-MM
      const [y, m] = monthKey.split('-');
      if (!chartMap.has(monthKey)) {
        chartMap.set(monthKey, {
          key: monthKey,
          label: `Tháng ${m}/${y}`,
          fullDate: monthKey,
          revenue: 0,
          deposit: 0,
          bookingCount: 0,
          completedCount: 0,
        });
      }
      const item = chartMap.get(monthKey);
      const st = (b.status || '').toUpperCase();
      item.bookingCount += 1;
      if (['COMPLETED', 'CONFIRMED', 'CHECKED-IN'].includes(st)) {
        item.revenue += Number(b.total_price || 0);
        item.completedCount += 1;
      }
      item.deposit += Number(b.deposit_amount || 0);
    });
  }

  const chartData = Array.from(chartMap.values()).sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  // 6. Doanh thu theo từng sân
  const courtStatsMap = new Map();
  scopedCourts.forEach((c) => {
    courtStatsMap.set(c.court_id, {
      courtId: c.court_id,
      courtName: c.court_name,
      sportName: c.sport_name || 'Thể thao',
      bookingCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      revenue: 0,
    });
  });

  bookings.forEach((b) => {
    const entry = courtStatsMap.get(b.court_id);
    if (!entry) return;
    const st = (b.status || '').toUpperCase();
    entry.bookingCount += 1;
    if (['COMPLETED', 'CONFIRMED', 'CHECKED-IN'].includes(st)) {
      entry.completedCount += 1;
      entry.revenue += Number(b.total_price || 0);
    } else if (st === 'CANCELLED') {
      entry.cancelledCount += 1;
    } else if (st === 'NO-SHOW') {
      entry.revenue += Number(b.deposit_amount || 0);
    }
  });

  const revenueByCourt = Array.from(courtStatsMap.values())
    .map((c) => ({
      ...c,
      sharePercent:
        totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // 7. Doanh thu theo môn thể thao
  const sportStatsMap = new Map();
  revenueByCourt.forEach((c) => {
    if (!sportStatsMap.has(c.sportName)) {
      sportStatsMap.set(c.sportName, {
        sportName: c.sportName,
        bookingCount: 0,
        revenue: 0,
      });
    }
    const sp = sportStatsMap.get(c.sportName);
    sp.bookingCount += c.bookingCount;
    sp.revenue += c.revenue;
  });

  const revenueBySport = Array.from(sportStatsMap.values()).map((s) => ({
    ...s,
    sharePercent:
      totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 1000) / 10 : 0,
  }));

  // 8. Doanh thu theo phương thức thanh toán
  const methodLabels = {
    VNPAY: 'Ví VNPay / QR',
    MOMO: 'Ví MoMo',
    BANK_TRANSFER: 'Chuyển khoản VietQR',
    CASH: 'Tiền mặt tại sân',
  };
  const methodMap = {
    VNPAY: { method: 'VNPAY', label: methodLabels.VNPAY, count: 0, amount: 0 },
    MOMO: { method: 'MOMO', label: methodLabels.MOMO, count: 0, amount: 0 },
    BANK_TRANSFER: { method: 'BANK_TRANSFER', label: methodLabels.BANK_TRANSFER, count: 0, amount: 0 },
    CASH: { method: 'CASH', label: methodLabels.CASH, count: 0, amount: 0 },
  };

  let totalTxAmount = 0;
  transactions.forEach((tx) => {
    if ((tx.status || 'SUCCESS').toUpperCase() !== 'SUCCESS') return;
    if ((tx.transaction_type || '').toUpperCase() === 'REFUND') return;
    const m = (tx.payment_method || 'CASH').toUpperCase();
    const amt = Number(tx.amount || 0);
    if (!methodMap[m]) {
      methodMap[m] = { method: m, label: m, count: 0, amount: 0 };
    }
    methodMap[m].count += 1;
    methodMap[m].amount += amt;
    totalTxAmount += amt;
  });

  const revenueByPaymentMethod = Object.values(methodMap).map((m) => ({
    ...m,
    sharePercent:
      totalTxAmount > 0 ? Math.round((m.amount / totalTxAmount) * 1000) / 10 : 0,
  }));

  return {
    period,
    startDate,
    endDate: effectiveEnd,
    courts: allCourts.map((c) => ({
      courtId: c.court_id,
      courtName: c.court_name,
      sportName: c.sport_name || 'Thể thao',
    })),
    summary: {
      totalRevenue,
      totalDeposit,
      totalRefund,
      totalBookings: bookings.length,
      completedBookings,
      confirmedBookings,
      cancelledBookings,
      noShowBookings,
      averageOrderValue,
    },
    chartData,
    revenueByCourt,
    revenueBySport,
    revenueByPaymentMethod,
    recentTransactions: transactions.slice(0, 20).map((t) => ({
      transactionId: t.transaction_id,
      bookingId: t.booking_id,
      courtName: t.court_name,
      playerName: t.player_name || 'Khách đặt sân',
      playerPhone: t.player_phone || '',
      amount: Number(t.amount || 0),
      transactionType: t.transaction_type,
      paymentMethod: t.payment_method,
      status: t.status || 'SUCCESS',
      bookingDate: formatDateStr(t.booking_date),
      createdAt: t.created_at,
    })),
  };
}

/**
 * [3.3] Thống kê tỷ lệ lấp đầy sân & Phát hiện khung giờ vắng (S2-10).
 * @param {{ id: number, role: string }} user
 * @param {{ period?: string, startDate?: string, endDate?: string, courtId?: string }} query
 */
export async function getOccupancyAnalytics(user, query = {}) {
  const pool = await getPool();
  const userRole = (user.role || '').toLowerCase();
  const period = (query.period || 'month').toLowerCase();
  const courtIdFilter = query.courtId && query.courtId !== 'ALL' ? parseInt(query.courtId) : null;

  const { startDate, extendedEndDate } = resolveDateRange(
    period,
    query.startDate,
    query.endDate
  );
  const effectiveEnd = query.endDate || extendedEndDate;

  const courtReq = pool.request();
  let courtWhere = 'WHERE 1=1';
  if (userRole === 'owner') {
    courtReq.input('ownerId', user.id);
    courtWhere += ' AND c.owner_id = @ownerId';
  }

  const courtsRes = await courtReq.query(`
    SELECT c.court_id, c.court_name, c.sport_id, c.address, c.status,
           s.sport_name
    FROM courts c
    LEFT JOIN sports s ON c.sport_id = s.sport_id
    ${courtWhere}
    ORDER BY c.court_id ASC
  `);

  const allCourts = courtsRes.recordset;
  const scopedCourts = courtIdFilter
    ? allCourts.filter((c) => c.court_id === courtIdFilter)
    : allCourts;
  const courtIds = scopedCourts.map((c) => c.court_id);

  const timeBlocks = [
    { label: '06:00 - 08:00', start: 6, end: 8 },
    { label: '08:00 - 10:00', start: 8, end: 10 },
    { label: '10:00 - 12:00', start: 10, end: 12 },
    { label: '12:00 - 14:00', start: 12, end: 14 },
    { label: '14:00 - 16:00', start: 14, end: 16 },
    { label: '16:00 - 18:00', start: 16, end: 18 },
    { label: '18:00 - 20:00', start: 18, end: 20 },
    { label: '20:00 - 22:00', start: 20, end: 22 },
  ];

  const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

  if (courtIds.length === 0) {
    return {
      period,
      startDate,
      endDate: effectiveEnd,
      courts: [],
      summary: {
        overallOccupancyRate: 0,
        totalAvailableHours: 0,
        totalBookedHours: 0,
        peakHourSlot: '18:00 - 20:00',
        quietHourSlot: '10:00 - 14:00',
        activeCourtsCount: 0,
      },
      occupancyByCourt: [],
      heatmap: [],
      hourlyStats: [],
      quietSlots: [],
    };
  }

  // Số ngày trong khoảng phân tích (tối thiểu 7 ngày để chuẩn hóa tỷ lệ)
  const startDt = new Date(`${startDate}T00:00:00`);
  const endDt = new Date(`${effectiveEnd}T00:00:00`);
  const numDays = Math.max(
    1,
    Math.round((endDt.getTime() - startDt.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );

  // Đếm số lần xuất hiện của từng thứ trong tuần trong khoảng [startDate, effectiveEnd]
  const weekdayOccurrences = [0, 0, 0, 0, 0, 0, 0]; // index 0 = Thứ 2 ... 6 = CN
  const cursor = new Date(startDt);
  while (cursor <= endDt) {
    const jsDay = cursor.getDay(); // 0=CN, 1=T2...
    const idx = jsDay === 0 ? 6 : jsDay - 1;
    weekdayOccurrences[idx] += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  const bookingsRes = await pool.request()
    .input('startDate', startDate)
    .input('endDate', effectiveEnd)
    .query(`
      SELECT 
        b.booking_id,
        b.court_id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.total_price,
        b.status,
        c.court_name,
        s.sport_name
      FROM bookings b
      JOIN courts c ON b.court_id = c.court_id
      LEFT JOIN sports s ON c.sport_id = s.sport_id
      WHERE b.court_id IN (${courtIds.join(',')})
        AND b.booking_date >= @startDate
        AND b.booking_date <= @endDate
        AND b.status NOT IN ('CANCELLED')
    `);

  const bookings = bookingsRes.recordset;

  // Giờ mở cửa tiêu chuẩn mỗi ngày của 1 sân: 16 giờ (06:00 -> 22:00)
  const dailyOperatingHours = 16;
  const availableHoursPerCourt = numDays * dailyOperatingHours;
  const totalAvailableHours = scopedCourts.length * availableHoursPerCourt;

  const courtHoursMap = new Map();
  scopedCourts.forEach((c) => {
    courtHoursMap.set(c.court_id, {
      courtId: c.court_id,
      courtName: c.court_name,
      sportName: c.sport_name || 'Thể thao',
      bookedHours: 0,
      availableHours: availableHoursPerCourt,
      bookingCount: 0,
      revenue: 0,
    });
  });

  // Ma trận Heatmap: 8 khung giờ × 7 thứ
  const matrixBooked = Array.from({ length: timeBlocks.length }, () =>
    Array.from({ length: 7 }, () => ({ bookedHours: 0, bookingCount: 0 }))
  );

  let totalBookedHours = 0;

  bookings.forEach((b) => {
    const bStart = timeToHours(b.start_time);
    const bEnd = timeToHours(b.end_time);
    const duration = Math.max(0, bEnd - bStart);

    totalBookedHours += duration;

    const cItem = courtHoursMap.get(b.court_id);
    if (cItem) {
      cItem.bookedHours += duration;
      cItem.bookingCount += 1;
      cItem.revenue += Number(b.total_price || 0);
    }

    const ds = formatDateStr(b.booking_date);
    const dt = new Date(`${ds}T00:00:00`);
    const jsDay = dt.getDay();
    const dayIdx = jsDay === 0 ? 6 : jsDay - 1;

    timeBlocks.forEach((block, blockIdx) => {
      const overlapStart = Math.max(bStart, block.start);
      const overlapEnd = Math.min(bEnd, block.end);
      if (overlapEnd > overlapStart) {
        matrixBooked[blockIdx][dayIdx].bookedHours += overlapEnd - overlapStart;
        matrixBooked[blockIdx][dayIdx].bookingCount += 1;
      }
    });
  });

  const occupancyByCourt = Array.from(courtHoursMap.values()).map((c) => ({
    ...c,
    bookedHours: Math.round(c.bookedHours * 10) / 10,
    occupancyRate:
      c.availableHours > 0
        ? Math.min(100, Math.round((c.bookedHours / c.availableHours) * 1000) / 10)
        : 0,
  }));

  const heatmap = timeBlocks.map((block, bIdx) => {
    const blockDuration = block.end - block.start; // 2 giờ
    const days = dayNames.map((dayName, dIdx) => {
      const occCount = Math.max(1, weekdayOccurrences[dIdx]);
      const capacityHours = occCount * scopedCourts.length * blockDuration;
      const cell = matrixBooked[bIdx][dIdx];
      const rate =
        capacityHours > 0
          ? Math.min(100, Math.round((cell.bookedHours / capacityHours) * 1000) / 10)
          : 0;
      return {
        dayIndex: dIdx,
        dayName,
        bookedHours: Math.round(cell.bookedHours * 10) / 10,
        capacityHours,
        bookingCount: cell.bookingCount,
        occupancyRate: rate,
      };
    });

    const totalSlotBooked = days.reduce((s, d) => s + d.bookedHours, 0);
    const totalSlotCap = days.reduce((s, d) => s + d.capacityHours, 0);
    const avgRate =
      totalSlotCap > 0
        ? Math.min(100, Math.round((totalSlotBooked / totalSlotCap) * 1000) / 10)
        : 0;

    return {
      slotLabel: block.label,
      startHour: block.start,
      endHour: block.end,
      avgOccupancyRate: avgRate,
      totalBookedHours: Math.round(totalSlotBooked * 10) / 10,
      days,
    };
  });

  const sortedSlots = [...heatmap].sort((a, b) => b.avgOccupancyRate - a.avgOccupancyRate);
  const peakHourSlot = sortedSlots[0]?.slotLabel || '18:00 - 20:00';
  const quietHourSlot = sortedSlots[sortedSlots.length - 1]?.slotLabel || '10:00 - 12:00';

  // Phát hiện các khung giờ vắng khách nhất và đề xuất hành động tối ưu (khớp thiết kế O-01)
  const quietSlots = [];
  scopedCourts.forEach((court) => {
    timeBlocks.forEach((block) => {
      // Tính số giờ đặt của sân này trong khung giờ này
      let courtSlotHours = 0;
      bookings
        .filter((b) => b.court_id === court.court_id)
        .forEach((b) => {
          const bStart = timeToHours(b.start_time);
          const bEnd = timeToHours(b.end_time);
          const ov = Math.max(0, Math.min(bEnd, block.end) - Math.max(bStart, block.start));
          courtSlotHours += ov;
        });

      const slotCap = numDays * (block.end - block.start);
      const rate = slotCap > 0 ? Math.round((courtSlotHours / slotCap) * 1000) / 10 : 0;

      if (rate < 25) {
        let suggestion = 'Gợi ý giảm giá 20% khung giờ thấp điểm hoặc mở tính năng Cáp kèo giao hữu';
        if (block.start >= 10 && block.end <= 16) {
          suggestion = 'Khung giờ trưa/chiều vắng khách — Đề xuất tạo combo giảm 25% cho sinh viên/CLB';
        } else if (block.start < 8) {
          suggestion = 'Khung giờ sáng sớm — Đề xuất gói thuê tháng cố định ưu đãi 15%';
        } else if (block.start >= 20) {
          suggestion = 'Khung giờ muộn — Đề xuất hỗ trợ ghép kèo tự động để lấp đầy sân';
        }

        quietSlots.push({
          courtId: court.court_id,
          courtName: court.court_name,
          sportName: court.sport_name || 'Thể thao',
          timeSlot: block.label,
          bookedHours: Math.round(courtSlotHours * 10) / 10,
          capacityHours: slotCap,
          occupancyRate: rate,
          suggestion,
        });
      }
    });
  });

  quietSlots.sort((a, b) => a.occupancyRate - b.occupancyRate);

  const overallOccupancyRate =
    totalAvailableHours > 0
      ? Math.min(100, Math.round((totalBookedHours / totalAvailableHours) * 1000) / 10)
      : 0;

  return {
    period,
    startDate,
    endDate: effectiveEnd,
    numDays,
    courts: allCourts.map((c) => ({
      courtId: c.court_id,
      courtName: c.court_name,
      sportName: c.sport_name || 'Thể thao',
    })),
    summary: {
      overallOccupancyRate,
      totalAvailableHours,
      totalBookedHours: Math.round(totalBookedHours * 10) / 10,
      peakHourSlot,
      quietHourSlot,
      activeCourtsCount: scopedCourts.length,
    },
    occupancyByCourt,
    heatmap,
    quietSlots: quietSlots.slice(0, 10),
  };
}


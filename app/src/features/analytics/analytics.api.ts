import api from '../../shared/lib/axios';

export interface AnalyticsCourtOption {
  courtId: number;
  courtName: string;
  sportName: string;
}

export interface RevenueSummary {
  totalRevenue: number;
  totalDeposit: number;
  totalRefund: number;
  totalBookings: number;
  completedBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  averageOrderValue: number;
}

export interface RevenueChartPoint {
  key: string;
  label: string;
  fullDate: string;
  revenue: number;
  deposit: number;
  bookingCount: number;
  completedCount: number;
}

export interface RevenueByCourtItem {
  courtId: number;
  courtName: string;
  sportName: string;
  bookingCount: number;
  completedCount: number;
  cancelledCount: number;
  revenue: number;
  sharePercent: number;
}

export interface RevenueBySportItem {
  sportName: string;
  bookingCount: number;
  revenue: number;
  sharePercent: number;
}

export interface RevenueByPaymentMethodItem {
  method: string;
  label: string;
  count: number;
  amount: number;
  sharePercent: number;
}

export interface RecentTransactionItem {
  transactionId: number;
  bookingId: number;
  courtName: string;
  playerName: string;
  playerPhone: string;
  amount: number;
  transactionType: string;
  paymentMethod: string;
  status: string;
  bookingDate: string;
  createdAt: string;
}

export interface RevenueDashboardData {
  period: string;
  startDate: string;
  endDate: string;
  courts: AnalyticsCourtOption[];
  summary: RevenueSummary;
  chartData: RevenueChartPoint[];
  revenueByCourt: RevenueByCourtItem[];
  revenueBySport: RevenueBySportItem[];
  revenueByPaymentMethod: RevenueByPaymentMethodItem[];
  recentTransactions: RecentTransactionItem[];
}

export interface OccupancySummary {
  overallOccupancyRate: number;
  totalAvailableHours: number;
  totalBookedHours: number;
  peakHourSlot: string;
  quietHourSlot: string;
  activeCourtsCount: number;
}

export interface OccupancyByCourtItem {
  courtId: number;
  courtName: string;
  sportName: string;
  bookedHours: number;
  availableHours: number;
  bookingCount: number;
  revenue: number;
  occupancyRate: number;
}

export interface HeatmapDayCell {
  dayIndex: number;
  dayName: string;
  bookedHours: number;
  capacityHours: number;
  bookingCount: number;
  occupancyRate: number;
}

export interface HeatmapRow {
  slotLabel: string;
  startHour: number;
  endHour: number;
  avgOccupancyRate: number;
  totalBookedHours: number;
  days: HeatmapDayCell[];
}

export interface QuietSlotItem {
  courtId: number;
  courtName: string;
  sportName: string;
  timeSlot: string;
  bookedHours: number;
  capacityHours: number;
  occupancyRate: number;
  suggestion: string;
}

export interface OccupancyAnalyticsData {
  period: string;
  startDate: string;
  endDate: string;
  numDays: number;
  courts: AnalyticsCourtOption[];
  summary: OccupancySummary;
  occupancyByCourt: OccupancyByCourtItem[];
  heatmap: HeatmapRow[];
  quietSlots: QuietSlotItem[];
}

export async function getRevenueDashboardApi(params: {
  period?: 'day' | 'week' | 'month';
  startDate?: string;
  endDate?: string;
  courtId?: string;
}): Promise<RevenueDashboardData> {
  const res = await api.get('/analytics/revenue', { params });
  return res.data.data;
}

export async function getOccupancyAnalyticsApi(params: {
  period?: 'day' | 'week' | 'month';
  startDate?: string;
  endDate?: string;
  courtId?: string;
}): Promise<OccupancyAnalyticsData> {
  const res = await api.get('/analytics/occupancy', { params });
  return res.data.data;
}


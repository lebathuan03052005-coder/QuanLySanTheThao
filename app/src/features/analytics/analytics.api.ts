import api from '../../shared/lib/axios';

export interface RevenueSummary {
  totalRevenue: number;
  previousRevenue?: number;
  growthPercent?: number;
  totalDeposit: number;
  totalRefund: number;
  totalBookings: number;
  completedBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  noShowBookings: number;
  averageOrderValue: number;
}

export interface RevenueChartItem {
  key: string;
  label: string;
  fullDate: string;
  revenue: number;
  deposit: number;
  bookingCount: number;
  completedCount: number;
}

export interface CourtRevenueItem {
  courtId: number;
  facilityId?: number | null;
  facilityName?: string;
  courtName: string;
  sportName: string;
  bookingCount: number;
  completedCount: number;
  cancelledCount: number;
  revenue: number;
  sharePercent: number;
}

export interface SportRevenueItem {
  sportName: string;
  bookingCount: number;
  revenue: number;
  sharePercent: number;
}

export interface PaymentMethodRevenueItem {
  method: string;
  label: string;
  count: number;
  amount: number;
  sharePercent: number;
}

export interface TransactionItem {
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

export interface RevenueDashboardResponse {
  period: string;
  startDate: string;
  endDate: string;
  courts: {
    courtId: number;
    facilityId?: number | null;
    facilityName?: string;
    courtName: string;
    sportName: string;
  }[];
  summary: RevenueSummary;
  chartData: RevenueChartItem[];
  revenueByCourt: CourtRevenueItem[];
  revenueBySport: SportRevenueItem[];
  revenueByPaymentMethod: PaymentMethodRevenueItem[];
  recentTransactions: TransactionItem[];
}

export interface OccupancyCourtItem {
  courtId: number;
  facilityId?: number | null;
  facilityName?: string;
  courtName: string;
  sportName: string;
  bookedHours: number;
  availableHours: number;
  bookingCount: number;
  revenue: number;
  occupancyRate: number;
}

export interface HeatmapSlotRow {
  slotLabel: string;
  startHour: number;
  endHour: number;
  avgOccupancyRate: number;
  totalBookedHours: number;
  days: {
    dayIndex: number;
    dayName: string;
    bookedHours: number;
    capacityHours: number;
    bookingCount: number;
    occupancyRate: number;
  }[];
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

export interface OccupancyAnalyticsResponse {
  period: string;
  startDate: string;
  endDate: string;
  numDays: number;
  courts: {
    courtId: number;
    facilityId?: number | null;
    facilityName?: string;
    courtName: string;
    sportName: string;
  }[];
  summary: {
    overallOccupancyRate: number;
    totalAvailableHours: number;
    totalBookedHours: number;
    peakHourSlot: string;
    quietHourSlot: string;
    activeCourtsCount: number;
  };
  occupancyByCourt: OccupancyCourtItem[];
  heatmap: HeatmapSlotRow[];
  quietSlots: QuietSlotItem[];
}

export async function fetchRevenueDashboardApi(params: {
  period?: string;
  startDate?: string;
  endDate?: string;
  facilityId?: string;
  courtId?: string;
}): Promise<RevenueDashboardResponse> {
  const res = await api.get('/analytics/revenue', { params });
  return res.data.data;
}

export async function fetchOccupancyAnalyticsApi(params: {
  period?: string;
  startDate?: string;
  endDate?: string;
  facilityId?: string;
  courtId?: string;
}): Promise<OccupancyAnalyticsResponse> {
  const res = await api.get('/analytics/occupancy', { params });
  return res.data.data;
}


import api from '../../shared/lib/axios';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED-IN'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO-SHOW';

export interface PriceRuleItem {
  priceId: number;
  dayType: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';
  startTime: string;
  endTime: string;
  price: number;
}

export interface ScheduleCourtItem {
  courtId: number;
  courtName: string;
  sportId: number;
  sportName: string;
  address?: string;
  status: string;
  prices: PriceRuleItem[];
}

export interface ScheduleBookingItem {
  bookingId: number;
  courtId: number;
  courtName: string;
  sportId: number;
  sportName: string;
  userId: number;
  matchId?: number | null;
  playerName: string;
  playerPhone: string;
  playerEmail: string;
  reputationScore: number;
  bookingDate: string; // YYYY-MM-DD
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  totalPrice: number;
  depositAmount: number;
  status: BookingStatus;
  createdAt?: string;
}

export interface ScheduleMaintenanceItem {
  maintenanceId: number;
  courtId: number;
  courtName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

export interface ScheduleSportOption {
  sportId: number;
  sportName: string;
}

export interface ScheduleResponseData {
  startDate: string;
  endDate: string;
  sports: ScheduleSportOption[];
  courts: ScheduleCourtItem[];
  bookings: ScheduleBookingItem[];
  maintenances: ScheduleMaintenanceItem[];
}

export interface CreateWalkInBookingPayload {
  courtId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice?: number;
  depositAmount?: number;
  status?: BookingStatus;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}

export interface CreateMaintenancePayload {
  courtId: number;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

export async function getScheduleDataApi(params: {
  startDate: string;
  endDate: string;
  courtId?: string;
  sportId?: string;
  status?: string;
}): Promise<ScheduleResponseData> {
  const res = await api.get('/bookings/schedule', { params });
  return res.data.data;
}

export async function createWalkInBookingApi(
  payload: CreateWalkInBookingPayload
): Promise<ScheduleBookingItem> {
  const res = await api.post('/bookings', payload);
  return res.data.data;
}

export async function updateBookingStatusApi(
  bookingId: number,
  status: BookingStatus,
  paymentMethod?: string
): Promise<ScheduleBookingItem> {
  const res = await api.patch(`/bookings/${bookingId}/status`, {
    status,
    paymentMethod,
  });
  return res.data.data;
}

export async function createMaintenanceApi(
  payload: CreateMaintenancePayload
): Promise<ScheduleMaintenanceItem> {
  const res = await api.post('/bookings/maintenances', payload);
  return res.data.data;
}

export async function deleteMaintenanceApi(maintenanceId: number): Promise<void> {
  await api.delete(`/bookings/maintenances/${maintenanceId}`);
}

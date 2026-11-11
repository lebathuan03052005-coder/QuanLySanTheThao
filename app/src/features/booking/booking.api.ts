import api from '../../shared/lib/axios';

export interface PriceRule {
  priceId: number;
  dayType: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY' | string;
  startTime: string;
  endTime: string;
  price: number;
}

export interface ScheduleFacility {
  facilityId: number;
  facilityName: string;
  address: string;
  status: string;
}

export interface ScheduleCourt {
  courtId: number;
  facilityId?: number | null;
  facilityName?: string;
  courtName: string;
  sportId: number;
  sportName: string;
  address: string;
  status: string;
  prices: PriceRule[];
}

export interface ScheduleBooking {
  bookingId: number;
  courtId: number;
  facilityId?: number | null;
  facilityName?: string;
  courtName: string;
  sportId: number;
  sportName: string;
  userId: number | null;
  customerId?: number | null;
  matchId: number | null;
  playerName: string;
  playerPhone: string;
  playerEmail: string;
  reputationScore: number;
  bookingDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  totalPrice: number;
  depositAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED-IN' | 'COMPLETED' | 'CANCELLED' | 'NO-SHOW';
  createdAt: string;
}

export interface ScheduleMaintenance {
  maintenanceId: number;
  courtId: number;
  courtName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  startDateTime: string;
  endDateTime: string;
  reason: string;
}

export interface ScheduleResponse {
  startDate: string;
  endDate: string;
  facilities?: ScheduleFacility[];
  sports: { sportId: number; sportName: string }[];
  courts: ScheduleCourt[];
  bookings: ScheduleBooking[];
  maintenances: ScheduleMaintenance[];
}

export interface CreateWalkInBookingPayload {
  courtId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice?: number;
  depositAmount?: number;
  status?: string;
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

export async function fetchScheduleApi(params: {
  startDate: string;
  endDate: string;
  facilityId?: string;
  courtId?: string;
  sportId?: string;
  status?: string;
}): Promise<ScheduleResponse> {
  const res = await api.get('/bookings/schedule', { params });
  return res.data.data;
}

export async function createWalkInBookingApi(payload: CreateWalkInBookingPayload) {
  const res = await api.post('/bookings', payload);
  return res.data;
}

export async function updateBookingStatusApi(
  bookingId: number,
  status: string,
  paymentMethod?: string
) {
  const res = await api.patch(`/bookings/${bookingId}/status`, {
    status,
    paymentMethod,
  });
  return res.data;
}

export async function createMaintenanceApi(payload: CreateMaintenancePayload) {
  const res = await api.post('/bookings/maintenances', payload);
  return res.data;
}

export async function deleteMaintenanceApi(maintenanceId: number) {
  const res = await api.delete(`/bookings/maintenances/${maintenanceId}`);
  return res.data;
}

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
  status:
    | 'HOLD'
    | 'PENDING'
    | 'CONFIRMED'
    | 'CHECKED-IN'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'NO-SHOW'
    | 'EXPIRED';
  holdSecondsRemaining?: number | null;
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
  paymentMethod?: string;
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

// ============================================================================
// SPRINT 3 INTERFACES: AVAILABILITY, QUOTE, SANDBOX PAYMENT, VIETQR & HISTORY
// ============================================================================

export interface CourtAvailabilityResponse {
  courtId: number;
  courtName: string;
  facilityId: number | null;
  facilityName: string;
  facilityAddress: string;
  sportId: number;
  sportName: string;
  status: string;
  basePricePerHour: number;
  date: string;
  prices: PriceRule[];
  bookedSlots: {
    bookingId: number;
    startTime: string;
    endTime: string;
    status: string;
  }[];
  maintenanceSlots: {
    maintenanceId: number;
    startTime: string;
    endTime: string;
    reason: string;
  }[];
}

export interface BookingQuoteResponse {
  courtId: number;
  courtName: string;
  facilityName: string;
  sportName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  durationHours: number;
  dayType: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY' | string;
  isHoliday: boolean;
  totalPrice: number;
  depositSuggested: number;
  isAvailable: boolean;
  conflictReason: string | null;
}

export interface VietQrPayload {
  provider: string;
  bankId: string;
  bankBin: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  amount: number;
  transferContent: string;
  orderCode: string;
  courtName?: string;
  qrImageUrl: string;
  expiresInSeconds: number;
  instructions: string[];
}

export interface WebhookSignedPayload {
  orderCode: string;
  bookingId: number;
  amount: number;
  paymentMethod: string;
  resultCode: string;
  gatewayTransId: string;
  message: string;
  signature: string;
}

export interface PaymentSessionResponse {
  transactionId: number;
  orderCode: string;
  bookingId: number;
  courtName: string;
  facilityName?: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  alreadyPaid: number;
  amount: number;
  remainingAfterPay: number;
  paymentType: 'FULL_PAYMENT' | 'DEPOSIT';
  paymentMethod: 'VNPAY' | 'MOMO' | 'VIETQR' | 'BANK_TRANSFER' | 'CASH';
  status: string;
  holdSecondsRemaining: number | null;
  sandboxGateway: {
    provider: string;
    terminalCode: string;
    checkoutUrl: string;
    webhookEndpoint: string;
    webhookPayloads: {
      success: WebhookSignedPayload;
      failed: WebhookSignedPayload;
    };
  };
  vietQrFallback: VietQrPayload;
}

export interface BookingTransactionItem {
  transaction_id: number;
  booking_id: number;
  amount: number;
  transaction_type: 'DEPOSIT' | 'FULL_PAYMENT' | 'REFUND' | string;
  payment_method: 'VNPAY' | 'MOMO' | 'VIETQR' | 'BANK_TRANSFER' | 'CASH' | string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | string;
  order_code: string;
  gateway_trans_id?: string | null;
  note?: string | null;
  created_at: string;
}

export interface PlayerBookingItem {
  booking_id: number;
  court_id: number;
  user_id: number | null;
  customer_id: number | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  deposit_amount: number;
  paid_amount: number;
  refunded_amount: number;
  remaining_amount: number;
  status:
    | 'HOLD'
    | 'PENDING'
    | 'CONFIRMED'
    | 'CHECKED-IN'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'NO-SHOW'
    | 'EXPIRED';
  hold_seconds_remaining?: number | null;
  hold_expires_at?: string | null;
  payment_status: 'UNPAID' | 'DEPOSIT_PAID' | 'PAID' | 'REFUNDED' | 'PARTIAL_REFUND' | string;
  payment_method?: string | null;
  cancel_reason?: string | null;
  cancelled_at?: string | null;
  refund_amount?: number;
  created_at: string;
  court_name: string;
  court_address?: string;
  court_images?: string | null;
  facility_id?: number | null;
  facility_name?: string;
  facility_address?: string;
  facility_phone?: string;
  sport_id?: number;
  sport_name?: string;
  transactions: BookingTransactionItem[];
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

// ============================================================================
// SPRINT 3 API CALLS (S3-07, S3-08, S3-09, S3-10)
// ============================================================================

export async function getCourtAvailabilityApi(
  courtId: number,
  date: string
): Promise<CourtAvailabilityResponse> {
  const res = await api.get('/bookings/availability', {
    params: { courtId, date },
  });
  return res.data.data;
}

export async function getBookingQuoteApi(params: {
  courtId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
}): Promise<BookingQuoteResponse> {
  const res = await api.post('/bookings/quote', params);
  return res.data.data;
}

export async function getMyBookingsApi(): Promise<PlayerBookingItem[]> {
  const res = await api.get('/bookings');
  return res.data.data || [];
}

export async function getBookingByIdApi(bookingId: number): Promise<PlayerBookingItem> {
  const res = await api.get(`/bookings/${bookingId}`);
  return res.data.data;
}

export async function initiateBookingPaymentApi(
  bookingId: number,
  payload: {
    paymentMethod: 'VNPAY' | 'MOMO' | 'VIETQR';
    paymentType?: 'FULL_PAYMENT' | 'DEPOSIT';
    amount?: number;
  }
): Promise<PaymentSessionResponse> {
  const res = await api.post(`/bookings/${bookingId}/payment/init`, payload);
  return res.data.data;
}

export async function triggerSandboxWebhookApi(payload: Record<string, unknown>) {
  const res = await api.post('/bookings/payment/webhook', payload);
  return res.data;
}

export async function getVietQrFallbackApi(
  bookingId: number,
  paymentType: 'FULL_PAYMENT' | 'DEPOSIT' = 'FULL_PAYMENT'
): Promise<VietQrPayload> {
  const res = await api.get(`/bookings/${bookingId}/payment/vietqr`, {
    params: { paymentType },
  });
  return res.data.data;
}

export async function confirmVietQrPaymentApi(
  bookingId: number,
  payload?: {
    paymentType?: 'FULL_PAYMENT' | 'DEPOSIT';
    bankRefCode?: string;
    amount?: number;
  }
) {
  const res = await api.post(`/bookings/${bookingId}/payment/vietqr-confirm`, payload || {});
  return res.data;
}

export async function cancelBookingWithRefundApi(
  bookingId: number,
  cancelReason: string
) {
  const res = await api.post(`/bookings/${bookingId}/cancel`, { cancelReason });
  return res.data;
}

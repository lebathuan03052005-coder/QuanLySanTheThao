import api from '../../shared/lib/axios';

export type CustomerSegment = 'VIP' | 'REGULAR' | 'NEW' | 'WARNING';

export interface CustomerItem {
  id: number;
  userId?: number | null;
  fullName: string;
  phone: string;
  email: string;
  status: 'ACTIVE' | 'LOCKED';
  reputationScore: number;
  avatarUrl: string | null;
  createdAt: string;
  totalBookings: number;
  completedBookings: number;
  activeBookings: number;
  todayActiveBookings?: number;
  unpaidDepositBookings?: number;
  cancelledBookings: number;
  noShowCount: number;
  totalSpent: number;
  lastBookingDate: string | null;
  segment: CustomerSegment;
}

export interface CustomerBookingHistoryItem {
  bookingId: number;
  courtId: number;
  facilityId?: number | null;
  facilityName?: string;
  courtName: string;
  courtAddress: string;
  sportName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  depositAmount: number;
  paidAmount: number;
  remainingAmount?: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export interface CustomerHistoryResponse {
  customer: CustomerItem;
  bookings: CustomerBookingHistoryItem[];
}

export async function fetchCustomersApi(params?: {
  search?: string;
  segment?: string;
  facilityId?: string;
}): Promise<CustomerItem[]> {
  const res = await api.get('/customers', { params });
  return res.data.data;
}

export async function fetchCustomerHistoryApi(
  customerId: number
): Promise<CustomerHistoryResponse> {
  const res = await api.get(`/customers/${customerId}/history`);
  return res.data.data;
}

export async function updateCustomerReputationApi(
  customerId: number,
  payload: { reputationScore?: number; status?: 'ACTIVE' | 'LOCKED' }
) {
  const res = await api.patch(`/customers/${customerId}/reputation`, payload);
  return res.data;
}


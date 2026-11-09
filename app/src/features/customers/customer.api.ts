import api from '../../shared/lib/axios';
import type { BookingStatus } from '../booking/booking.api';

export type CustomerSegment = 'VIP' | 'REGULAR' | 'NEW' | 'WARNING';

export interface CustomerItem {
  id: number;
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
  cancelledBookings: number;
  noShowCount: number;
  totalSpent: number;
  lastBookingDate: string | null;
  segment: CustomerSegment;
}

export interface CustomerBookingHistoryItem {
  bookingId: number;
  courtId: number;
  courtName: string;
  courtAddress?: string;
  sportName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  depositAmount: number;
  paidAmount: number;
  paymentMethod: string;
  status: BookingStatus;
  createdAt: string;
}

export interface CustomerHistoryResponse {
  customer: CustomerItem;
  bookings: CustomerBookingHistoryItem[];
}

export async function getCustomerListApi(params?: {
  search?: string;
  segment?: string;
}): Promise<CustomerItem[]> {
  const res = await api.get('/customers', { params });
  return res.data.data;
}

export async function getCustomerHistoryApi(
  customerId: number
): Promise<CustomerHistoryResponse> {
  const res = await api.get(`/customers/${customerId}/history`);
  return res.data.data;
}

export async function updateCustomerReputationApi(
  customerId: number,
  payload: { reputationScore?: number; status?: 'ACTIVE' | 'LOCKED' }
): Promise<void> {
  await api.patch(`/customers/${customerId}/reputation`, payload);
}


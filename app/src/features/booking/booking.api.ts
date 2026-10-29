import api from '../../shared/lib/axios';

export interface Booking {
  id: number;
  courtId: number;
  userId: number;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export async function fetchBookings(): Promise<Booking[]> {
  const res = await api.get('/bookings');
  return res.data.data;
}

export async function createBooking(data: Partial<Booking>): Promise<Booking> {
  const res = await api.post('/bookings', data);
  return res.data.data;
}

export async function cancelBooking(id: number): Promise<void> {
  await api.delete(`/bookings/${id}`);
}

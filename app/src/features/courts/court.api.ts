import api from '../../shared/lib/axios';

export interface CourtItem {
  court_id: number;
  court_name: string;
  facility_id?: number | null;
  facility_name?: string;
  facility_address?: string;
  facility_phone?: string;
  owner_id: number;
  sport_id: number;
  sport_name?: string;
  price_per_hour: number;
  address?: string;
  description?: string;
  capacity?: number;
  images?: string;
  status: string;
  rating?: number;
  rating_count?: number;
}

// Giữ tương thích ngược với interface Court cũ
export interface Court {
  id: number;
  ownerId: number;
  name: string;
  address: string;
  sport: string;
  pricePerHour: number;
}

export interface FetchCourtParams {
  keyword?: string;
  sport_id?: number | string;
  facility_id?: number | string;
  owner_id?: number | string;
}

export async function fetchCourts(params?: FetchCourtParams): Promise<CourtItem[]> {
  const res = await api.get('/courts', { params });
  return res.data.data;
}

export async function fetchCourtById(id: number): Promise<CourtItem> {
  const res = await api.get(`/courts/${id}`);
  return res.data.data;
}

export async function createCourt(data: Partial<CourtItem>): Promise<CourtItem> {
  const res = await api.post('/courts', data);
  return res.data.data;
}

export async function updateCourt(id: number, data: Partial<CourtItem>): Promise<CourtItem> {
  const res = await api.put(`/courts/${id}`, data);
  return res.data.data;
}

export async function deleteCourt(id: number): Promise<void> {
  await api.delete(`/courts/${id}`);
}

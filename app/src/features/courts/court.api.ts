import api from '../../shared/lib/axios';

export interface Court {
  id: number;
  ownerId: number;
  name: string;
  address: string;
  sport: string;
  pricePerHour: number;
}

export async function fetchCourts(): Promise<Court[]> {
  const res = await api.get('/courts');
  return res.data.data;
}

export async function fetchCourtById(id: number): Promise<Court> {
  const res = await api.get(`/courts/${id}`);
  return res.data.data;
}

export async function createCourt(data: Partial<Court>): Promise<Court> {
  const res = await api.post('/courts', data);
  return res.data.data;
}

export async function updateCourt(id: number, data: Partial<Court>): Promise<Court> {
  const res = await api.put(`/courts/${id}`, data);
  return res.data.data;
}

export async function deleteCourt(id: number): Promise<void> {
  await api.delete(`/courts/${id}`);
}

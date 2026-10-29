import api from '../../shared/lib/axios';

export interface Match {
  id: number;
  hostId: number;
  courtId: number;
  sport: string;
  matchDate: string;
  slots: number;
  status: 'open' | 'full' | 'cancelled';
}

/**
 * Lấy danh sách trận đấu đang mở.
 */
export async function fetchMatches(): Promise<Match[]> {
  const res = await api.get('/matches');
  return res.data.data;
}

/**
 * Lấy chi tiết một trận đấu.
 */
export async function fetchMatchById(id: number): Promise<Match> {
  const res = await api.get(`/matches/${id}`);
  return res.data.data;
}

/**
 * Tạo trận đấu mới.
 */
export async function createMatch(data: Partial<Match>): Promise<Match> {
  const res = await api.post('/matches', data);
  return res.data.data;
}

/**
 * Tham gia trận đấu.
 */
export async function joinMatch(matchId: number): Promise<void> {
  await api.post(`/matches/${matchId}/join`);
}

/**
 * Hủy trận đấu.
 */
export async function cancelMatch(matchId: number): Promise<void> {
  await api.delete(`/matches/${matchId}`);
}

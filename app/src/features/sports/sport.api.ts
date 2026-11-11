import api from '../../shared/lib/axios';

/**
 * ============================================================================
 * SPORTLINK - SPORT TYPE API CLIENT
 * Đặc tả WBS 3.1 (S2-03): Quản lý loại môn thể thao (thiết kế mở rộng & chi tiết sân)
 * ============================================================================
 */

export type SportStatus = 'ACTIVE' | 'INACTIVE';

export interface SportCourtDetail {
  court_id: number;
  sport_id: number;
  court_name: string;
  facility_id?: number | null;
  facility_name: string;
  address: string;
  facility_status: string;
  owner_id: number;
  owner_name: string;
  owner_email?: string;
  capacity: number;
  utilities?: string | null;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'CLOSED' | string;
}

export interface SportItem {
  sport_id: number;
  sport_name: string;
  description?: string | null;
  status: SportStatus;
  owner_id?: number | null;
  court_count?: number;
  active_court_count?: number;
  inactive_court_count?: number;
  facility_count?: number;
  courts?: SportCourtDetail[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateSportPayload {
  sportName: string;
  description?: string;
}

export interface UpdateSportPayload {
  sportName?: string;
  description?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

/**
 * Lấy danh mục loại môn thể thao công khai (không chứa danh sách sân nội bộ của các chủ sân).
 */
export async function getAllSportsApi(params?: {
  search?: string;
  status?: string;
}): Promise<SportItem[]> {
  const res = await api.get<ApiResponse<SportItem[]>>('/sports', { params });
  return res.data.data;
}

/**
 * Lấy danh mục loại môn thể thao kèm chi tiết các sân con thuộc quyền quản lý của Chủ sân đang đăng nhập.
 */
export async function getOwnerSportsApi(params?: {
  search?: string;
  status?: string;
}): Promise<SportItem[]> {
  const res = await api.get<ApiResponse<SportItem[]>>('/sports/owner', { params });
  return res.data.data;
}

/**
 * Lấy chi tiết một môn thể thao kèm danh sách sân con.
 */
export async function getSportByIdApi(id: number): Promise<SportItem> {
  const res = await api.get<ApiResponse<SportItem>>(`/sports/${id}`);
  return res.data.data;
}

/**
 * Thêm mới một loại môn thể thao vào danh mục.
 */
export async function createSportApi(payload: CreateSportPayload): Promise<SportItem> {
  const res = await api.post<ApiResponse<SportItem>>('/sports', payload);
  return res.data.data;
}

/**
 * Cập nhật thông tin loại môn thể thao.
 */
export async function updateSportApi(
  id: number,
  payload: UpdateSportPayload
): Promise<SportItem> {
  const res = await api.put<ApiResponse<SportItem>>(`/sports/${id}`, payload);
  return res.data.data;
}

/**
 * Bật / tắt trạng thái hoạt động của loại môn thể thao.
 */
export async function updateSportStatusApi(
  id: number,
  status: SportStatus
): Promise<SportItem> {
  const res = await api.patch<ApiResponse<SportItem>>(`/sports/${id}/status`, { status });
  return res.data.data;
}

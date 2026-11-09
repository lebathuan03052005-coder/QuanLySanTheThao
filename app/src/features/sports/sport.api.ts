import api from '../../shared/lib/axios';

/**
 * ============================================================================
 * SPORTLINK - SPORT TYPE API CLIENT
 * Đặc tả WBS 3.1: Quản lý loại môn thể thao
 * ============================================================================
 */

export type SportStatus = 'ACTIVE' | 'INACTIVE';

export interface SportItem {
  sport_id: number;
  sport_name: string;
  description?: string | null;
  status: SportStatus;
  court_count?: number;
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
 * Lấy danh sách toàn bộ loại môn thể thao trong hệ thống.
 */
export async function getAllSportsApi(params?: {
  search?: string;
  status?: string;
}): Promise<SportItem[]> {
  const res = await api.get<ApiResponse<SportItem[]>>('/sports', { params });
  return res.data.data;
}

/**
 * Lấy chi tiết một môn thể thao.
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


import api from '../../shared/lib/axios';

/**
 * ============================================================================
 * SPORTLINK - FACILITY & COURT API CLIENT
 * Đặc tả WBS 3.1 (S2-02): Quản lý cơ sở sân & danh sách sân con
 * ============================================================================
 */

export type FacilityStatus = 'ACTIVE' | 'INACTIVE';
export type CourtStatus = 'ACTIVE' | 'INACTIVE';

export interface FacilityCourtPreview {
  court_id: number;
  facility_id: number;
  court_name: string;
  sport_id: number;
  sport_name: string;
  capacity?: number;
  status: CourtStatus;
}

export interface FacilityItem {
  facility_id: number;
  owner_id: number;
  name: string;
  address: string;
  phone?: string | null;
  description?: string | null;
  status: FacilityStatus;
  total_courts: number;
  active_courts: number;
  courts_preview?: FacilityCourtPreview[];
  created_at: string;
  updated_at: string;
}

export interface CourtItem {
  court_id: number;
  facility_id: number;
  facility_name?: string;
  owner_id: number;
  sport_id: number;
  sport_name?: string;
  court_name: string;
  address?: string;
  capacity?: number | null;
  description?: string | null;
  utilities?: string | null;
  status: CourtStatus;
  images?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateFacilityPayload {
  name: string;
  address: string;
  phone?: string;
  description?: string;
}

export interface UpdateFacilityPayload {
  name?: string;
  address?: string;
  phone?: string;
  description?: string;
}

export interface CreateCourtPayload {
  courtName: string;
  sportId: number;
  capacity?: number;
  description?: string;
  utilities?: string;
  images?: string;
}

export interface UpdateCourtPayload {
  courtName?: string;
  sportId?: number;
  capacity?: number;
  description?: string;
  utilities?: string;
  images?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

/**
 * Lấy danh sách cơ sở sân do OWNER quản lý kèm tóm tắt sân con trực thuộc.
 */
export async function getOwnerFacilitiesApi(params?: {
  search?: string;
  status?: string;
}): Promise<FacilityItem[]> {
  const res = await api.get<ApiResponse<FacilityItem[]>>('/facilities', { params });
  return res.data.data;
}

/**
 * Lấy chi tiết một cơ sở sân.
 */
export async function getFacilityByIdApi(id: number): Promise<FacilityItem> {
  const res = await api.get<ApiResponse<FacilityItem>>(`/facilities/${id}`);
  return res.data.data;
}

/**
 * Thêm mới một cơ sở sân.
 */
export async function createFacilityApi(payload: CreateFacilityPayload): Promise<FacilityItem> {
  const res = await api.post<ApiResponse<FacilityItem>>('/facilities', payload);
  return res.data.data;
}

/**
 * Cập nhật thông tin cơ sở sân.
 */
export async function updateFacilityApi(
  id: number,
  payload: UpdateFacilityPayload
): Promise<FacilityItem> {
  const res = await api.put<ApiResponse<FacilityItem>>(`/facilities/${id}`, payload);
  return res.data.data;
}

/**
 * Bật / tắt trạng thái hoạt động cơ sở sân.
 */
export async function updateFacilityStatusApi(
  id: number,
  status: FacilityStatus
): Promise<FacilityItem> {
  const res = await api.patch<ApiResponse<FacilityItem>>(`/facilities/${id}/status`, { status });
  return res.data.data;
}

/**
 * Lấy danh sách các sân con thuộc một cơ sở.
 */
export async function getCourtsByFacilityApi(
  facilityId: number,
  params?: { status?: string; sportId?: number }
): Promise<CourtItem[]> {
  const res = await api.get<ApiResponse<CourtItem[]>>(`/facilities/${facilityId}/courts`, {
    params,
  });
  return res.data.data;
}

/**
 * Thêm sân con mới vào một cơ sở.
 */
export async function createCourtInFacilityApi(
  facilityId: number,
  payload: CreateCourtPayload
): Promise<CourtItem> {
  const res = await api.post<ApiResponse<CourtItem>>(`/facilities/${facilityId}/courts`, payload);
  return res.data.data;
}

/**
 * Cập nhật thông tin sân con trực thuộc cơ sở.
 */
export async function updateCourtInFacilityApi(
  courtId: number,
  payload: UpdateCourtPayload
): Promise<CourtItem> {
  const res = await api.put<ApiResponse<CourtItem>>(`/facilities/courts/${courtId}`, payload);
  return res.data.data;
}

/**
 * Bật / tắt trạng thái hoạt động của sân con.
 */
export async function updateCourtStatusApi(
  courtId: number,
  status: CourtStatus
): Promise<CourtItem> {
  const res = await api.patch<ApiResponse<CourtItem>>(`/facilities/courts/${courtId}/status`, {
    status,
  });
  return res.data.data;
}

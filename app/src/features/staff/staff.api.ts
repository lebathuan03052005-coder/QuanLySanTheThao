import api from '../../shared/lib/axios';

export interface AssignedCourt {
  courtId: number;
  courtName: string;
  sportId: number;
  address?: string;
}

export type StaffStatus = 'ACTIVE' | 'LOCKED' | 'INACTIVE';

export interface StaffItem {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  role: string;
  status: StaffStatus;
  jobTitle: string;
  avatarUrl?: string | null;
  createdAt: string;
  assignedCourts: AssignedCourt[];
}

export interface CourtOption {
  courtId: number;
  courtName: string;
  sportId: number;
  address?: string;
  status?: string;
  images?: string;
}

export interface CreateStaffPayload {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  jobTitle?: string;
  courtIds?: number[];
}

export interface UpdateStaffPayload {
  fullName?: string;
  phone?: string;
  jobTitle?: string;
  password?: string;
  courtIds?: number[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

/**
 * Lấy danh sách nhân viên do chủ sân quản lý.
 */
export async function getStaffListApi(params?: { search?: string; status?: string }): Promise<StaffItem[]> {
  const res = await api.get<ApiResponse<StaffItem[]>>('/staff', { params });
  return res.data.data;
}

/**
 * Lấy danh sách toàn bộ sân của chủ sân để phục vụ phân công.
 */
export async function getOwnerCourtsApi(): Promise<CourtOption[]> {
  const res = await api.get<ApiResponse<CourtOption[]>>('/staff/courts');
  return res.data.data;
}

/**
 * Lấy chi tiết thông tin một nhân viên.
 */
export async function getStaffByIdApi(id: number): Promise<StaffItem> {
  const res = await api.get<ApiResponse<StaffItem>>(`/staff/${id}`);
  return res.data.data;
}

/**
 * Thêm mới nhân viên và phân công sân phụ trách.
 */
export async function createStaffApi(payload: CreateStaffPayload): Promise<StaffItem> {
  const res = await api.post<ApiResponse<StaffItem>>('/staff', payload);
  return res.data.data;
}

/**
 * Cập nhật thông tin nhân viên và phân công sân.
 */
export async function updateStaffApi(id: number, payload: UpdateStaffPayload): Promise<StaffItem> {
  const res = await api.put<ApiResponse<StaffItem>>(`/staff/${id}`, payload);
  return res.data.data;
}

/**
 * Cập nhật trạng thái tài khoản nhân viên (ACTIVE, LOCKED, INACTIVE).
 */
export async function updateStaffStatusApi(
  id: number,
  status: StaffStatus
): Promise<{ id: number; fullName: string; status: StaffStatus }> {
  const res = await api.patch<ApiResponse<{ id: number; fullName: string; status: StaffStatus }>>(
    `/staff/${id}/status`,
    { status }
  );
  return res.data.data;
}

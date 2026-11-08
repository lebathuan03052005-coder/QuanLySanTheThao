import api from '../../shared/lib/axios';
import type { UserRole } from '../../shared/stores/authStore';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  fullName: string;
  role?: UserRole;
}

export interface RawUserData {
  id?: number;
  Id?: number;
  fullName?: string;
  FullName?: string;
  email?: string;
  Email?: string;
  role?: UserRole;
  Role?: UserRole;
  avatarUrl?: string;
  avatar_url?: string;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  data: RawUserData;
  message?: string;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/login', payload);
  return res.data;
}

export async function loginWithGoogle(credential: string): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/google', { credential });
  return res.data;
}

export async function register(payload: RegisterPayload) {
  const res = await api.post('/auth/register', payload);
  return res.data;
}

export async function getProfile() {
  const res = await api.get('/auth/profile');
  return res.data.data;
}

export async function uploadAvatarApi(file: File): Promise<{ success: boolean; data: { avatarUrl: string }; message?: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await api.post<{ success: boolean; data: { avatarUrl: string }; message?: string }>(
    '/auth/avatar',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return res.data;
}

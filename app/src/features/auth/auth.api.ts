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

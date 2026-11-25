import api from '../../shared/lib/axios';
import type { UserRole } from '../../shared/stores/authStore';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  fullName: string;
  phone?: string;
  role?: UserRole;
}

export interface RawUserData {
  id?: number;
  Id?: number;
  fullName?: string;
  FullName?: string;
  phone?: string;
  email?: string;
  Email?: string;
  role?: UserRole;
  Role?: UserRole;
  avatarUrl?: string;
  avatar_url?: string;
  reputationScore?: number;
}

export interface LoginResponse {
  success: boolean;
  token: string;
  data: RawUserData;
  message?: string;
}

export interface PlayerProfileStats {
  totalBookings: number;
  upcomingBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  memberTier: string;
}

export interface PlayerProfileData {
  id: number;
  fullName: string;
  phone: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  reputationScore: number;
  status: string;
  gender: string;
  dob: string | null;
  address: string;
  bio: string;
  favoriteSports: string[];
  createdAt: string;
  stats: PlayerProfileStats;
}

export interface ForgotPasswordResponse {
  identifier: string;
  maskedEmail: string;
  fullName: string;
  expiresInMinutes: number;
  sandboxOtp: string;
  message: string;
}

export interface UserNotificationItem {
  notification_id: number;
  user_id: number;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/login', payload);
  return res.data;
}

export async function loginWithGoogle(credential: string): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/google', { credential });
  return res.data;
}

export async function register(payload: RegisterPayload): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>('/auth/register', payload);
  return res.data;
}

export async function forgotPasswordApi(identifier: string): Promise<{
  success: boolean;
  message: string;
  data: ForgotPasswordResponse;
}> {
  const res = await api.post('/auth/forgot-password', { identifier });
  return res.data;
}

export async function verifyResetOtpApi(payload: {
  identifier: string;
  otp: string;
}): Promise<{ success: boolean; message: string; data: { valid: boolean } }> {
  const res = await api.post('/auth/verify-reset-otp', payload);
  return res.data;
}

export async function resetPasswordApi(payload: {
  identifier: string;
  otp: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await api.post('/auth/reset-password', payload);
  return res.data;
}

export async function getProfile(): Promise<PlayerProfileData> {
  const res = await api.get<{ success: boolean; data: PlayerProfileData }>('/auth/profile');
  return res.data.data;
}

export async function updateProfileApi(payload: {
  fullName?: string;
  phone?: string;
  gender?: string;
  dob?: string | null;
  address?: string;
  bio?: string;
  favoriteSports?: string[];
}): Promise<{ success: boolean; message: string; data: PlayerProfileData }> {
  const res = await api.put('/auth/profile', payload);
  return res.data;
}

export async function changePasswordApi(payload: {
  currentPassword?: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await api.put('/auth/change-password', payload);
  return res.data;
}

export async function uploadAvatarApi(file: File): Promise<{
  success: boolean;
  data: { avatarUrl: string };
  message?: string;
}> {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await api.post<{
    success: boolean;
    data: { avatarUrl: string };
    message?: string;
  }>('/auth/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function getUserNotificationsApi(): Promise<{
  unreadCount: number;
  notifications: UserNotificationItem[];
}> {
  const res = await api.get('/auth/notifications');
  return res.data.data;
}

export async function markNotificationsReadApi(): Promise<{ success: boolean }> {
  const res = await api.patch('/auth/notifications/read');
  return res.data;
}

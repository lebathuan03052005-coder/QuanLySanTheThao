import api from '../../shared/lib/axios';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload extends LoginPayload {
  fullName: string;
  role?: 'player' | 'owner';
}

export async function login(payload: LoginPayload) {
  const res = await api.post('/auth/login', payload);
  return res.data; // { token, data: user }
}

export async function register(payload: RegisterPayload) {
  const res = await api.post('/auth/register', payload);
  return res.data;
}

export async function getProfile() {
  const res = await api.get('/auth/profile');
  return res.data.data;
}

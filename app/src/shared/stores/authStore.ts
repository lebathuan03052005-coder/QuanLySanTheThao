import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'player' | 'owner' | 'staff' | 'admin';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

/**
 * Store quản lý trạng thái xác thực toàn cục.
 * Sử dụng persist middleware để lưu vào localStorage.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) =>
        set({ user, token, isAuthenticated: true }),

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'sportlink-auth',
    }
  )
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'player' | 'owner' | 'staff';

export interface User {
  id: number;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatarUrl?: string | null;
  reputationScore?: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  updateUserAvatar: (avatarUrl: string) => void;
  updateUserInfo: (partial: Partial<User>) => void;
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

      updateUserAvatar: (avatarUrl: string) =>
        set((state) => ({
          user: state.user ? { ...state.user, avatarUrl } : null,
        })),

      updateUserInfo: (partial: Partial<User>) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'sportlink-auth',
    }
  )
);

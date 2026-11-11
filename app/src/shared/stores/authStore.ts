import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'player' | 'owner' | 'staff' | 'admin';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  updateUserAvatar: (avatarUrl: string) => void;
  logout: () => void;
}

const CP1252_REVERSE: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function fixVietnameseMojibake(str?: string | null): string {
  if (!str) return '';
  if (!/(?:Ã.|Ä.|á».|Æ.|º|»|Â)/.test(str)) return str;
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0xff) {
      bytes.push(code);
    } else if (CP1252_REVERSE[code] !== undefined) {
      bytes.push(CP1252_REVERSE[code]);
    } else {
      return str;
    }
  }
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    return decoded;
  } catch {
    return str;
  }
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
        set({
          user: { ...user, fullName: fixVietnameseMojibake(user.fullName) },
          token,
          isAuthenticated: true,
        }),

      updateUserAvatar: (avatarUrl: string) =>
        set((state) => ({
          user: state.user ? { ...state.user, avatarUrl } : null,
        })),

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'sportlink-auth',
      onRehydrateStorage: () => (state) => {
        if (state?.user?.fullName) {
          state.user.fullName = fixVietnameseMojibake(state.user.fullName);
        }
      },
    }
  )
);

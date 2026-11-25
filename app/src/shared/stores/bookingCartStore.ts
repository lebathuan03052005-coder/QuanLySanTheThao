import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BookingCartItem {
  cartItemId: string;
  courtId: number;
  courtName: string;
  facilityId?: number | null;
  facilityName: string;
  sportName: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  basePricePerHour: number;
  estimatedPrice: number;
}

interface BookingCartState {
  items: BookingCartItem[];
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  addItem: (item: Omit<BookingCartItem, 'cartItemId'>) => { added: boolean; message: string };
  removeItem: (cartItemId: string) => void;
  clearCart: () => void;
}

function toMin(t: string): number {
  const [h, m] = (t || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * [4.3 - S3-06] Store quản lý Giỏ đặt sân đa khung giờ / đa sân (Multi-Slot Booking Cart).
 * Lưu trữ bền vững trong localStorage để người chơi tự do chọn nhiều ca trước khi thanh toán.
 */
export const useBookingCartStore = create<BookingCartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      setOpen: (open) => set({ isOpen: open }),

      addItem: (newItem) => {
        const current = get().items;
        const cartItemId = `${newItem.courtId}-${newItem.bookingDate}-${newItem.startTime}-${newItem.endTime}`;

        const newStart = toMin(newItem.startTime);
        const newEnd = toMin(newItem.endTime);

        const overlap = current.find(
          (it) =>
            Number(it.courtId) === Number(newItem.courtId) &&
            it.bookingDate === newItem.bookingDate &&
            toMin(it.startTime) < newEnd &&
            toMin(it.endTime) > newStart
        );

        if (overlap) {
          return {
            added: false,
            message: `Khung giờ ${newItem.startTime} - ${newItem.endTime} của sân "${newItem.courtName}" bị trùng với ca ${overlap.startTime} - ${overlap.endTime} đã có trong giỏ đặt sân!`,
          };
        }

        set({
          items: [...current, { ...newItem, cartItemId }],
        });

        return {
          added: true,
          message: `Đã thêm sân "${newItem.courtName}" (${newItem.bookingDate} • ${newItem.startTime} - ${newItem.endTime}) vào Giỏ đặt sân!`,
        };
      },

      removeItem: (cartItemId) =>
        set((state) => ({
          items: state.items.filter((it) => it.cartItemId !== cartItemId),
        })),

      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'sportlink-booking-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
);

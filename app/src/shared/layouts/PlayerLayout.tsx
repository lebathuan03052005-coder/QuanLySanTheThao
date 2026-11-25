import { Outlet } from 'react-router';
import PlayerNavbar from '../components/PlayerNavbar';
import PlayerFooter from '../components/PlayerFooter';
import BookingCartDrawer from '../../features/booking/BookingCartDrawer';

/**
 * Layout chính dành cho Người chơi (Player) & Người dùng cuối.
 * Tích hợp Header/Navbar, Giỏ đặt sân đa khung giờ (S3-06) và Footer chuẩn theo thiết kế SportLink.
 */
export default function PlayerLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-gray-800 antialiased">
      {/* Thanh điều hướng trên cùng chuẩn mockup */}
      <PlayerNavbar />

      {/* Nội dung trang thay đổi theo route */}
      <main className="flex-1 w-full">
        <Outlet />
      </main>

      {/* Drawer Giỏ đặt sân đa khung giờ tự động tính tiền (WBS 4.3 - S3-06) */}
      <BookingCartDrawer />

      {/* Chân trang Footer hoàn chỉnh & chuyên nghiệp */}
      <PlayerFooter />
    </div>
  );
}

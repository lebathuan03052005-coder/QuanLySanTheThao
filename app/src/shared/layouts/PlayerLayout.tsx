import { Outlet } from 'react-router';
import PlayerNavbar from '../components/PlayerNavbar';

/**
 * Layout chính dành cho Người chơi (Player) & Người dùng cuối.
 * Tích hợp Header/Navbar chuẩn theo thiết kế SportLink mockup.
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
    </div>
  );
}

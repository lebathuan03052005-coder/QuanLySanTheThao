import { Outlet } from 'react-router';
import OwnerSidebar from '../components/OwnerSidebar';

/**
 * Layout dành riêng cho chủ sân (Owner).
 * Nền xám nhạt hiện đại kết hợp các thẻ nội dung màu trắng có đổ bóng nổi bật.
 */
export default function OwnerLayout() {
  return (
    <div className="min-h-screen bg-[#f4f5fa] p-3 md:p-4 flex gap-4">
      {/* Sidebar nổi bo tròn */}
      <OwnerSidebar />

      {/* Khu vực nội dung chính: Cùng độ cao tối thiểu với sidebar để các thẻ bên trong kéo dài ngang bằng */}
      <main className="flex-1 flex flex-col min-w-0 min-h-[calc(100vh-2rem)]">
        <Outlet />
      </main>
    </div>
  );
}

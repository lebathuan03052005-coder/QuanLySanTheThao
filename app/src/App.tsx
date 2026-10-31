import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import LoginPage from './features/auth/LoginPage';
import PlayerLayout from './shared/layouts/PlayerLayout';
import OwnerLayout from './shared/layouts/OwnerLayout';
import MatchListPage from './features/matches/MatchListPage';
import { useAuthStore } from './shared/stores/authStore';

function AdminPlaceholder() {
  const { user, logout } = useAuthStore();
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow border border-gray-200">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div>
            <span className="inline-block px-2.5 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full mb-1">
              Quản trị viên
            </span>
            <h1 className="text-2xl font-bold text-gray-800">Khu vực Quản trị Hệ thống (Admin)</h1>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Đăng xuất
          </button>
        </div>
        <p className="mt-4 text-gray-600">
          Xin chào, <strong>{user?.fullName}</strong> ({user?.email})
        </p>
      </div>
    </div>
  );
}

function StaffPlaceholder() {
  const { user, logout } = useAuthStore();
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow border border-gray-200">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div>
            <span className="inline-block px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full mb-1">
              Nhân viên
            </span>
            <h1 className="text-2xl font-bold text-gray-800">Khu vực Nhân viên Vận hành (Staff)</h1>
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Đăng xuất
          </button>
        </div>
        <p className="mt-4 text-gray-600">
          Xin chào, <strong>{user?.fullName}</strong> ({user?.email})
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Route dành cho Player / Người dùng thông thường */}
        <Route path="/" element={<PlayerLayout />}>
          <Route index element={<MatchListPage />} />
          <Route path="matches" element={<MatchListPage />} />
          <Route path="courts" element={<div className="p-4 text-gray-600">Khu vực danh sách sân</div>} />
          <Route path="bookings" element={<div className="p-4 text-gray-600">Khu vực lịch đặt sân</div>} />
        </Route>

        {/* Route dành cho Owner / Chủ sân */}
        <Route path="/owner" element={<OwnerLayout />}>
          <Route index element={<Navigate to="/owner/courts" replace />} />
          <Route path="courts" element={<div className="p-4 text-gray-600">Quản lý sân bóng (Owner)</div>} />
          <Route path="bookings" element={<div className="p-4 text-gray-600">Quản lý lịch đặt sân (Owner)</div>} />
          <Route path="revenue" element={<div className="p-4 text-gray-600">Báo cáo doanh thu (Owner)</div>} />
        </Route>

        {/* Route dành cho Admin & Staff */}
        <Route path="/admin" element={<AdminPlaceholder />} />
        <Route path="/staff" element={<StaffPlaceholder />} />

        {/* Điều hướng mặc định */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import { Outlet, NavLink, useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';

/**
 * Layout chính cho người chơi (Player).
 * Hiển thị Navbar với các liên kết phù hợp với vai trò player.
 */
export default function PlayerLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <span className="font-bold text-xl text-green-600">SportLink</span>
          <div className="flex items-center gap-6">
            <NavLink to="/courts" className="text-gray-600 hover:text-green-600 text-sm font-medium">
              Tìm sân
            </NavLink>
            <NavLink to="/matches" className="text-gray-600 hover:text-green-600 text-sm font-medium">
              Cáp kèo
            </NavLink>
            <NavLink to="/bookings" className="text-gray-600 hover:text-green-600 text-sm font-medium">
              Lịch đặt
            </NavLink>
            <button
              onClick={handleLogout}
              className="text-sm text-red-500 hover:text-red-700 font-medium"
            >
              Đăng xuất ({user?.fullName})
            </button>
          </div>
        </div>
      </nav>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

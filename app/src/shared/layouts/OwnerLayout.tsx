import { Outlet, NavLink, useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';

/**
 * Layout dành riêng cho chủ sân (Owner).
 * Có Sidebar điều hướng quản lý sân, lịch đặt, doanh thu.
 */
export default function OwnerLayout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const navItems = [
    { to: '/owner/courts', label: 'Quản lý sân' },
    { to: '/owner/bookings', label: 'Lịch đặt sân' },
    { to: '/owner/revenue', label: 'Doanh thu' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-60 bg-green-700 text-white flex flex-col">
        <div className="h-16 flex items-center px-6 font-bold text-xl border-b border-green-600">
          SportLink Owner
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-6 py-3 text-sm font-medium transition-colors ${
                  isActive ? 'bg-green-600' : 'hover:bg-green-600/50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-green-600">
          <p className="text-xs text-green-200 mb-2">{user?.fullName}</p>
          <button
            onClick={handleLogout}
            className="w-full text-left text-sm text-red-300 hover:text-red-100"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 p-6">
        <Outlet />
      </main>
    </div>
  );
}

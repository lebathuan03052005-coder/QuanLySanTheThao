import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import LoginPage from "./features/auth/LoginPage";
import PlayerLayout from "./shared/layouts/PlayerLayout";
import OwnerLayout from "./shared/layouts/OwnerLayout";
import PlayerHomePage from "./features/home/PlayerHomePage";
import CourtListPage from "./features/courts/CourtListPage";
import MatchListPage from "./features/matches/MatchListPage";
import StaffManagementPage from "./features/staff/StaffManagementPage";
import FacilityManagementPage from "./features/facilities/FacilityManagementPage";
import SportManagementPage from "./features/sports/SportManagementPage";
import CourtSchedulePage from "./features/booking/CourtSchedulePage";
import CustomerManagementPage from "./features/customers/CustomerManagementPage";
import RevenueDashboardPage from "./features/analytics/RevenueDashboardPage";
import OccupancyAnalyticsPage from "./features/analytics/OccupancyAnalyticsPage";
import { useAuthStore } from "./shared/stores/authStore";

function PlayerRouteGuard() {
  return <PlayerLayout />;
}

function OwnerRouteGuard() {
  const { user, token } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  const role = (user.role || "").toLowerCase();
  if (role === "staff") return <Navigate to="/staff/bookings" replace />;
  if (role !== "owner" && role !== "admin") return <Navigate to="/" replace />;
  return <OwnerLayout />;
}

function StaffRouteGuard() {
  const { user, token } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  const role = (user.role || "").toLowerCase();
  if (role === "owner") return <Navigate to="/owner/bookings" replace />;
  if (role !== "staff" && role !== "admin") return <Navigate to="/" replace />;
  return <OwnerLayout />;
}

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
            <h1 className="text-2xl font-bold text-gray-800">
              Khu vực Quản trị Hệ thống (Admin)
            </h1>
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
        <Route path="/" element={<PlayerRouteGuard />}>
          <Route index element={<PlayerHomePage />} />
          <Route path="courts" element={<CourtListPage />} />
          <Route path="bookings" element={<div className="p-8 text-center text-gray-500">Khu vực lịch đặt sân của tôi</div>} />
          <Route path="matches" element={<MatchListPage />} />
          <Route path="news" element={<div className="p-8 text-center text-gray-500">Khu vực tin tức thể thao SportLink</div>} />
        </Route>

        {/* Route dành cho Owner / Chủ sân (Khớp với các mục trên Sidebar) */}
        <Route path="/owner" element={<OwnerRouteGuard />}>
          <Route index element={<Navigate to="/owner/bookings" replace />} />
          <Route path="analytics" element={<OccupancyAnalyticsPage />} />
          <Route path="bookings" element={<CourtSchedulePage />} />
          <Route path="schedule" element={<CourtSchedulePage />} />
          <Route path="revenue" element={<RevenueDashboardPage />} />
          <Route path="courts" element={<FacilityManagementPage />} />
          <Route path="sports" element={<SportManagementPage />} />
          <Route path="staff" element={<StaffManagementPage />} />
          <Route path="players" element={<CustomerManagementPage />} />
          <Route path="customers" element={<CustomerManagementPage />} />
          <Route
            path="tournaments"
            element={
              <div className="p-4 text-gray-700 font-medium">
                Giải đấu & Tournaments (Owner)
              </div>
            }
          />
          <Route
            path="coaches"
            element={
              <div className="p-4 text-gray-700 font-medium">
                Huấn luyện viên & Coaches (Owner)
              </div>
            }
          />
          <Route
            path="settings"
            element={
              <div className="p-4 text-gray-700 font-medium">
                Cài đặt cụm sân (Owner)
              </div>
            }
          />
          <Route
            path="support"
            element={
              <div className="p-4 text-gray-700 font-medium">
                Trung tâm hỗ trợ (Owner)
              </div>
            }
          />
        </Route>

        {/* Route dành cho Nhân viên Vận hành (Staff) */}
        <Route path="/staff" element={<StaffRouteGuard />}>
          <Route index element={<Navigate to="/staff/bookings" replace />} />
          <Route path="bookings" element={<CourtSchedulePage />} />
          <Route path="schedule" element={<CourtSchedulePage />} />
          <Route path="players" element={<CustomerManagementPage />} />
          <Route path="customers" element={<CustomerManagementPage />} />
          <Route path="*" element={<Navigate to="/staff/bookings" replace />} />
        </Route>

        {/* Route dành cho Admin */}
        <Route path="/admin" element={<AdminPlaceholder />} />

        {/* Điều hướng mặc định */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

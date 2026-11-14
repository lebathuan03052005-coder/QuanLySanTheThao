import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import LoginPage from "./features/auth/LoginPage";
import PlayerLayout from "./shared/layouts/PlayerLayout";
import OwnerLayout from "./shared/layouts/OwnerLayout";
import PlayerHomePage from "./features/home/PlayerHomePage";
import CourtListPage from "./features/courts/CourtListPage";
import FacilityDetailPage from "./features/facilities/FacilityDetailPage";
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
  if (role !== "owner") return <Navigate to="/" replace />;
  return <OwnerLayout />;
}

function StaffRouteGuard() {
  const { user, token } = useAuthStore();
  if (!token || !user) return <Navigate to="/login" replace />;
  const role = (user.role || "").toLowerCase();
  if (role === "owner") return <Navigate to="/owner/bookings" replace />;
  if (role !== "staff") return <Navigate to="/" replace />;
  return <OwnerLayout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Route dành cho Player / Người dùng thông thường */}
        <Route path="/" element={<PlayerRouteGuard />}>
          <Route index element={<PlayerHomePage />} />
          <Route path="facilities/:id" element={<FacilityDetailPage />} />
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


        {/* Điều hướng mặc định */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

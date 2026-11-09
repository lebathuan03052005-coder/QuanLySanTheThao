import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import LoginPage from "./features/auth/LoginPage";
import PlayerLayout from "./shared/layouts/PlayerLayout";
import OwnerLayout from "./shared/layouts/OwnerLayout";
import MatchListPage from "./features/matches/MatchListPage";
import StaffManagementPage from "./features/staff/StaffManagementPage";
import CourtSchedulePage from "./features/booking/CourtSchedulePage";
import CustomerManagementPage from "./features/customers/CustomerManagementPage";
import RevenueDashboardPage from "./features/analytics/RevenueDashboardPage";
import OccupancyAnalyticsPage from "./features/analytics/OccupancyAnalyticsPage";
import { useAuthStore } from "./shared/stores/authStore";

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
            <h1 className="text-2xl font-bold text-gray-800">
              Khu vực Nhân viên Vận hành (Staff)
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
        <Route path="/" element={<PlayerLayout />}>
          <Route index element={<MatchListPage />} />
          <Route path="matches" element={<MatchListPage />} />
          <Route
            path="courts"
            element={
              <div className="p-4 text-gray-600">Khu vực danh sách sân</div>
            }
          />
          <Route
            path="bookings"
            element={
              <div className="p-4 text-gray-600">Khu vực lịch đặt sân</div>
            }
          />
        </Route>

        {/* Route dành cho Owner / Chủ sân (Khớp với các mục trên Sidebar) */}
        <Route path="/owner" element={<OwnerLayout />}>
          <Route index element={<Navigate to="/owner/analytics" replace />} />
          {/* [3.3] Thống kê tỷ lệ lấp đầy sân & khung giờ vắng (S2-10) */}
          <Route path="analytics" element={<OccupancyAnalyticsPage />} />

          {/* [3.1] Lịch sân theo Ngày/Tuần/Tháng (S2-05) */}
          <Route path="bookings" element={<CourtSchedulePage />} />

          {/* [3.3] Dashboard doanh thu theo ngày/tuần/tháng (S2-09) */}
          <Route path="revenue" element={<RevenueDashboardPage />} />

          <Route
            path="courts"
            element={
              <div className="p-4 text-gray-700 font-medium">
                Quản lý sân bóng (Owner)
              </div>
            }
          />

          {/* [3.1] Quản lý nhân viên và cấp quyền (S2-04) */}
          <Route path="staff" element={<StaffManagementPage />} />

          {/* [3.1] Quản lý khách hàng và lịch sử đặt sân (S2-06) */}
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

        {/* Route dành cho Admin & Staff */}
        <Route path="/admin" element={<AdminPlaceholder />} />
        <Route path="/staff" element={<StaffPlaceholder />} />

        {/* Điều hướng mặc định */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

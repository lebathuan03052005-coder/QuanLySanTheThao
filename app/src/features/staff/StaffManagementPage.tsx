import { useState, useEffect, useMemo } from "react";
import {
  getStaffListApi,
  getOwnerCourtsApi,
  createStaffApi,
  updateStaffApi,
  updateStaffStatusApi,
  type StaffItem,
  type CourtOption,
  type StaffStatus,
} from "./staff.api";

// Hàm tính toán danh sách số trang hiển thị
function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 4, "...", total];
  }
  if (current >= total - 2) {
    return [1, "...", total - 3, total - 2, total - 1, total];
  }
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export default function StaffManagementPage() {
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Bộ lọc tìm kiếm & trạng thái
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Phân trang danh sách nhân viên
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8); // 8 nhân viên mỗi trang

  // Tự động quay về trang 1 khi thay đổi tìm kiếm hoặc bộ lọc trạng thái
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Quản lý Modal Thêm / Chỉnh sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    jobTitle: "Nhân viên trực sân",
    courtIds: [] as number[],
  });

  // Modal Chi tiết nhân viên
  const [viewingStaff, setViewingStaff] = useState<StaffItem | null>(null);

  // Modal xác nhận đổi trạng thái
  const [statusModal, setStatusModal] = useState<{
    staff: StaffItem;
    targetStatus: StaffStatus;
  } | null>(null);

  // Tải dữ liệu ban đầu
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [staffData, courtData] = await Promise.all([
        getStaffListApi(),
        getOwnerCourtsApi(),
      ]);
      setStaffList(staffData);
      setCourts(courtData);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Không thể tải dữ liệu nhân viên.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string) {
    setToastMsg(message);
    setTimeout(() => setToastMsg(null), 3500);
  }

  // Lọc danh sách nhân viên
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      const matchSearch =
        staff.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.phone.includes(searchTerm);

      const matchStatus =
        statusFilter === "ALL" ? true : staff.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [staffList, searchTerm, statusFilter]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = staffList.length;
    const active = staffList.filter((s) => s.status === "ACTIVE").length;
    const locked = staffList.filter((s) => s.status === "LOCKED").length;
    const inactive = staffList.filter((s) => s.status === "INACTIVE").length;
    return { total, active, locked, inactive };
  }, [staffList]);

  // Tính toán dữ liệu phân trang
  const totalPages = Math.ceil(filteredStaff.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredStaff.length);
  const paginatedStaff = useMemo(() => {
    return filteredStaff.slice(startIndex, endIndex);
  }, [filteredStaff, startIndex, endIndex]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Mở modal tạo mới
  function handleOpenCreateModal() {
    setEditingStaff(null);
    setFormError(null);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      password: "",
      jobTitle: "Nhân viên trực sân",
      courtIds: courts.map((c) => c.courtId),
    });
    setIsModalOpen(true);
  }

  // Mở modal chỉnh sửa
  function handleOpenEditModal(staff: StaffItem) {
    setEditingStaff(staff);
    setFormError(null);
    setFormData({
      fullName: staff.fullName,
      email: staff.email,
      phone: staff.phone,
      password: "",
      jobTitle: staff.jobTitle,
      courtIds: staff.assignedCourts.map((c) => c.courtId),
    });
    setIsModalOpen(true);
  }

  // Xử lý lưu form thêm/sửa nhân viên
  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      if (editingStaff) {
        const payload: {
          fullName?: string;
          phone?: string;
          jobTitle?: string;
          password?: string;
          courtIds?: number[];
        } = {
          fullName: formData.fullName,
          phone: formData.phone,
          jobTitle: formData.jobTitle,
          courtIds: formData.courtIds,
        };
        if (formData.password.trim()) {
          payload.password = formData.password.trim();
        }

        const updated = await updateStaffApi(editingStaff.id, payload);
        setStaffList((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        showToast("Đã cập nhật thông tin nhân viên thành công.");
      } else {
        const created = await createStaffApi({
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          jobTitle: formData.jobTitle,
          courtIds: formData.courtIds,
        });
        setStaffList((prev) => [created, ...prev]);
        showToast("Đã tạo mới tài khoản nhân viên thành công.");
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setFormError(
        errorObj.response?.data?.message ||
          errorObj.message ||
          "Thao tác thất bại."
      );
    } finally {
      setFormSubmitting(false);
    }
  }

  // Xử lý xác nhận thay đổi trạng thái
  async function handleConfirmStatusChange() {
    if (!statusModal) return;
    const { staff, targetStatus } = statusModal;

    try {
      const result = await updateStaffStatusApi(staff.id, targetStatus);
      setStaffList((prev) =>
        prev.map((s) =>
          s.id === result.id ? { ...s, status: result.status } : s
        )
      );

      const statusLabels: Record<StaffStatus, string> = {
        ACTIVE: "kích hoạt lại",
        LOCKED: "khóa",
        INACTIVE: "ngừng hoạt động",
      };
      showToast(
        `Đã ${statusLabels[targetStatus]} tài khoản của ${staff.fullName}.`
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Không thể cập nhật trạng thái.";
      alert(msg);
    } finally {
      setStatusModal(null);
    }
  }

  // Chọn hoặc bỏ chọn sân trong Form
  function toggleCourtSelection(courtId: number) {
    setFormData((prev) => {
      const exists = prev.courtIds.includes(courtId);
      return {
        ...prev,
        courtIds: exists
          ? prev.courtIds.filter((id) => id !== courtId)
          : [...prev.courtIds, courtId],
      };
    });
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-[calc(100vh-2rem)]">
      {/* Toast thông báo nổi */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl shadow-2xl animate-fade-in font-medium text-sm">
          <span>✓</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. Header Thẻ Trắng: Tiêu đề & Nút Thêm mới */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 md:p-7 rounded-3xl border border-slate-200/80 shadow-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Quản Lý Nhân Viên & Phân Quyền
            </h1>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-200">
              RBAC
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            Tạo tài khoản, phân công sân phụ trách và kiểm soát quyền hạn nhân viên trong hệ thống sân của bạn
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all cursor-pointer shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Thêm nhân viên mới</span>
        </button>
      </div>

      {/* 2. Thẻ KPI Thống kê (Mỗi thẻ màu trắng có đổ bóng riêng biệt) */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Thẻ 1: Tổng nhân sự */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md hover:shadow-lg transition-shadow">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Tổng nhân sự
          </span>
          <div className="text-3xl font-black text-slate-900 mt-2">
            {stats.total}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Trong toàn hệ thống
          </span>
        </div>

        {/* Thẻ 2: Đang hoạt động */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đang hoạt động
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-emerald-600 mt-2">
            {stats.active}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Có quyền truy cập
          </span>
        </div>

        {/* Thẻ 3: Đã khóa */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đã khóa
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          </div>
          <div className="text-3xl font-black text-red-600 mt-2">
            {stats.locked}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Đình chỉ tạm thời
          </span>
        </div>

        {/* Thẻ 4: Tổng số sân */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md hover:shadow-lg transition-shadow">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Tổng số sân quản lý
          </span>
          <div className="text-3xl font-black text-blue-600 mt-2">
            {courts.length}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Sẵn sàng phân công
          </span>
        </div>
      </div>

      {/* 3. Thẻ Trắng Tìm kiếm & Bộ lọc */}
      <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-md">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo họ tên, email, SĐT..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 pl-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
          />
          <svg
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Tab lọc trạng thái */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200/70 w-full sm:w-auto overflow-x-auto">
          {[
            { key: "ALL", label: "Tất cả" },
            { key: "ACTIVE", label: "Hoạt động" },
            { key: "LOCKED", label: "Đã khóa" },
            { key: "INACTIVE", label: "Ngừng hoạt động" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Thẻ Bảng Danh Sách Nhân Viên: Kéo dài full chiều cao ngang bằng Sidebar */}
      <div className="flex-1 flex flex-col min-h-[350px] bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16 text-center text-slate-500 gap-3">
            <svg className="animate-spin w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="font-medium text-sm">Đang tải danh sách nhân viên...</span>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-red-600">
            <p className="font-medium">{errorMsg}</p>
            <button
              type="button"
              onClick={loadData}
              className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl shadow-xs">
              👥
            </div>
            <h4 className="text-base font-bold text-slate-800">Chưa có nhân viên nào phù hợp</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Không tìm thấy nhân viên nào với bộ lọc hiện tại. Bạn có thể thêm nhân viên mới hoặc đổi từ khóa tìm kiếm.
            </p>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 cursor-pointer transition-all"
            >
              + Thêm nhân viên ngay
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th scope="col" className="px-6 py-4">Nhân viên</th>
                    <th scope="col" className="px-6 py-4">Liên hệ</th>
                    <th scope="col" className="px-6 py-4">Sân phụ trách</th>
                    <th scope="col" className="px-6 py-4">Trạng thái</th>
                    <th scope="col" className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedStaff.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Cột 1: Thông tin nhân viên */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                            {staff.avatarUrl ? (
                              <img
                                src={staff.avatarUrl}
                                alt={staff.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-blue-600 font-bold text-sm">
                                {staff.fullName[0]?.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">
                              {staff.fullName}
                            </div>
                            <div className="text-xs text-blue-600 font-semibold truncate mt-0.5">
                              {staff.jobTitle}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Email & SĐT */}
                      <td className="px-6 py-4 text-xs">
                        <div className="text-slate-800 font-semibold">{staff.email}</div>
                        <div className="text-slate-500 mt-0.5">{staff.phone}</div>
                      </td>

                      {/* Cột 3: Sân phụ trách */}
                      <td className="px-6 py-4">
                        {staff.assignedCourts.length === 0 ? (
                          <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-medium">
                            Chưa phân công sân
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {staff.assignedCourts.map((court) => (
                              <span
                                key={court.courtId}
                                className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs"
                              >
                                <span>🎾</span>
                                <span className="truncate max-w-[120px]">
                                  {court.courtName}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Cột 4: Trạng thái tài khoản */}
                      <td className="px-6 py-4">
                        {staff.status === "ACTIVE" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Đang hoạt động</span>
                          </span>
                        )}
                        {staff.status === "LOCKED" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            <span>Đã khóa</span>
                          </span>
                        )}
                        {staff.status === "INACTIVE" && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span>Ngừng hoạt động</span>
                          </span>
                        )}
                      </td>

                      {/* Cột 5: Thao tác */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Xem chi tiết */}
                          <button
                            type="button"
                            onClick={() => setViewingStaff(staff)}
                            title="Xem chi tiết nhân viên"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          {/* Nút Chỉnh sửa */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(staff)}
                            title="Chỉnh sửa thông tin & phân công sân"
                            className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Nút Khóa / Mở khóa */}
                          {staff.status === "ACTIVE" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setStatusModal({ staff, targetStatus: "LOCKED" })
                              }
                              title="Khóa tài khoản"
                              className="p-1.5 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setStatusModal({ staff, targetStatus: "ACTIVE" })
                              }
                              title="Mở khóa tài khoản"
                              className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}

                          {/* Nút Ngừng hoạt động */}
                          {staff.status !== "INACTIVE" && (
                            <button
                              type="button"
                              onClick={() =>
                                setStatusModal({ staff, targetStatus: "INACTIVE" })
                              }
                              title="Ngừng làm việc tại hệ thống"
                              className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Thanh điều hướng phân trang (Pagination Footer) */}
            <div className="shrink-0 px-6 py-3.5 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 select-none">
              {/* Bên trái: Thông tin số lượng & Lựa chọn số hàng trên trang */}
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Hiển thị{" "}
                  <span className="font-semibold text-slate-900">
                    {filteredStaff.length === 0 ? 0 : startIndex + 1}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-900">
                    {endIndex}
                  </span>{" "}
                  trên{" "}
                  <span className="font-semibold text-slate-900">
                    {filteredStaff.length}
                  </span>{" "}
                  nhân viên
                </span>

                <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
                  <span className="text-slate-500">Mỗi trang:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-semibold focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                  >
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
              </div>

              {/* Bên phải: Nút Trước, Các trang, Nút Sau */}
              <div className="flex items-center gap-1">
                {/* Nút Trước */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={currentPage <= 1}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentPage <= 1
                      ? "opacity-40 cursor-not-allowed text-slate-400 bg-slate-100"
                      : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-xs"
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Trước</span>
                </button>

                {/* Danh sách số trang */}
                {getPageNumbers(currentPage, totalPages).map((p, idx) => {
                  if (p === "...") {
                    return (
                      <span key={`dots-${idx}`} className="px-2 py-1 text-slate-400 font-bold text-xs select-none">
                        ...
                      </span>
                    );
                  }
                  const pageNum = p as number;
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                          : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-xs"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                {/* Nút Sau */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    currentPage >= totalPages
                      ? "opacity-40 cursor-not-allowed text-slate-400 bg-slate-100"
                      : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/80 shadow-xs"
                  }`}
                >
                  <span>Sau</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ======================================================= */}
      {/* 5. MODAL THÊM MỚI / CHỈNH SỬA (Thẻ trắng, đổ bóng 2XL) */}
      {/* ======================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-xl bg-white border border-slate-200/80 rounded-3xl shadow-2xl p-6 md:p-8 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">
                {editingStaff
                  ? `Chỉnh Sửa Nhân Viên: ${editingStaff.fullName}`
                  : "Thêm Nhân Viên Mới Vào Hệ Thống"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 mt-6">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                  {formError}
                </div>
              )}

              {/* Họ tên */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Họ và tên nhân viên <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) =>
                    setFormData({ ...formData, fullName: e.target.value })
                  }
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Email & Số điện thoại */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email đăng nhập <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!!editingStaff}
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="nhanvien@sportlink.vn"
                    className="w-full bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="0912345678"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              {/* Chức danh & Mật khẩu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Chức danh công việc
                  </label>
                  <select
                    value={formData.jobTitle}
                    onChange={(e) =>
                      setFormData({ ...formData, jobTitle: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  >
                    <option value="Nhân viên trực sân">Nhân viên trực sân</option>
                    <option value="Nhân viên thu ngân">Nhân viên thu ngân</option>
                    <option value="Quản lý ca trực">Quản lý ca trực</option>
                    <option value="Hỗ trợ kỹ thuật sân">Hỗ trợ kỹ thuật sân</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {editingStaff ? "Đổi mật khẩu mới" : "Mật khẩu khởi tạo"}{" "}
                    {!editingStaff && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingStaff}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder={
                      editingStaff ? "Để trống nếu không đổi" : "Tối thiểu 6 ký tự"
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                  />
                </div>
              </div>

              {/* Phân công sân phụ trách (RBAC Scope) */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800">
                    Phân công sân phụ trách ({formData.courtIds.length}/{courts.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.courtIds.length === courts.length) {
                        setFormData({ ...formData, courtIds: [] });
                      } else {
                        setFormData({
                          ...formData,
                          courtIds: courts.map((c) => c.courtId),
                        });
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                  >
                    {formData.courtIds.length === courts.length
                      ? "Bỏ chọn tất cả"
                      : "Chọn tất cả"}
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-2xl p-3 divide-y divide-slate-100">
                  {courts.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-3">
                      Bạn chưa tạo sân nào. Hãy tạo sân trước để phân công.
                    </p>
                  ) : (
                    courts.map((court) => {
                      const isChecked = formData.courtIds.includes(court.courtId);
                      return (
                        <label
                          key={court.courtId}
                          className="flex items-center gap-3 py-2 px-1 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCourtSelection(court.courtId)}
                            className="w-4 h-4 rounded text-blue-600 bg-white border-slate-300 focus:ring-0"
                          />
                          <div className="flex-1 text-xs">
                            <span className="font-bold text-slate-800 block">
                              {court.courtName}
                            </span>
                            <span className="text-slate-500 truncate block text-[11px]">
                              {court.address || "Địa chỉ chưa cập nhật"}
                            </span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5 italic">
                  * Nhân viên chỉ có quyền xem lịch đặt, nhận khách và thu ngân trên các sân được phân công.
                </p>
              </div>

              {/* Nút hành động */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={formSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {formSubmitting ? "Đang lưu..." : editingStaff ? "Cập nhật" : "Tạo tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 6. MODAL XÁC NHẬN THAY ĐỔI TRẠNG THÁI (LOCKED/INACTIVE) */}
      {/* ======================================================= */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-2xl mb-4">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-slate-900">Xác nhận cập nhật trạng thái</h3>
            <p className="text-sm text-slate-600 mt-2">
              Bạn có chắc chắn muốn chuyển tài khoản của{" "}
              <strong className="text-slate-900">{statusModal.staff.fullName}</strong>{" "}
              sang trạng thái{" "}
              <strong className="text-amber-600">
                {statusModal.targetStatus === "ACTIVE"
                  ? "Đang hoạt động"
                  : statusModal.targetStatus === "LOCKED"
                  ? "Đã khóa"
                  : "Ngừng hoạt động"}
              </strong>
              ?
            </p>
            {statusModal.targetStatus === "LOCKED" && (
              <p className="text-xs text-red-700 mt-2 bg-red-50 p-3 rounded-xl border border-red-200 leading-relaxed font-medium">
                Khi bị khóa, nhân viên sẽ bị chấm dứt phiên làm việc ngay lập tức và không thể đăng nhập vào hệ thống.
              </p>
            )}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setStatusModal(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* 7. MODAL XEM CHI TIẾT NHÂN VIÊN                        */}
      {/* ======================================================= */}
      {viewingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Hồ Sơ Nhân Viên</h3>
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div className="w-14 h-14 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xl font-bold text-blue-600 shrink-0 overflow-hidden shadow-sm">
                  {viewingStaff.avatarUrl ? (
                    <img
                      src={viewingStaff.avatarUrl}
                      alt={viewingStaff.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    viewingStaff.fullName[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">{viewingStaff.fullName}</h4>
                  <div className="text-xs text-blue-600 font-semibold">{viewingStaff.jobTitle}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Tạo ngày: {new Date(viewingStaff.createdAt).toLocaleDateString("vi-VN")}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block mb-0.5">Email</span>
                  <span className="text-slate-800 font-semibold">{viewingStaff.email}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block mb-0.5">Số điện thoại</span>
                  <span className="text-slate-800 font-semibold">{viewingStaff.phone}</span>
                </div>
              </div>

              <div>
                <h5 className="text-xs font-bold text-slate-700 mb-2">
                  Danh sách sân được phân công ({viewingStaff.assignedCourts.length})
                </h5>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-40 overflow-y-auto space-y-1.5">
                  {viewingStaff.assignedCourts.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">Chưa phân công sân nào</span>
                  ) : (
                    viewingStaff.assignedCourts.map((c) => (
                      <div
                        key={c.courtId}
                        className="flex items-center justify-between text-xs text-slate-800 p-2 bg-white rounded-lg border border-slate-200/60 shadow-2xs"
                      >
                        <span className="font-semibold">🎾 {c.courtName}</span>
                        <span className="text-[11px] text-slate-500">{c.address}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingStaff(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

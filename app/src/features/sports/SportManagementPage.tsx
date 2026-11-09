import { useState, useEffect, useMemo } from 'react';
import {
  getAllSportsApi,
  createSportApi,
  updateSportApi,
  updateSportStatusApi,
  type SportItem,
  type SportStatus,
} from './sport.api';
import { useNavigate } from 'react-router';

export default function SportManagementPage() {
  const navigate = useNavigate();

  const [sports, setSports] = useState<SportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Bộ lọc tìm kiếm & trạng thái
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal Thêm / Sửa môn thể thao
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSport, setEditingSport] = useState<SportItem | null>(null);
  const [formData, setFormData] = useState({
    sportName: '',
    description: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal xác nhận đổi trạng thái
  const [statusModal, setStatusModal] = useState<{
    sport: SportItem;
    targetStatus: SportStatus;
  } | null>(null);

  useEffect(() => {
    loadSports();
  }, []);

  async function loadSports() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getAllSportsApi();
      setSports(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh mục môn thể thao.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  // Lọc danh sách môn
  const filteredSports = useMemo(() => {
    return sports.filter((s) => {
      const matchSearch =
        s.sport_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [sports, searchTerm, statusFilter]);

  // Thống kê KPI
  const stats = useMemo(() => {
    const total = sports.length;
    const active = sports.filter((s) => s.status === 'ACTIVE').length;
    const inactive = sports.filter((s) => s.status === 'INACTIVE').length;
    const totalCourts = sports.reduce((sum, s) => sum + (Number(s.court_count) || 0), 0);
    return { total, active, inactive, totalCourts };
  }, [sports]);

  function handleOpenCreateModal() {
    setEditingSport(null);
    setFormData({ sportName: '', description: '' });
    setFormError(null);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(sport: SportItem) {
    setEditingSport(sport);
    setFormData({
      sportName: sport.sport_name,
      description: sport.description || '',
    });
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.sportName.trim()) {
      setFormError('Vui lòng nhập tên môn thể thao.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      if (editingSport) {
        const updated = await updateSportApi(editingSport.sport_id, formData);
        setSports((prev) =>
          prev.map((s) => (s.sport_id === updated.sport_id ? { ...s, ...updated } : s))
        );
        showToast(`Đã cập nhật môn thể thao "${updated.sport_name}".`);
      } else {
        const created = await createSportApi(formData);
        setSports((prev) => [...prev, created]);
        showToast(`Đã thêm mới môn "${created.sport_name}" vào hệ thống.`);
      }
      setIsModalOpen(false);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setFormError(errorObj.response?.data?.message || errorObj.message || 'Thao tác thất bại.');
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleConfirmStatusChange() {
    if (!statusModal) return;
    const { sport, targetStatus } = statusModal;

    try {
      const updated = await updateSportStatusApi(sport.sport_id, targetStatus);
      setSports((prev) =>
        prev.map((s) => (s.sport_id === updated.sport_id ? { ...s, status: updated.status } : s))
      );
      showToast(
        targetStatus === 'ACTIVE'
          ? `Đã kích hoạt lại môn "${sport.sport_name}".`
          : `Đã ngừng hoạt động môn "${sport.sport_name}".`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.';
      alert(msg);
    } finally {
      setStatusModal(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-5 min-h-[calc(100vh-2rem)]">
      {/* Toast thông báo */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 bg-emerald-600 text-white rounded-2xl shadow-2xl animate-fade-in font-medium text-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Thông báo lỗi nếu có */}
      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl">
          {errorMsg}
        </div>
      )}

      {/* 1. Header Card: Tiêu đề & Nút thao tác */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 md:p-7 rounded-3xl border border-slate-200/80 shadow-md">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Quản Lý Loại Môn Thể Thao
            </h1>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              WBS 3.1
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            Danh mục các môn thể thao trong hệ thống (Bóng đá, Cầu lông, Pickleball, Tennis...)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/owner/courts')}
            className="inline-flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-2xl transition-all cursor-pointer"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Về Quản lý cơ sở sân</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all cursor-pointer shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Thêm môn mới</span>
          </button>
        </div>
      </div>

      {/* 2. Thẻ KPI Thống kê */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Tổng loại môn
          </span>
          <div className="text-3xl font-black text-slate-900 mt-2">{stats.total}</div>
          <span className="text-xs text-slate-400 mt-1 block">Trong toàn bộ cơ sở dữ liệu</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Đang hoạt động
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-emerald-600 mt-2">{stats.active}</div>
          <span className="text-xs text-slate-400 mt-1 block">Có thể chọn khi tạo sân mới</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ngừng hoạt động
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          </div>
          <div className="text-3xl font-black text-slate-600 mt-2">{stats.inactive}</div>
          <span className="text-xs text-slate-400 mt-1 block">Tạm khóa cho sân mới</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Số sân đang áp dụng
          </span>
          <div className="text-3xl font-black text-teal-600 mt-2">{stats.totalCourts}</div>
          <span className="text-xs text-slate-400 mt-1 block">Sân con trực thuộc hệ thống</span>
        </div>
      </div>

      {/* 3. Thanh tìm kiếm & Bộ lọc */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên môn, mô tả..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 shrink-0">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Lọc theo trạng thái môn thể thao"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Ngừng hoạt động</option>
          </select>
        </div>
      </div>

      {/* 4. Danh sách các môn thể thao (Dạng Grid Thẻ Card) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
        <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
          Danh mục môn thể thao ({filteredSports.length})
        </h2>

        {loading ? (
          <div className="py-12 text-center text-slate-400">Đang tải danh mục môn thể thao...</div>
        ) : filteredSports.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-300 rounded-2xl text-slate-500">
            Không tìm thấy môn thể thao nào.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSports.map((sport) => {
              const isActive = sport.status === 'ACTIVE';

              return (
                <div
                  key={sport.sport_id}
                  className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">{sport.sport_name}</h3>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-200 text-slate-600 border-slate-300'
                            }`}
                          >
                            {isActive ? 'Đang mở' : 'Khóa'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-0.5 block">
                          ID: #{sport.sport_id}
                        </span>
                      </div>

                      <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-emerald-700 shadow-sm shrink-0">
                        {sport.court_count || 0} sân áp dụng
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-3 leading-relaxed min-h-[36px]">
                      {sport.description || 'Chưa có mô tả chi tiết cho môn này.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(sport)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Chỉnh sửa
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setStatusModal({
                          sport,
                          targetStatus: isActive ? 'INACTIVE' : 'ACTIVE',
                        })
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        isActive
                          ? 'text-amber-700 hover:bg-amber-100'
                          : 'text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== MODAL THÊM / SỬA MÔN THỂ THAO ==================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">
                {editingSport ? 'Chỉnh Sửa Môn Thể Thao' : 'Thêm Môn Thể Thao Mới'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Tên môn thể thao <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.sportName}
                  onChange={(e) => setFormData({ ...formData, sportName: e.target.value })}
                  placeholder="Ví dụ: Bóng chuyền, Futsal, Bơi lội..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Mô tả / Đặc điểm quy chuẩn
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Mô tả kích thước sân tiêu chuẩn, loại thảm/mặt sân hoặc hướng dẫn..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                />
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Đang lưu...' : editingSport ? 'Cập nhật' : 'Thêm môn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL XÁC NHẬN ĐỔI TRẠNG THÁI ==================== */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-7 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              {statusModal.targetStatus === 'ACTIVE'
                ? 'Xác nhận kích hoạt môn thể thao'
                : 'Xác nhận ngừng hoạt động môn thể thao'}
            </h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Bạn có chắc chắn muốn{' '}
              <strong className="text-slate-800">
                {statusModal.targetStatus === 'ACTIVE' ? 'kích hoạt lại' : 'ngừng hoạt động'}
              </strong>{' '}
              môn thể thao <strong className="text-emerald-700">"{statusModal.sport.sport_name}"</strong>?
              {statusModal.targetStatus === 'INACTIVE' && (
                <span className="block mt-2 text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  Lưu ý nghiệp vụ: Dữ liệu môn thể thao và các sân đã tham chiếu môn này vẫn được bảo toàn trong database, nhưng môn này sẽ không được phép chọn khi tạo thêm cấu hình sân mới.
                </span>
              )}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStatusModal(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmStatusChange}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 text-white text-sm font-semibold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

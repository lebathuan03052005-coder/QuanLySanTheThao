import { useState, useEffect, useMemo } from 'react';
import {
  getOwnerSportsApi,
  createSportApi,
  updateSportApi,
  updateSportStatusApi,
  type SportItem,
  type SportStatus,
} from './sport.api';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../../shared/stores/authStore';

/**
 * Chuẩn hóa chuỗi tiện ích từ database (hỗ trợ cả mảng JSON ["A", "B"] lẫn chuỗi "A, B")
 */
function parseUtilities(raw?: string | null): string[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).replace(/^[\s"'[\]]+|[\s"'[\]]+$/g, '').trim())
          .filter(Boolean);
      }
    } catch {
      // Fallback
    }
  }

  return trimmed
    .replace(/[\[\]"]/g, '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

/**
 * Nhận diện tông màu trực quan cho từng loại môn thể thao
 */
function getSportTheme(sportName: string) {
  const lower = (sportName || '').toLowerCase();
  if (lower.includes('bóng đá') || lower.includes('futsal')) {
    return {
      code: 'BD',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      iconBox: 'bg-emerald-600 text-white',
      headerBg: 'from-emerald-50/70 via-white to-white',
      accentBorder: 'border-l-4 border-l-emerald-500',
      standardNote: 'Sân 5 / Sân 7 / Sân 11 người',
    };
  }
  if (lower.includes('cầu lông')) {
    return {
      code: 'CL',
      badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      iconBox: 'bg-cyan-600 text-white',
      headerBg: 'from-cyan-50/70 via-white to-white',
      accentBorder: 'border-l-4 border-l-cyan-500',
      standardNote: 'Sân thảm PVC trong nhà tiêu chuẩn',
    };
  }
  if (lower.includes('pickleball')) {
    return {
      code: 'PK',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      iconBox: 'bg-blue-600 text-white',
      headerBg: 'from-blue-50/70 via-white to-white',
      accentBorder: 'border-l-4 border-l-blue-500',
      standardNote: 'Sân mặt Acrylic chuẩn USAPA',
    };
  }
  if (lower.includes('tennis') || lower.includes('quần vợt')) {
    return {
      code: 'TN',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      iconBox: 'bg-indigo-600 text-white',
      headerBg: 'from-indigo-50/70 via-white to-white',
      accentBorder: 'border-l-4 border-l-indigo-500',
      standardNote: 'Sân mặt cứng Hard Court tiêu chuẩn',
    };
  }
  if (lower.includes('bóng rổ')) {
    return {
      code: 'BR',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      iconBox: 'bg-amber-600 text-white',
      headerBg: 'from-amber-50/70 via-white to-white',
      accentBorder: 'border-l-4 border-l-amber-500',
      standardNote: 'Sân 5x5 nguyên sân & 3x3 nửa sân',
    };
  }
  if (lower.includes('bóng chuyền')) {
    return {
      code: 'BC',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      iconBox: 'bg-purple-600 text-white',
      headerBg: 'from-purple-50/70 via-white to-white',
      accentBorder: 'border-l-4 border-l-purple-500',
      standardNote: 'Sân 6x6 tiêu chuẩn trong nhà / ngoài trời',
    };
  }
  return {
    code: 'SP',
    badgeBg: 'bg-teal-50 text-teal-700 border-teal-200',
    iconBox: 'bg-teal-600 text-white',
    headerBg: 'from-teal-50/70 via-white to-white',
    accentBorder: 'border-l-4 border-l-teal-500',
    standardNote: 'Môn thể thao mở rộng trên hệ thống',
  };
}

function getCourtStatusBadge(status: string) {
  const normalized = (status || 'ACTIVE').toUpperCase();
  if (normalized === 'ACTIVE') {
    return {
      label: 'Đang mở đặt sân',
      dotClass: 'bg-emerald-500 animate-pulse',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (normalized === 'MAINTENANCE') {
    return {
      label: 'Đang bảo trì',
      dotClass: 'bg-amber-500',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  return {
    label: 'Tạm đóng',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
  };
}

export default function SportManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [sports, setSports] = useState<SportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Bộ lọc tìm kiếm, trạng thái môn & trạng thái sân con
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [courtStatusFilter, setCourtStatusFilter] = useState<string>('ALL');

  // Phân trang danh sách môn thể thao (mặc định 3 môn / trang -> 6 môn chia đều 2 trang)
  const [currentPage, setCurrentPage] = useState(1);
  const [sportsPerPage, setSportsPerPage] = useState(3);

  // Phân trang danh sách sân con bên trong từng môn (map sport_id -> page)
  const [courtPageMap, setCourtPageMap] = useState<Record<number, number>>({});
  const COURTS_PER_SPORT_PAGE = 2;

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
  }, [user?.id, user?.email]);

  // Reset về trang 1 khi thay đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
    setCourtPageMap({});
  }, [searchTerm, statusFilter, courtStatusFilter, sportsPerPage]);

  async function loadSports() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getOwnerSportsApi();
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

  // Xử lý danh sách môn kèm các sân con thuộc quyền quản lý của Chủ sân hiện tại (đã lọc theo owner_id từ Backend)
  const processedSports = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return sports
      .map((sport) => {
        const myCourts = sport.courts || [];

        const filteredCourts = myCourts.filter((c) => {
          const matchCourtStatus =
            courtStatusFilter === 'ALL' || (c.status || 'ACTIVE').toUpperCase() === courtStatusFilter;
          const matchCourtText =
            !q ||
            sport.sport_name.toLowerCase().includes(q) ||
            (sport.description && sport.description.toLowerCase().includes(q)) ||
            c.court_name.toLowerCase().includes(q) ||
            (c.facility_name && c.facility_name.toLowerCase().includes(q)) ||
            (c.address && c.address.toLowerCase().includes(q));

          return matchCourtStatus && matchCourtText;
        });

        const matchSportSelf =
          !q ||
          sport.sport_name.toLowerCase().includes(q) ||
          (sport.description && sport.description.toLowerCase().includes(q));

        return {
          ...sport,
          filteredCourts,
          matchSportSelf,
        };
      })
      .filter((sport) => {
        const matchStatus = statusFilter === 'ALL' || sport.status === statusFilter;
        if (!matchStatus) return false;

        if (searchTerm.trim()) {
          return sport.matchSportSelf || sport.filteredCourts.length > 0;
        }

        return true;
      });
  }, [sports, searchTerm, statusFilter, courtStatusFilter]);

  // Tính toán phân trang danh sách môn
  const totalPages = Math.max(1, Math.ceil(processedSports.length / sportsPerPage));
  const paginatedSports = useMemo(() => {
    const startIdx = (currentPage - 1) * sportsPerPage;
    return processedSports.slice(startIdx, startIdx + sportsPerPage);
  }, [processedSports, currentPage, sportsPerPage]);

  // Thống kê KPI theo các sân thuộc quyền sở hữu của Chủ sân đang đăng nhập
  const stats = useMemo(() => {
    const total = sports.length;
    const active = sports.filter((s) => s.status === 'ACTIVE').length;
    const inactive = sports.filter((s) => s.status === 'INACTIVE').length;
    const myCourts = sports.flatMap((s) => s.courts || []);
    const totalCourts = myCourts.length;
    const activeCourts = myCourts.filter((c) => (c.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
    const totalFacilities = new Set(myCourts.map((c) => c.facility_id).filter(Boolean)).size;
    return { total, active, inactive, totalCourts, activeCourts, totalFacilities };
  }, [sports]);

  function getSportCourtPage(sportId: number): number {
    return courtPageMap[sportId] || 1;
  }

  function setSportCourtPage(sportId: number, page: number) {
    setCourtPageMap((prev) => ({ ...prev, [sportId]: page }));
  }

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
        await updateSportApi(editingSport.sport_id, formData);
        await loadSports();
        showToast(`Đã cập nhật môn thể thao "${formData.sportName}".`);
      } else {
        const created = await createSportApi(formData);
        await loadSports();
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
      await updateSportStatusApi(sport.sport_id, targetStatus);
      await loadSports();
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
    <div className="flex-1 flex flex-col gap-4 min-h-[calc(100vh-2rem)]">
      {/* Toast thông báo */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl shadow-2xl animate-fade-in font-semibold text-xs">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Thông báo lỗi nếu có */}
      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl">
          {errorMsg}
        </div>
      )}

      {/* 1. THANH ĐIỀU KHIỂN TRUNG TÂM GỌN GÀNG (Gộp Header + KPI Strip) */}
      <div className="shrink-0 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                Danh Mục Loại Môn Thể Thao & Chi Tiết Sân Áp Dụng
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold border border-blue-200">
                WBS 3.1
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi chi tiết từng môn thể thao có những sân con nào, thuộc cơ sở nào và trạng thái vận hành thực tế
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/owner/courts')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Quản lý Cơ sở & Sân con</span>
            </button>

            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Thêm môn thể thao mới</span>
            </button>
          </div>
        </div>

        {/* 4 Thẻ KPI Gọn Gàng */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Tổng danh mục môn
              </span>
              <span className="text-[11px] text-slate-400">
                {stats.active} mở • {stats.inactive} khóa
              </span>
            </div>
            <span className="text-2xl font-black text-slate-900">{stats.total}</span>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-50/50 border border-emerald-200/70">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Môn đang hoạt động
              </span>
              <span className="text-[11px] text-emerald-600/80">Cho phép tạo sân mới</span>
            </div>
            <span className="text-2xl font-black text-emerald-600">{stats.active}</span>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-blue-50/50 border border-blue-200/70">
            <div>
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                Cụm cơ sở triển khai
              </span>
              <span className="text-[11px] text-blue-600/80">Địa điểm đang vận hành</span>
            </div>
            <span className="text-2xl font-black text-blue-600">{stats.totalFacilities}</span>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-teal-50/50 border border-teal-200/70">
            <div>
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider block">
                Tổng sân áp dụng
              </span>
              <span className="text-[11px] text-teal-600/80">{stats.activeCourts} sân đang mở</span>
            </div>
            <span className="text-2xl font-black text-teal-600">{stats.totalCourts}</span>
          </div>
        </div>
      </div>

      {/* 2. Thanh tìm kiếm, Bộ lọc chi tiết & Tùy chọn hiển thị */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="relative flex-1 max-w-xl">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên môn, tên sân con (Sân 1, Sân 2...), tên cơ sở hoặc địa chỉ..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Lọc theo trạng thái môn thể thao"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">Môn: Tất cả trạng thái</option>
            <option value="ACTIVE">Môn: Đang hoạt động</option>
            <option value="INACTIVE">Môn: Ngừng hoạt động</option>
          </select>

          <select
            value={courtStatusFilter}
            onChange={(e) => setCourtStatusFilter(e.target.value)}
            aria-label="Lọc theo trạng thái sân con"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">Sân con: Tất cả trạng thái</option>
            <option value="ACTIVE">Sân con: Đang mở</option>
            <option value="INACTIVE">Sân con: Đang đóng</option>
          </select>

          <select
            value={sportsPerPage}
            onChange={(e) => setSportsPerPage(Number(e.target.value))}
            aria-label="Số môn hiển thị trên mỗi trang"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value={2}>2 môn / trang</option>
            <option value={3}>3 môn / trang</option>
            <option value={6}>6 môn / trang</option>
          </select>
        </div>
      </div>

      {/* 3. Danh sách chi tiết từng môn thể thao và bảng các sân con trực thuộc */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
            Danh mục môn thể thao & Sân trực thuộc ({processedSports.length} môn • {stats.totalCourts} sân của bạn)
          </h2>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 mr-1">
                Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
              </span>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                ‹ Trước
              </button>
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    page === currentPage
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Sau ›
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-12 bg-white rounded-3xl border border-slate-200/80 text-center text-slate-400 text-sm">
            Đang tải danh mục môn thể thao và chi tiết các sân trực thuộc...
          </div>
        ) : paginatedSports.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-slate-500 text-xs">
            Không tìm thấy môn thể thao hoặc sân con nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {paginatedSports.map((sport) => {
              const isActive = sport.status === 'ACTIVE';
              const theme = getSportTheme(sport.sport_name);
              const filteredCourts = sport.filteredCourts || [];
              const activeCourtsInSport = filteredCourts.filter(
                (c) => (c.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
              ).length;
              const inactiveCourtsInSport = filteredCourts.length - activeCourtsInSport;
              const uniqueFacilitiesCount = new Set(
                filteredCourts.map((c) => c.facility_id).filter(Boolean)
              ).size;

              const cPage = getSportCourtPage(sport.sport_id);
              const totalCourtPages = Math.max(
                1,
                Math.ceil(filteredCourts.length / COURTS_PER_SPORT_PAGE)
              );
              const safeCourtPage = Math.min(cPage, totalCourtPages);
              const paginatedCourts = filteredCourts.slice(
                (safeCourtPage - 1) * COURTS_PER_SPORT_PAGE,
                safeCourtPage * COURTS_PER_SPORT_PAGE
              );

              return (
                <div
                  key={sport.sport_id}
                  className={`bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden transition-all ${theme.accentBorder}`}
                >
                  {/* Phần đầu của Môn thể thao */}
                  <div
                    className={`p-4 md:p-5 bg-gradient-to-r ${theme.headerBg} border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-2xl ${theme.iconBox} shadow-xs flex items-center justify-center text-sm font-black tracking-tight shrink-0`}
                      >
                        {theme.code}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-extrabold text-slate-900">
                            {sport.sport_name}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                          >
                            {isActive ? 'Đang mở hoạt động' : 'Đã ngừng hoạt động'}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${theme.badgeBg}`}
                          >
                            {theme.standardNote}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            Mã môn #{sport.sport_id}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-3xl">
                          {sport.description || 'Chưa có mô tả chi tiết cho loại môn thể thao này.'}
                        </p>
                      </div>
                    </div>

                    {/* Khối thống kê nhanh của môn & Nút hành động */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <span className="text-slate-500">Tổng: </span>
                        <strong className="text-slate-900">{filteredCourts.length} sân</strong>
                      </div>
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                        <span className="text-emerald-700">Đang mở: </span>
                        <strong className="text-emerald-800">{activeCourtsInSport}</strong>
                      </div>
                      {inactiveCourtsInSport > 0 && (
                        <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                          <span className="text-amber-700">Đóng: </span>
                          <strong className="text-amber-800">{inactiveCourtsInSport}</strong>
                        </div>
                      )}
                      <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                        <span className="text-blue-700">Cơ sở: </span>
                        <strong className="text-blue-800">{uniqueFacilitiesCount} cụm</strong>
                      </div>

                      <div className="flex items-center gap-1.5 ml-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(sport)}
                          className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                        >
                          Sửa môn
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusModal({
                              sport,
                              targetStatus: isActive ? 'INACTIVE' : 'ACTIVE',
                            })
                          }
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                            isActive
                              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                          }`}
                        >
                          {isActive ? 'Khóa môn' : 'Mở lại'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Phần thân: Bảng chi tiết các sân con thuộc môn thể thao này */}
                  <div className="p-4 md:p-5">
                    {filteredCourts.length === 0 ? (
                      <div className="py-6 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-500 text-xs">
                        Hiện chưa có sân con nào thuộc môn <strong>{sport.sport_name}</strong> trong phạm vi lọc này.
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-3 px-4">Tên sân con (Sub-court)</th>
                                <th className="py-3 px-4">Thuộc Cơ sở sân & Địa chỉ</th>
                                <th className="py-3 px-4">Chủ sân quản lý</th>
                                <th className="py-3 px-4">Sức chứa & Tiện ích</th>
                                <th className="py-3 px-4 text-right">Trạng thái hoạt động</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                              {paginatedCourts.map((court) => {
                                const statusBadge = getCourtStatusBadge(court.status);
                                const cleanUtils = parseUtilities(court.utilities);

                                return (
                                  <tr
                                    key={court.court_id}
                                    className="hover:bg-slate-50/80 transition-colors"
                                  >
                                    {/* Cột 1: Tên sân con */}
                                    <td className="py-3 px-4 align-top">
                                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                        <span>{court.court_name}</span>
                                        <span className="text-[11px] font-mono text-slate-400 font-normal">
                                          #{court.court_id}
                                        </span>
                                      </div>
                                      {court.description && (
                                        <p className="text-slate-500 mt-0.5 line-clamp-1">
                                          {court.description}
                                        </p>
                                      )}
                                    </td>

                                    {/* Cột 2: Cơ sở sân & Địa chỉ */}
                                    <td className="py-3 px-4 align-top">
                                      <div className="font-bold text-teal-800">
                                        {court.facility_name}
                                      </div>
                                      <div className="text-slate-500 mt-0.5 line-clamp-1">
                                        {court.address}
                                      </div>
                                    </td>

                                    {/* Cột 3: Chủ sân quản lý */}
                                    <td className="py-3 px-4 align-top">
                                      <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                        <span>{court.owner_name}</span>
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                          Của bạn
                                        </span>
                                      </div>
                                    </td>

                                    {/* Cột 4: Sức chứa & Tiện ích */}
                                    <td className="py-3 px-4 align-top">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                                        Tối đa {court.capacity || 10} người
                                      </span>
                                      {cleanUtils.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          {cleanUtils.slice(0, 3).map((u, idx) => (
                                            <span
                                              key={idx}
                                              className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-600"
                                            >
                                              ✓ {u}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </td>

                                    {/* Cột 5: Trạng thái hoạt động */}
                                    <td className="py-3 px-4 align-top text-right">
                                      <span
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusBadge.badgeClass}`}
                                      >
                                        <span
                                          className={`w-2 h-2 rounded-full ${statusBadge.dotClass}`}
                                        />
                                        <span>{statusBadge.label}</span>
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Phân trang con bên trong từng môn */}
                        {totalCourtPages > 1 && (
                          <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                            <span className="text-xs text-slate-500">
                              Hiển thị sân{' '}
                              <strong>{(safeCourtPage - 1) * COURTS_PER_SPORT_PAGE + 1}</strong> -{' '}
                              <strong>
                                {Math.min(
                                  safeCourtPage * COURTS_PER_SPORT_PAGE,
                                  filteredCourts.length
                                )}
                              </strong>{' '}
                              / <strong>{filteredCourts.length}</strong> sân
                            </span>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={safeCourtPage <= 1}
                                onClick={() => setSportCourtPage(sport.sport_id, safeCourtPage - 1)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
                              >
                                ‹ Trước
                              </button>
                              {Array.from({ length: totalCourtPages }, (_, i) => i + 1).map(
                                (pNum) => (
                                  <button
                                    key={pNum}
                                    type="button"
                                    onClick={() => setSportCourtPage(sport.sport_id, pNum)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                      pNum === safeCourtPage
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                    }`}
                                  >
                                    {pNum}
                                  </button>
                                )
                              )}
                              <button
                                type="button"
                                disabled={safeCourtPage >= totalCourtPages}
                                onClick={() => setSportCourtPage(sport.sport_id, safeCourtPage + 1)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 disabled:opacity-40 cursor-pointer"
                              >
                                Sau ›
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Thanh phân trang chính cho danh sách các môn thể thao */}
        {totalPages > 1 && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Đang xem trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong> (Tổng{' '}
              <strong>{processedSports.length}</strong> loại môn thể thao)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                ← Trang trước
              </button>

              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    page === currentPage
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25'
                      : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
              >
                Trang sau →
              </button>
            </div>
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

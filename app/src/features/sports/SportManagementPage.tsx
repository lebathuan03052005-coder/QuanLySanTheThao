import { useState, useEffect, useMemo } from 'react';
import {
  getAllSportsApi,
  createSportApi,
  updateSportApi,
  updateSportStatusApi,
  type SportItem,
  type SportStatus,
  type SportCourtDetail,
} from './sport.api';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../../shared/stores/authStore';

/**
 * Nhận diện biểu tượng và tông màu trực quan cho từng loại môn thể thao
 */
function getSportTheme(sportName: string) {
  const lower = (sportName || '').toLowerCase();
  if (lower.includes('bóng đá') || lower.includes('futsal')) {
    return {
      icon: '⚽',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      headerBg: 'from-emerald-500/10 via-teal-500/5 to-transparent',
      accentBorder: 'border-l-4 border-l-emerald-500',
      standardNote: 'Sân 5 / Sân 7 / Sân 11 người',
    };
  }
  if (lower.includes('cầu lông')) {
    return {
      icon: '🏸',
      badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      headerBg: 'from-cyan-500/10 via-sky-500/5 to-transparent',
      accentBorder: 'border-l-4 border-l-cyan-500',
      standardNote: 'Sân thảm PVC trong nhà tiêu chuẩn',
    };
  }
  if (lower.includes('pickleball')) {
    return {
      icon: '🏓',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      headerBg: 'from-blue-500/10 via-indigo-500/5 to-transparent',
      accentBorder: 'border-l-4 border-l-blue-500',
      standardNote: 'Sân mặt Acrylic chuẩn USAPA',
    };
  }
  if (lower.includes('tennis') || lower.includes('quần vợt')) {
    return {
      icon: '🎾',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      headerBg: 'from-indigo-500/10 via-violet-500/5 to-transparent',
      accentBorder: 'border-l-4 border-l-indigo-500',
      standardNote: 'Sân mặt cứng Hard Court tiêu chuẩn',
    };
  }
  if (lower.includes('bóng rổ')) {
    return {
      icon: '🏀',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      headerBg: 'from-amber-500/10 via-orange-500/5 to-transparent',
      accentBorder: 'border-l-4 border-l-amber-500',
      standardNote: 'Sân 5x5 nguyên sân & 3x3 nửa sân',
    };
  }
  if (lower.includes('bóng chuyền')) {
    return {
      icon: '🏐',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      headerBg: 'from-purple-500/10 via-fuchsia-500/5 to-transparent',
      accentBorder: 'border-l-4 border-l-purple-500',
      standardNote: 'Sân 6x6 tiêu chuẩn trong nhà / ngoài trời',
    };
  }
  return {
    icon: '🏟️',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    headerBg: 'from-slate-500/10 via-slate-500/5 to-transparent',
    accentBorder: 'border-l-4 border-l-teal-500',
    standardNote: 'Môn thể thao mở rộng trên hệ thống',
  };
}

function getCourtStatusBadge(status: string) {
  const normalized = (status || 'ACTIVE').toUpperCase();
  if (normalized === 'ACTIVE') {
    return {
      label: 'Đang hoạt động (Nhận đặt sân)',
      shortLabel: 'Đang hoạt động',
      dotClass: 'bg-emerald-500 animate-pulse',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }
  if (normalized === 'MAINTENANCE') {
    return {
      label: 'Đang bảo trì kỹ thuật',
      shortLabel: 'Bảo trì',
      dotClass: 'bg-amber-500',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };
  }
  return {
    label: 'Ngừng hoạt động (Tạm đóng)',
    shortLabel: 'Ngừng hoạt động',
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

  // Bộ lọc tìm kiếm, trạng thái môn, phạm vi sân & trạng thái sân con
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'MINE'>('ALL');
  const [courtStatusFilter, setCourtStatusFilter] = useState<string>('ALL');

  // Phân trang danh sách môn thể thao
  const [currentPage, setCurrentPage] = useState(1);
  const [sportsPerPage, setSportsPerPage] = useState(4);

  // Phân trang danh sách sân con bên trong từng môn (map sport_id -> page)
  const [courtPageMap, setCourtPageMap] = useState<Record<number, number>>({});
  const COURTS_PER_SPORT_PAGE = 3;

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

  // Reset về trang 1 khi thay đổi bộ lọc
  useEffect(() => {
    setCurrentPage(1);
    setCourtPageMap({});
  }, [searchTerm, statusFilter, scopeFilter, courtStatusFilter, sportsPerPage]);

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

  // Kiểm tra một sân con có thuộc quyền quản lý của Owner đang đăng nhập hay không
  function isMyCourt(court: SportCourtDetail): boolean {
    if (!user) return false;
    if (user.email && court.owner_email && user.email.toLowerCase() === court.owner_email.toLowerCase()) {
      return true;
    }
    return Number(court.owner_id) === Number(user.id);
  }

  // Xử lý danh sách môn kèm các sân con đã lọc chi tiết
  const processedSports = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return sports
      .map((sport) => {
        const rawCourts = sport.courts || [];
        const filteredCourts = rawCourts.filter((c) => {
          const matchScope = scopeFilter === 'ALL' || isMyCourt(c);
          const matchCourtStatus =
            courtStatusFilter === 'ALL' || (c.status || 'ACTIVE').toUpperCase() === courtStatusFilter;
          const matchCourtText =
            !q ||
            sport.sport_name.toLowerCase().includes(q) ||
            (sport.description && sport.description.toLowerCase().includes(q)) ||
            c.court_name.toLowerCase().includes(q) ||
            (c.facility_name && c.facility_name.toLowerCase().includes(q)) ||
            (c.address && c.address.toLowerCase().includes(q)) ||
            (c.owner_name && c.owner_name.toLowerCase().includes(q));

          return matchScope && matchCourtStatus && matchCourtText;
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

        // Nếu đang lọc chỉ sân của tôi, vẫn hiện môn nếu có sân của tôi hoặc nếu môn mới tạo chưa có sân
        if (scopeFilter === 'MINE' && sport.filteredCourts.length === 0 && (sport.courts?.length || 0) > 0) {
          return false;
        }

        // Nếu có từ khóa tìm kiếm, hiển thị môn nếu tên môn khớp HOẶC có sân con/cơ sở khớp từ khóa
        if (searchTerm.trim()) {
          return sport.matchSportSelf || sport.filteredCourts.length > 0;
        }

        return true;
      });
  }, [sports, searchTerm, statusFilter, scopeFilter, courtStatusFilter, user]);

  // Tính toán phân trang danh sách môn
  const totalPages = Math.max(1, Math.ceil(processedSports.length / sportsPerPage));
  const paginatedSports = useMemo(() => {
    const startIdx = (currentPage - 1) * sportsPerPage;
    return processedSports.slice(startIdx, startIdx + sportsPerPage);
  }, [processedSports, currentPage, sportsPerPage]);

  // Thống kê KPI tổng quan
  const stats = useMemo(() => {
    const total = sports.length;
    const active = sports.filter((s) => s.status === 'ACTIVE').length;
    const inactive = sports.filter((s) => s.status === 'INACTIVE').length;
    const allCourts = sports.flatMap((s) => s.courts || []);
    const totalCourts = allCourts.length;
    const activeCourts = allCourts.filter((c) => (c.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
    const totalFacilities = new Set(allCourts.map((c) => c.facility_id).filter(Boolean)).size;
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Quản Lý Loại Môn Thể Thao & Chi Tiết Sân Áp Dụng
            </h1>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              WBS 3.1 (S2-03)
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            Quản lý danh mục môn thể thao và theo dõi chi tiết từng sân con thuộc cơ sở nào, chủ sân nào quản lý và trạng thái vận hành thực tế
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
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
            <span>Thêm môn thể thao mới</span>
          </button>
        </div>
      </div>

      {/* 2. Thẻ KPI Thống kê chi tiết */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Tổng danh mục môn
          </span>
          <div className="text-3xl font-black text-slate-900 mt-2">{stats.total}</div>
          <span className="text-xs text-slate-400 mt-1 block">
            {stats.active} môn đang mở • {stats.inactive} môn khóa
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Môn đang hoạt động
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-emerald-600 mt-2">{stats.active}</div>
          <span className="text-xs text-slate-400 mt-1 block">Cho phép tạo sân con & đặt lịch</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Cụm cơ sở triển khai
          </span>
          <div className="text-3xl font-black text-blue-600 mt-2">{stats.totalFacilities}</div>
          <span className="text-xs text-slate-400 mt-1 block">Cơ sở sân đang vận hành các môn</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Tổng sân con áp dụng
          </span>
          <div className="text-3xl font-black text-teal-600 mt-2">
            {stats.activeCourts}{' '}
            <span className="text-base font-bold text-slate-400">/ {stats.totalCourts} sân</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Sân đang mở hoạt động trên hệ thống</span>
        </div>
      </div>

      {/* 3. Thanh tìm kiếm, Bộ lọc chi tiết & Tùy chọn hiển thị */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
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
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Lọc phạm vi sân */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setScopeFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                scopeFilter === 'ALL'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toàn hệ thống
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('MINE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                scopeFilter === 'MINE'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sân thuộc cơ sở của tôi
            </button>
          </div>

          {/* Lọc trạng thái môn */}
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

          {/* Lọc trạng thái sân con */}
          <select
            value={courtStatusFilter}
            onChange={(e) => setCourtStatusFilter(e.target.value)}
            aria-label="Lọc theo trạng thái sân con"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">Sân con: Tất cả trạng thái</option>
            <option value="ACTIVE">Sân con: Đang mở hoạt động</option>
            <option value="INACTIVE">Sân con: Đang tạm đóng</option>
          </select>

          {/* Số môn mỗi trang */}
          <select
            value={sportsPerPage}
            onChange={(e) => setSportsPerPage(Number(e.target.value))}
            aria-label="Số môn hiển thị trên mỗi trang"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value={2}>Hiển thị: 2 môn / trang</option>
            <option value={4}>Hiển thị: 4 môn / trang</option>
            <option value={6}>Hiển thị: 6 môn / trang</option>
          </select>
        </div>
      </div>

      {/* 4. Danh sách chi tiết từng môn thể thao và bảng các sân con trực thuộc */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Danh mục môn thể thao & Sân trực thuộc ({processedSports.length} môn)
          </h2>
          <span className="text-xs text-slate-500">
            Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong> (Hiển thị{' '}
            {paginatedSports.length} môn trên trang này)
          </span>
        </div>

        {loading ? (
          <div className="p-12 bg-white rounded-3xl border border-slate-200/80 text-center text-slate-400">
            Đang tải danh mục môn thể thao và chi tiết các sân trực thuộc...
          </div>
        ) : paginatedSports.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-slate-500">
            Không tìm thấy môn thể thao hoặc sân con nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
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

              // Phân trang con cho danh sách sân của môn này
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
                  className={`bg-white rounded-3xl border border-slate-200/90 shadow-md overflow-hidden transition-all ${theme.accentBorder}`}
                >
                  {/* Phần đầu của Môn thể thao */}
                  <div
                    className={`p-5 md:p-6 bg-gradient-to-r ${theme.headerBg} border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-3xl shrink-0">
                        {theme.icon}
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-xl font-extrabold text-slate-900">
                            {sport.sport_name}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-200 text-slate-700 border-slate-300'
                            }`}
                          >
                            {isActive ? 'Đang mở hoạt động' : 'Đã ngừng hoạt động'}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${theme.badgeBg}`}
                          >
                            {theme.standardNote}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            Mã môn: #{sport.sport_id}
                          </span>
                        </div>

                        <p className="text-xs md:text-sm text-slate-600 mt-1.5 leading-relaxed max-w-3xl">
                          {sport.description || 'Chưa có mô tả chi tiết cho loại môn thể thao này.'}
                        </p>
                      </div>
                    </div>

                    {/* Khối thống kê nhanh của môn & Nút hành động */}
                    <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs text-xs">
                          <span className="text-slate-500">Tổng sân: </span>
                          <strong className="text-slate-900">{filteredCourts.length} sân</strong>
                        </div>
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                          <span className="text-emerald-700">Đang hoạt động: </span>
                          <strong className="text-emerald-800">{activeCourtsInSport}</strong>
                        </div>
                        {inactiveCourtsInSport > 0 && (
                          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                            <span className="text-amber-700">Tạm đóng/Bảo trì: </span>
                            <strong className="text-amber-800">{inactiveCourtsInSport}</strong>
                          </div>
                        )}
                        <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                          <span className="text-blue-700">Cơ sở: </span>
                          <strong className="text-blue-800">{uniqueFacilitiesCount} cụm sân</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(sport)}
                          className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                        >
                          Chỉnh sửa môn
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusModal({
                              sport,
                              targetStatus: isActive ? 'INACTIVE' : 'ACTIVE',
                            })
                          }
                          className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                            isActive
                              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                          }`}
                        >
                          {isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Phần thân: Bảng chi tiết các sân con thuộc môn thể thao này */}
                  <div className="p-5 md:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                        <span>Danh sách chi tiết các sân thuộc môn {sport.sport_name}</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {filteredCourts.length} sân
                        </span>
                      </h4>

                      <button
                        type="button"
                        onClick={() => navigate('/owner/courts')}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>+ Quản lý / Thêm sân con tại mục Cơ sở sân</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {filteredCourts.length === 0 ? (
                      <div className="py-8 px-4 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-slate-500 text-xs">
                        Hiện chưa có sân con nào thuộc môn <strong>{sport.sport_name}</strong> trong phạm vi lọc này. Bạn có thể vào mục <strong>Quản lý cơ sở sân</strong> để thêm sân con mới cho môn này.
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
                                const mine = isMyCourt(court);

                                return (
                                  <tr
                                    key={court.court_id}
                                    className="hover:bg-slate-50/80 transition-colors"
                                  >
                                    {/* Cột 1: Tên sân con */}
                                    <td className="py-3.5 px-4 align-top">
                                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                        <span>{court.court_name}</span>
                                        <span className="text-[11px] font-mono text-slate-400 font-normal">
                                          #{court.court_id}
                                        </span>
                                      </div>
                                      {court.description && (
                                        <p className="text-slate-500 mt-1 line-clamp-1">
                                          {court.description}
                                        </p>
                                      )}
                                    </td>

                                    {/* Cột 2: Cơ sở sân & Địa chỉ */}
                                    <td className="py-3.5 px-4 align-top">
                                      <div className="font-bold text-teal-800 flex items-center gap-1.5">
                                        <svg
                                          className="w-3.5 h-3.5 text-teal-600 shrink-0"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                                          />
                                        </svg>
                                        <span>{court.facility_name}</span>
                                      </div>
                                      <div className="text-slate-500 mt-1 flex items-center gap-1">
                                        <svg
                                          className="w-3.5 h-3.5 text-slate-400 shrink-0"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                          />
                                        </svg>
                                        <span className="line-clamp-1">{court.address}</span>
                                      </div>
                                    </td>

                                    {/* Cột 3: Chủ sân quản lý */}
                                    <td className="py-3.5 px-4 align-top">
                                      <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                        <span>{court.owner_name}</span>
                                        {mine && (
                                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                            Cơ sở của bạn
                                          </span>
                                        )}
                                      </div>
                                      {court.owner_email && (
                                        <span className="text-[11px] text-slate-400 block mt-0.5">
                                          {court.owner_email}
                                        </span>
                                      )}
                                    </td>

                                    {/* Cột 4: Sức chứa & Tiện ích */}
                                    <td className="py-3.5 px-4 align-top">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                                        👥 Tối đa {court.capacity || 10} người
                                      </span>
                                      {court.utilities && (
                                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                                          Tiện ích: {court.utilities}
                                        </p>
                                      )}
                                    </td>

                                    {/* Cột 5: Trạng thái hoạt động */}
                                    <td className="py-3.5 px-4 align-top text-right">
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

                        {/* Phân trang con bên trong từng môn nếu môn đó có nhiều hơn COURTS_PER_SPORT_PAGE sân */}
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
                              trên tổng số <strong>{filteredCourts.length}</strong> sân thuộc môn{' '}
                              {sport.sport_name}
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
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
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

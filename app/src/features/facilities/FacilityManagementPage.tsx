import { useState, useEffect, useMemo } from 'react';
import {
  getOwnerFacilitiesApi,
  createFacilityApi,
  updateFacilityApi,
  updateFacilityStatusApi,
  getCourtsByFacilityApi,
  createCourtInFacilityApi,
  updateCourtInFacilityApi,
  updateCourtStatusApi,
  type FacilityItem,
  type CourtItem,
} from './facility.api';
import { getOwnerSportsApi, type SportItem } from '../sports/sport.api';
import { useAuthStore } from '../../shared/stores/authStore';
import { useNavigate } from 'react-router';

/**
 * Chuẩn hóa chuỗi tiện ích từ database (hỗ trợ cả mảng JSON ["A", "B"] lẫn chuỗi "A, B")
 * để không bao giờ hiển thị ký tự [" hoặc "] ra giao diện.
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
      // Fallback xử lý chuỗi nếu JSON không hoàn chỉnh
    }
  }

  return trimmed
    .replace(/[\[\]"]/g, '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
}

/**
 * Nhận diện màu sắc và nhãn trực quan theo môn thể thao (sử dụng SVG sắc nét thay vì emoji hệ thống)
 */
function getSportVisual(sportName?: string) {
  const lower = (sportName || '').toLowerCase();
  if (lower.includes('bóng đá') || lower.includes('futsal')) {
    return {
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotColor: 'bg-emerald-500',
      cardAccent: 'border-t-4 border-t-emerald-500',
    };
  }
  if (lower.includes('cầu lông')) {
    return {
      badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      dotColor: 'bg-cyan-500',
      cardAccent: 'border-t-4 border-t-cyan-500',
    };
  }
  if (lower.includes('pickleball')) {
    return {
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      dotColor: 'bg-blue-500',
      cardAccent: 'border-t-4 border-t-blue-500',
    };
  }
  if (lower.includes('tennis') || lower.includes('quần vợt')) {
    return {
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      dotColor: 'bg-indigo-500',
      cardAccent: 'border-t-4 border-t-indigo-500',
    };
  }
  if (lower.includes('bóng rổ')) {
    return {
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      dotColor: 'bg-amber-500',
      cardAccent: 'border-t-4 border-t-amber-500',
    };
  }
  if (lower.includes('bóng chuyền')) {
    return {
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      dotColor: 'bg-purple-500',
      cardAccent: 'border-t-4 border-t-purple-500',
    };
  }
  return {
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
    dotColor: 'bg-teal-500',
    cardAccent: 'border-t-4 border-t-teal-500',
  };
}

export default function FacilityManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Danh sách cơ sở và môn thể thao
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [sports, setSports] = useState<SportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Bộ lọc tìm kiếm & trạng thái Cơ sở (Cột trái)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [facPage, setFacPage] = useState(1);
  const FACILITIES_PER_PAGE = 4;

  // Cơ sở đang được chọn & Bộ lọc danh sách sân con (Cột phải)
  // isAllFacilitiesMode = true: Xem toàn bộ ~18 sân con của tất cả cơ sở thuộc Owner
  const [isAllFacilitiesMode, setIsAllFacilitiesMode] = useState<boolean>(true);
  const [selectedFacility, setSelectedFacility] = useState<FacilityItem | null>(null);
  const [courts, setCourts] = useState<(CourtItem & { facility_name?: string })[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [courtSearch, setCourtSearch] = useState('');
  const [courtSportFilter, setCourtSportFilter] = useState<string>('ALL');
  const [courtStatusFilter, setCourtStatusFilter] = useState<string>('ALL');
  const [courtPage, setCourtPage] = useState(1);
  const [courtsPerPage, setCourtsPerPage] = useState(6);

  // Modal Cơ sở (Thêm / Sửa)
  const [isFacModalOpen, setIsFacModalOpen] = useState(false);
  const [editingFac, setEditingFac] = useState<FacilityItem | null>(null);
  const [facForm, setFacForm] = useState({
    name: '',
    address: '',
    phone: '',
    description: '',
  });
  const [facSubmitting, setFacSubmitting] = useState(false);
  const [facError, setFacError] = useState<string | null>(null);

  // Modal Sân con (Thêm / Sửa)
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [targetFacilityForCourt, setTargetFacilityForCourt] = useState<FacilityItem | null>(null);
  const [editingCourt, setEditingCourt] = useState<CourtItem | null>(null);
  const [courtForm, setCourtForm] = useState({
    courtName: '',
    sportId: 0,
    capacity: 10,
    description: '',
    utilities: '',
  });
  const [courtSubmitting, setCourtSubmitting] = useState(false);
  const [courtError, setCourtError] = useState<string | null>(null);

  // Modal Xác nhận đổi trạng thái (Cơ sở hoặc Sân con)
  const [statusConfirmModal, setStatusConfirmModal] = useState<{
    type: 'FACILITY' | 'COURT';
    id: number;
    name: string;
    targetStatus: 'ACTIVE' | 'INACTIVE';
  } | null>(null);

  useEffect(() => {
    loadInitialData();
  }, [user?.email, user?.id]);

  useEffect(() => {
    setFacPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    setCourtPage(1);
  }, [
    courtSearch,
    courtSportFilter,
    courtStatusFilter,
    selectedFacility?.facility_id,
    isAllFacilitiesMode,
    courtsPerPage,
  ]);

  async function loadInitialData(preferredFacId?: number) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [facData, sportData] = await Promise.all([
        getOwnerFacilitiesApi(),
        getOwnerSportsApi({ status: 'ACTIVE' }),
      ]);
      setFacilities(facData);
      setSports(sportData);

      if (preferredFacId) {
        const targetFac = facData.find((f) => f.facility_id === preferredFacId);
        if (targetFac && !isAllFacilitiesMode) {
          await selectFacility(targetFac);
          return;
        }
      }

      if (facData.length > 0) {
        await selectAllFacilities(facData);
      } else {
        setIsAllFacilitiesMode(false);
        setSelectedFacility(null);
        setCourts([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải dữ liệu cơ sở sân.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  // Tải toàn bộ danh sách sân con của tất cả cơ sở thuộc quyền sở hữu của Owner
  async function selectAllFacilities(facList?: FacilityItem[]) {
    const list = facList || facilities;
    setIsAllFacilitiesMode(true);
    setSelectedFacility(list[0] || null);
    setLoadingCourts(true);
    try {
      const allResults = await Promise.all(
        list.map(async (f) => {
          const items = await getCourtsByFacilityApi(f.facility_id);
          return items.map((c) => ({ ...c, facility_name: f.name }));
        })
      );
      setCourts(allResults.flat());
    } catch {
      setCourts([]);
    } finally {
      setLoadingCourts(false);
    }
  }

  // Tải danh sách sân con khi chọn 1 cơ sở cụ thể
  async function selectFacility(fac: FacilityItem) {
    setIsAllFacilitiesMode(false);
    setSelectedFacility(fac);
    setLoadingCourts(true);
    try {
      const courtData = await getCourtsByFacilityApi(fac.facility_id);
      setCourts(courtData.map((c) => ({ ...c, facility_name: fac.name })));
    } catch {
      setCourts([]);
    } finally {
      setLoadingCourts(false);
    }
  }

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  }

  // Lọc cơ sở theo từ khóa và trạng thái
  const filteredFacilities = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return facilities.filter((f) => {
      const matchSearch =
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.address.toLowerCase().includes(q) ||
        (f.phone && f.phone.includes(q)) ||
        (f.courts_preview &&
          f.courts_preview.some(
            (c) =>
              c.court_name.toLowerCase().includes(q) ||
              (c.sport_name && c.sport_name.toLowerCase().includes(q))
          ));
      const matchStatus = statusFilter === 'ALL' || f.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [facilities, searchTerm, statusFilter]);

  const totalFacPages = Math.max(1, Math.ceil(filteredFacilities.length / FACILITIES_PER_PAGE));
  const paginatedFacilities = useMemo(() => {
    const start = (facPage - 1) * FACILITIES_PER_PAGE;
    return filteredFacilities.slice(start, start + FACILITIES_PER_PAGE);
  }, [filteredFacilities, facPage]);

  // Lọc danh sách sân con thuộc cơ sở đang chọn (hoặc tất cả cơ sở của Owner)
  const filteredCourts = useMemo(() => {
    const q = courtSearch.trim().toLowerCase();
    return courts.filter((c) => {
      const matchSearch =
        !q ||
        c.court_name.toLowerCase().includes(q) ||
        (c.sport_name && c.sport_name.toLowerCase().includes(q)) ||
        (c.facility_name && c.facility_name.toLowerCase().includes(q)) ||
        (c.utilities && c.utilities.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q));
      const matchSport =
        courtSportFilter === 'ALL' || Number(c.sport_id) === Number(courtSportFilter);
      const matchStatus = courtStatusFilter === 'ALL' || c.status === courtStatusFilter;
      return matchSearch && matchSport && matchStatus;
    });
  }, [courts, courtSearch, courtSportFilter, courtStatusFilter]);

  const totalCourtPages = Math.max(1, Math.ceil(filteredCourts.length / courtsPerPage));
  const paginatedCourts = useMemo(() => {
    const start = (courtPage - 1) * courtsPerPage;
    return filteredCourts.slice(start, start + courtsPerPage);
  }, [filteredCourts, courtPage, courtsPerPage]);

  // Thống kê KPI của tài khoản Owner hiện tại
  const stats = useMemo(() => {
    const totalFac = facilities.length;
    const activeFac = facilities.filter((f) => f.status === 'ACTIVE').length;
    const totalCourts = facilities.reduce((sum, f) => sum + (Number(f.total_courts) || 0), 0);
    const activeCourts = facilities.reduce((sum, f) => sum + (Number(f.active_courts) || 0), 0);
    return { totalFac, activeFac, totalCourts, activeCourts };
  }, [facilities]);

  // ==================== XỬ LÝ CƠ SỞ (FACILITY) ====================
  function handleOpenCreateFacility() {
    setEditingFac(null);
    setFacForm({ name: '', address: '', phone: '', description: '' });
    setFacError(null);
    setIsFacModalOpen(true);
  }

  function handleOpenEditFacility(fac: FacilityItem, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingFac(fac);
    setFacForm({
      name: fac.name,
      address: fac.address,
      phone: fac.phone || '',
      description: fac.description || '',
    });
    setFacError(null);
    setIsFacModalOpen(true);
  }

  async function handleSubmitFacility(e: React.FormEvent) {
    e.preventDefault();
    if (!facForm.name.trim()) {
      setFacError('Vui lòng nhập tên cơ sở.');
      return;
    }
    if (!facForm.address.trim()) {
      setFacError('Vui lòng nhập địa chỉ cơ sở.');
      return;
    }

    setFacSubmitting(true);
    setFacError(null);
    try {
      if (editingFac) {
        const updated = await updateFacilityApi(editingFac.facility_id, facForm);
        await loadInitialData(updated.facility_id);
        showToast('Cập nhật thông tin cơ sở thành công.');
      } else {
        const created = await createFacilityApi(facForm);
        await loadInitialData(created.facility_id);
        showToast('Đã thêm mới cơ sở sân cho tài khoản của bạn.');
      }
      setIsFacModalOpen(false);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setFacError(errorObj.response?.data?.message || errorObj.message || 'Thao tác thất bại.');
    } finally {
      setFacSubmitting(false);
    }
  }

  // ==================== XỬ LÝ SÂN CON (SUB-COURT) ====================
  function handleOpenCreateCourt(fac: FacilityItem, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    setTargetFacilityForCourt(fac);
    setEditingCourt(null);
    const nextCourtNumber = Number(fac.total_courts || 0) + 1;
    setCourtForm({
      courtName: `Sân ${nextCourtNumber} - `,
      sportId: sports.length > 0 ? sports[0].sport_id : 0,
      capacity: 10,
      description: '',
      utilities: 'Đèn LED chiếu sáng, Wifi miễn phí, Bãi giữ xe',
    });
    setCourtError(null);
    setIsCourtModalOpen(true);
  }

  function handleOpenEditCourt(court: CourtItem & { facility_name?: string }) {
    setEditingCourt(court);
    const matchedFacility =
      facilities.find((f) => Number(f.facility_id) === Number(court.facility_id)) ||
      (court.facility_name
        ? facilities.find((f) => f.name === court.facility_name)
        : undefined) ||
      selectedFacility;
    setTargetFacilityForCourt(matchedFacility || null);
    setCourtForm({
      courtName: court.court_name,
      sportId: court.sport_id,
      capacity: court.capacity || 10,
      description: court.description || '',
      utilities: parseUtilities(court.utilities).join(', '),
    });
    setCourtError(null);
    setIsCourtModalOpen(true);
  }

  async function handleSubmitCourt(e: React.FormEvent) {
    e.preventDefault();
    if (!courtForm.courtName.trim()) {
      setCourtError('Vui lòng nhập tên sân con.');
      return;
    }

    setCourtSubmitting(true);
    setCourtError(null);
    try {
      const cleanedPayload = {
        ...courtForm,
        utilities: parseUtilities(courtForm.utilities).join(', '),
      };

      if (editingCourt) {
        await updateCourtInFacilityApi(editingCourt.court_id, cleanedPayload);
        await loadInitialData(selectedFacility?.facility_id);
        showToast('Đã cập nhật thông tin sân con thành công.');
      } else if (targetFacilityForCourt) {
        await createCourtInFacilityApi(targetFacilityForCourt.facility_id, cleanedPayload);
        await loadInitialData(targetFacilityForCourt.facility_id);
        showToast(`Đã thêm sân con mới vào "${targetFacilityForCourt.name}".`);
      }
      setIsCourtModalOpen(false);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setCourtError(errorObj.response?.data?.message || errorObj.message || 'Thao tác thất bại.');
    } finally {
      setCourtSubmitting(false);
    }
  }

  // ==================== XỬ LÝ ĐỔI TRẠNG THÁI ====================
  async function handleConfirmStatusChange() {
    if (!statusConfirmModal) return;
    const { type, id, targetStatus } = statusConfirmModal;

    try {
      if (type === 'FACILITY') {
        await updateFacilityStatusApi(id, targetStatus);
        await loadInitialData(selectedFacility?.facility_id);
        showToast(
          targetStatus === 'ACTIVE'
            ? 'Đã kích hoạt lại hoạt động cơ sở sân.'
            : 'Đã chuyển cơ sở sang trạng thái ngừng hoạt động.'
        );
      } else {
        await updateCourtStatusApi(id, targetStatus);
        await loadInitialData(selectedFacility?.facility_id);
        showToast(
          targetStatus === 'ACTIVE'
            ? 'Đã kích hoạt lại sân con.'
            : 'Đã chuyển sân con sang trạng thái ngừng nhận đặt.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.';
      alert(msg);
    } finally {
      setStatusConfirmModal(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-[calc(100vh-2rem)]">
      {/* Toast thông báo nổi */}
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

      {/* 1. THANH ĐIỀU KHIỂN TRUNG TÂM (Gộp Header + Tab Điều hướng + Chuyển tài khoản Test + KPI Gọn Gàng) */}
      <div className="shrink-0 bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
        {/* Hàng 1: Tiêu đề + Tab chuyển trang + Nút thêm cơ sở */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 pb-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Quản Lý Cơ Sở Sân & Sân Con
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                  WBS 3.1
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Đang quản lý dưới quyền chủ sân:{' '}
                <strong className="text-slate-800">{user?.fullName || 'Chủ sân SportLink'}</strong>{' '}
                {user?.email && <span className="text-emerald-600 font-mono">({user.email})</span>}
              </p>
            </div>
          </div>

          {/* Bộ nút điều hướng & Thêm cơ sở mới */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Nút sang Quản lý loại môn */}
            <button
              type="button"
              onClick={() => navigate('/owner/sports')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span>Danh mục Môn thể thao</span>
            </button>

            {/* Nút Thêm cơ sở mới */}
            <button
              type="button"
              onClick={handleOpenCreateFacility}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Thêm cơ sở mới</span>
            </button>
          </div>
        </div>

        {/* Hàng 2: 4 Thẻ KPI Gọn Gàng (Inline Horizontal Strip) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Cơ sở của bạn
              </span>
              <span className="text-[11px] text-slate-400">Địa điểm thuộc sở hữu</span>
            </div>
            <span className="text-2xl font-black text-slate-900">{stats.totalFac}</span>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-emerald-50/50 border border-emerald-200/70">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Cơ sở đang mở
              </span>
              <span className="text-[11px] text-emerald-600/80">Đang nhận đặt lịch</span>
            </div>
            <span className="text-2xl font-black text-emerald-600">{stats.activeFac}</span>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Tổng sân con
              </span>
              <span className="text-[11px] text-slate-400">Sân 1, Sân 2, Sân 3...</span>
            </div>
            <span className="text-2xl font-black text-slate-900">{stats.totalCourts}</span>
          </div>

          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-teal-50/50 border border-teal-200/70">
            <div>
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider block">
                Sân con hoạt động
              </span>
              <span className="text-[11px] text-teal-600/80">Sẵn sàng phục vụ</span>
            </div>
            <span className="text-2xl font-black text-teal-600">{stats.activeCourts}</span>
          </div>
        </div>
      </div>

      {/* 2. BỐ CỤC CHÍNH CÂN ĐỐI: CỘT TRÁI (4/12 - Danh sách Cơ sở) & CỘT PHẢI (8/12 - Chi tiết Sân con) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
        {/* ==================== CỘT TRÁI (4/12): DANH SÁCH CƠ SỞ ĐỊA ĐIỂM ==================== */}
        <div className="lg:col-span-4 flex flex-col gap-3.5 bg-white p-4 md:p-5 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
            <div>
              <h2 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                1. Cơ sở của tôi ({filteredFacilities.length})
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Chọn 1 cơ sở để quản lý các sân con bên trong
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateFacility}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              + Thêm cơ sở
            </button>
          </div>

          {/* Thanh tìm kiếm & lọc cơ sở gọn trên 1 hàng */}
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm cơ sở, địa chỉ..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Lọc trạng thái cơ sở"
              className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shrink-0"
            >
              <option value="ALL">Tất cả</option>
              <option value="ACTIVE">Đang mở</option>
              <option value="INACTIVE">Tạm khóa</option>
            </select>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Đang tải danh sách cơ sở...
            </div>
          ) : paginatedFacilities.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
              Chưa có cơ sở sân nào. Hãy nhấn <strong>"+ Thêm cơ sở"</strong> để tạo mới!
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Nút chọn nhanh: Xem tất cả sân con của toàn bộ cơ sở thuộc Owner (18 sân) */}
              {facilities.length > 1 && (
                <div
                  onClick={() => selectAllFacilities()}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isAllFacilitiesMode
                      ? 'border-emerald-500 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 shadow-sm ring-2 ring-emerald-500/15'
                      : 'border-slate-200/90 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-100/60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                        Tổng hợp
                      </span>
                      <span className="text-xs font-extrabold text-slate-900">
                        Tất cả cơ sở của tôi ({facilities.length} cơ sở)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Hiển thị toàn bộ <strong>{stats.totalCourts} sân con</strong> trải đều các môn thể thao
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-white border border-emerald-200 text-emerald-700 text-xs font-extrabold shrink-0 shadow-2xs">
                    {stats.totalCourts} sân
                  </span>
                </div>
              )}

              {paginatedFacilities.map((fac) => {
                const isSelected = !isAllFacilitiesMode && selectedFacility?.facility_id === fac.facility_id;
                const isActive = fac.status === 'ACTIVE';
                const previews = fac.courts_preview || [];

                return (
                  <div
                    key={fac.facility_id}
                    onClick={() => selectFacility(fac)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2.5 ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/25 shadow-sm ring-2 ring-emerald-500/15'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/40'
                    }`}
                  >
                    {/* Dòng 1: Mã cơ sở + Trạng thái + Nút Sửa/Khóa nhanh */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                          CS #{fac.facility_id}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          <span>{isActive ? 'Đang hoạt động' : 'Tạm khóa'}</span>
                        </span>
                      </div>

                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditFacility(fac, e)}
                          className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:bg-slate-200/70 transition-colors cursor-pointer"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setStatusConfirmModal({
                              type: 'FACILITY',
                              id: fac.facility_id,
                              name: fac.name,
                              targetStatus: isActive ? 'INACTIVE' : 'ACTIVE',
                            })
                          }
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                            isActive
                              ? 'text-amber-700 hover:bg-amber-100/70'
                              : 'text-emerald-700 hover:bg-emerald-100/70'
                          }`}
                        >
                          {isActive ? 'Khóa' : 'Mở'}
                        </button>
                      </div>
                    </div>

                    {/* Dòng 2: Tên cơ sở trải rộng 100% chiều ngang (không bị ép xuống dòng) */}
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                        {fac.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 flex items-start gap-1.5">
                        <svg
                          className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5"
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
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="line-clamp-1">{fac.address}</span>
                      </p>
                    </div>

                    {/* Dòng 3: Tóm tắt sân con & Nút thêm sân con */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">
                          {fac.total_courts} sân con
                        </span>
                        <span className="text-[11px] text-emerald-600 font-semibold">
                          ({fac.active_courts} đang mở)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleOpenCreateCourt(fac, e)}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer shrink-0"
                      >
                        + Thêm sân con
                      </button>
                    </div>

                    {/* Dòng 4: Chip tên các sân con gọn gàng */}
                    {previews.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {previews.slice(0, 3).map((cp) => {
                          const spVis = getSportVisual(cp.sport_name);
                          return (
                            <span
                              key={cp.court_id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700 font-medium max-w-full"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${spVis.dotColor}`} />
                              <span className="truncate">{cp.court_name}</span>
                            </span>
                          );
                        })}
                        {previews.length > 3 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                            +{previews.length - 3} sân nữa
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Phân trang danh sách Cơ sở sân */}
          {totalFacPages > 1 && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Trang {facPage}/{totalFacPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={facPage <= 1}
                  onClick={() => setFacPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  ‹ Trước
                </button>
                <button
                  type="button"
                  disabled={facPage >= totalFacPages}
                  onClick={() => setFacPage((p) => Math.min(totalFacPages, p + 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Sau ›
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ==================== CỘT PHẢI (8/12): DANH SÁCH SÂN CON CỦA CƠ SỞ ĐANG CHỌN ==================== */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
            {selectedFacility ? (
              <>
                {/* Header thông tin Cơ sở đang chọn hoặc Toàn bộ cơ sở */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="min-w-0 flex-1">
                    {isAllFacilitiesMode ? (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                            2. Tất cả cơ sở của bạn ({facilities.length} cơ sở)
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            • Tổng cộng: <strong className="text-emerald-700">{stats.totalCourts} sân con</strong> (Đủ 6 môn thể thao)
                          </span>
                        </div>
                        <h3 className="text-xl font-extrabold text-slate-900 mt-1.5">
                          Danh Sách Toàn Bộ Sân Con Thuộc Quyền Sở Hữu
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                          Hiển thị đầy đủ các sân bóng đá, cầu lông, pickleball, tennis, bóng rổ, bóng chuyền thuộc các cơ sở của bạn. Nhấn vào từng cơ sở bên trái nếu muốn lọc riêng theo địa điểm.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                            2. Cơ sở đang chọn
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            Mã cơ sở: #{selectedFacility.facility_id}
                          </span>
                          {selectedFacility.phone && (
                            <span className="text-xs text-slate-500 font-medium">
                              • Hotline: <strong className="text-slate-700">{selectedFacility.phone}</strong>
                            </span>
                          )}
                        </div>

                        <h3 className="text-xl font-extrabold text-slate-900 mt-1.5">
                          {selectedFacility.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <svg
                            className="w-3.5 h-3.5 text-emerald-600 shrink-0"
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
                          <span>{selectedFacility.address}</span>
                        </p>

                        {selectedFacility.description && (
                          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                            {selectedFacility.description}
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenCreateCourt(selectedFacility)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Thêm sân con mới</span>
                  </button>
                </div>

                {/* Thanh lọc & tìm kiếm Sân con trong cơ sở */}
                <div className="mt-4 flex flex-col xl:flex-row gap-2.5 items-stretch xl:items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={courtSearch}
                      onChange={(e) => setCourtSearch(e.target.value)}
                      placeholder="Tìm theo tên sân con (Sân 1, Sân 2...), môn thể thao, tiện ích..."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      value={courtSportFilter}
                      onChange={(e) => setCourtSportFilter(e.target.value)}
                      aria-label="Lọc sân con theo môn thể thao"
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">Tất cả môn ({sports.length} môn)</option>
                      {sports.map((sp) => (
                        <option key={sp.sport_id} value={sp.sport_id}>
                          {sp.sport_name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={courtStatusFilter}
                      onChange={(e) => setCourtStatusFilter(e.target.value)}
                      aria-label="Lọc sân con theo trạng thái"
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">Mọi trạng thái</option>
                      <option value="ACTIVE">Đang hoạt động</option>
                      <option value="INACTIVE">Đang tạm đóng</option>
                    </select>

                    <select
                      value={courtsPerPage}
                      onChange={(e) => setCourtsPerPage(Number(e.target.value))}
                      aria-label="Số sân hiển thị trên mỗi trang"
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value={4}>4 sân / trang</option>
                      <option value={6}>6 sân / trang</option>
                      <option value={8}>8 sân / trang</option>
                    </select>
                  </div>
                </div>

                {/* Danh sách chi tiết các sân con */}
                <div className="mt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                      Danh sách sân con ({filteredCourts.length} sân)
                    </h4>

                    {totalCourtPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 mr-1">
                          Trang <strong>{courtPage}</strong>/{totalCourtPages}
                        </span>
                        <button
                          type="button"
                          disabled={courtPage <= 1}
                          onClick={() => setCourtPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
                        >
                          ‹
                        </button>
                        {Array.from({ length: totalCourtPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCourtPage(p)}
                            className={`w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                              p === courtPage
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={courtPage >= totalCourtPages}
                          onClick={() => setCourtPage((p) => Math.min(totalCourtPages, p + 1))}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
                        >
                          ›
                        </button>
                      </div>
                    )}
                  </div>

                  {loadingCourts ? (
                    <div className="py-12 text-center text-slate-400 text-sm">
                      Đang tải danh sách các sân con...
                    </div>
                  ) : paginatedCourts.length === 0 ? (
                    <div className="py-12 px-4 text-center border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs">
                      Chưa có sân con nào phù hợp. Nhấn nút{' '}
                      <strong>"+ Thêm sân con mới"</strong> ở góc phải để thêm Sân 1, Sân 2... vào cơ sở này.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {paginatedCourts.map((court) => {
                        const isCourtActive = court.status === 'ACTIVE';
                        const spVis = getSportVisual(court.sport_name);
                        const utilityList = parseUtilities(court.utilities);

                        return (
                          <div
                            key={court.court_id}
                            className={`p-5 rounded-2xl border border-slate-200/90 bg-white hover:shadow-md transition-all flex flex-col justify-between ${spVis.cardAccent}`}
                          >
                            <div>
                              {/* Dòng 1: Loại môn thể thao & Trạng thái hoạt động */}
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${spVis.badgeClass}`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${spVis.dotColor}`} />
                                  <span>{court.sport_name || 'Môn thể thao'}</span>
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                    isCourtActive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-300'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isCourtActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                    }`}
                                  />
                                  <span>
                                    {isCourtActive ? 'Đang mở đặt lịch' : 'Ngừng hoạt động'}
                                  </span>
                                </span>
                              </div>

                              {/* Dòng 2: Tên sân con & Cơ sở trực thuộc */}
                              <h5 className="text-base font-extrabold text-slate-900 leading-snug mt-3">
                                {court.court_name}
                              </h5>
                              {court.facility_name && (
                                <p className="text-[11px] font-semibold text-teal-700 mt-1 flex items-center gap-1">
                                  <span>📍 Thuộc:</span>
                                  <span className="truncate">{court.facility_name}</span>
                                </p>
                              )}

                              {/* Dòng 3: Mô tả mặt sân (Tách padding ra thẻ div ngoài để không bị cắt chữ dòng 2) */}
                              {court.description && (
                                <div className="mt-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                                    {court.description}
                                  </p>
                                </div>
                              )}

                              {/* Dòng 4: Tiện ích đi kèm (Đã làm sạch hoàn toàn dấu [" và "]) */}
                              {utilityList.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {utilityList.map((util, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100/90 text-slate-700 text-[11px] font-medium border border-slate-200/60"
                                    >
                                      <span className="text-emerald-600 font-bold">✓</span>
                                      <span>{util}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Chân thẻ: Mã sân + Sức chứa bên trái, Nút thao tác bên phải (Không bị cắt chữ) */}
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[11px] font-semibold">
                                  Mã #{court.court_id}
                                </span>
                                <span>•</span>
                                <span>
                                  Sức chứa: <strong className="text-slate-800">{court.capacity || 10} người</strong>
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditCourt(court)}
                                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                                >
                                  Chỉnh sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatusConfirmModal({
                                      type: 'COURT',
                                      id: court.court_id,
                                      name: court.court_name,
                                      targetStatus: isCourtActive ? 'INACTIVE' : 'ACTIVE',
                                    })
                                  }
                                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                                    isCourtActive
                                      ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                                      : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                  }`}
                                >
                                  {isCourtActive ? 'Tạm đóng' : 'Mở lại'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Thanh phân trang danh sách sân con nổi bật ở cuối danh sách */}
                  {totalCourtPages > 1 && (
                    <div className="mt-5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <span className="text-xs text-slate-600">
                        Hiển thị sân{' '}
                        <strong className="text-slate-900">
                          {(courtPage - 1) * courtsPerPage + 1}
                        </strong>{' '}
                        –{' '}
                        <strong className="text-slate-900">
                          {Math.min(courtPage * courtsPerPage, filteredCourts.length)}
                        </strong>{' '}
                        trên tổng số <strong className="text-emerald-700">{filteredCourts.length} sân con</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={courtPage <= 1}
                          onClick={() => setCourtPage((p) => Math.max(1, p - 1))}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer shadow-2xs"
                        >
                          ← Trang trước
                        </button>
                        {Array.from({ length: totalCourtPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCourtPage(p)}
                            className={`w-9 h-9 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                              p === courtPage
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/25'
                                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          type="button"
                          disabled={courtPage >= totalCourtPages}
                          onClick={() => setCourtPage((p) => Math.min(totalCourtPages, p + 1))}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer shadow-2xs"
                        >
                          Trang sau →
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-slate-400">
                Vui lòng chọn một cơ sở bên trái hoặc nhấn "+ Thêm cơ sở mới" để bắt đầu quản lý sân con.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== MODAL THÊM / SỬA CƠ SỞ SÂN ==================== */}
      {isFacModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingFac ? 'Chỉnh Sửa Thông Tin Cơ Sở' : 'Thêm Mới Cơ Sở Sân'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chủ sở hữu: <strong>{user?.fullName || user?.email}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFacModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {facError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {facError}
              </div>
            )}

            <form onSubmit={handleSubmitFacility} className="mt-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Tên cơ sở sân <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={facForm.name}
                  onChange={(e) => setFacForm({ ...facForm, name: e.target.value })}
                  placeholder="Ví dụ: Cụm Sân Thể Thao Hoàng Gia Thủ Đức"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Địa chỉ cụm sân <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={facForm.address}
                  onChange={(e) => setFacForm({ ...facForm, address: e.target.value })}
                  placeholder="Ví dụ: Số 200 Võ Văn Ngân, P. Bình Thọ, TP. Thủ Đức"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Số điện thoại liên hệ
                </label>
                <input
                  type="text"
                  value={facForm.phone}
                  onChange={(e) => setFacForm({ ...facForm, phone: e.target.value })}
                  placeholder="Ví dụ: 0901234567"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Mô tả cơ sở
                </label>
                <textarea
                  rows={3}
                  value={facForm.description}
                  onChange={(e) => setFacForm({ ...facForm, description: e.target.value })}
                  placeholder="Mô tả quy mô cụm sân, giờ mở cửa hoặc hướng dẫn đường đi..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                />
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFacModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={facSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {facSubmitting ? 'Đang lưu...' : editingFac ? 'Cập nhật' : 'Tạo cơ sở'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL THÊM / SỬA SÂN CON ==================== */}
      {isCourtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-8 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingCourt ? 'Chỉnh Sửa Sân Con' : 'Thêm Sân Con Vào Cơ Sở'}
                </h3>
                <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                  Cơ sở:{' '}
                  {targetFacilityForCourt?.name ||
                    (editingCourt as { facility_name?: string } | null)?.facility_name ||
                    'Chưa chọn cơ sở'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCourtModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {courtError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {courtError}
              </div>
            )}

            <form onSubmit={handleSubmitCourt} className="mt-5 flex flex-col gap-4">
              {!editingCourt && (isAllFacilitiesMode || facilities.length > 1) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Chọn cơ sở sân đích <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={targetFacilityForCourt?.facility_id || ''}
                    onChange={(e) => {
                      const nextFac = facilities.find(
                        (f) => Number(f.facility_id) === Number(e.target.value)
                      );
                      if (nextFac) {
                        setTargetFacilityForCourt(nextFac);
                        if (/^Sân \d+ -\s*$/.test(courtForm.courtName)) {
                          const nextNum = Number(nextFac.total_courts || 0) + 1;
                          setCourtForm((prev) => ({
                            ...prev,
                            courtName: `Sân ${nextNum} - `,
                          }));
                        }
                      }
                    }}
                    aria-label="Chọn cơ sở sân đích"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                  >
                    {facilities.map((f) => (
                      <option key={f.facility_id} value={f.facility_id}>
                        {f.name} ({f.total_courts || 0} sân con)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Tên sân con (Đánh số Sân 1, Sân 2...) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={courtForm.courtName}
                  onChange={(e) => setCourtForm({ ...courtForm, courtName: e.target.value })}
                  placeholder="Ví dụ: Sân 1 - Bóng Đá Cỏ Nhân Tạo 5 Người"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Loại môn thể thao <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={courtForm.sportId}
                    onChange={(e) => setCourtForm({ ...courtForm, sportId: Number(e.target.value) })}
                    aria-label="Chọn loại môn thể thao"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                  >
                    {sports.map((s) => (
                      <option key={s.sport_id} value={s.sport_id}>
                        {s.sport_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Sức chứa (Số người)
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={courtForm.capacity}
                    onChange={(e) => setCourtForm({ ...courtForm, capacity: Number(e.target.value) })}
                    aria-label="Sức chứa tối đa của sân"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Tiện ích đi kèm (cách nhau dấu phẩy)
                </label>
                <input
                  type="text"
                  value={courtForm.utilities}
                  onChange={(e) => setCourtForm({ ...courtForm, utilities: e.target.value })}
                  placeholder="Ví dụ: Đèn LED ban đêm, Wifi miễn phí, Phòng thay đồ, Có mái che"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Mô tả chi tiết sân con
                </label>
                <textarea
                  rows={2}
                  value={courtForm.description}
                  onChange={(e) => setCourtForm({ ...courtForm, description: e.target.value })}
                  placeholder="Mô tả chất lượng mặt cỏ/thảm, hệ thống chiếu sáng..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                />
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCourtModalOpen(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={courtSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {courtSubmitting ? 'Đang lưu...' : editingCourt ? 'Cập nhật sân' : 'Thêm sân con'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL XÁC NHẬN ĐỔI TRẠNG THÁI ==================== */}
      {statusConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 md:p-7 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h3 className="text-lg font-bold text-slate-900">
              {statusConfirmModal.targetStatus === 'ACTIVE'
                ? 'Xác nhận kích hoạt lại'
                : 'Xác nhận ngừng hoạt động'}
            </h3>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              Bạn có chắc chắn muốn{' '}
              <strong className="text-slate-800">
                {statusConfirmModal.targetStatus === 'ACTIVE'
                  ? 'mở hoạt động lại'
                  : 'tạm ngừng hoạt động'}
              </strong>{' '}
              đối với{' '}
              {statusConfirmModal.type === 'FACILITY' ? 'cơ sở' : 'sân con'}{' '}
              <strong className="text-emerald-700">"{statusConfirmModal.name}"</strong>?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStatusConfirmModal(null)}
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

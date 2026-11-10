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
import { getAllSportsApi, type SportItem } from '../sports/sport.api';
import { login } from '../auth/auth.api';
import { useAuthStore, type User, type UserRole } from '../../shared/stores/authStore';
import { useNavigate } from 'react-router';

const DEMO_OWNER_ACCOUNTS = [
  {
    email: 'owner@sportlink.vn',
    password: 'password123',
    label: 'Owner 1: Trần Chủ Sân',
    subLabel: 'Cụm Bóng Đá Man Thiện & CLB Cầu Lông Hiệp Phú',
  },
  {
    email: 'owner2@sportlink.vn',
    password: 'password123',
    label: 'Owner 2: Nguyễn Minh Hoàng',
    subLabel: 'TT Pickleball & Tennis Khu CNC & Nhà Thi Đấu Bóng Rổ',
  },
  {
    email: 'owner3@sportlink.vn',
    password: 'password123',
    label: 'Owner 3: Lê Quốc Bảo',
    subLabel: 'Tổ Hợp Thể Thao Đa Năng Làng Đại Học Thủ Đức',
  },
];

function getSportVisual(sportName?: string) {
  const lower = (sportName || '').toLowerCase();
  if (lower.includes('bóng đá') || lower.includes('futsal')) {
    return {
      icon: '⚽',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      cardAccent: 'border-l-4 border-l-emerald-500',
    };
  }
  if (lower.includes('cầu lông')) {
    return {
      icon: '🏸',
      badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      cardAccent: 'border-l-4 border-l-cyan-500',
    };
  }
  if (lower.includes('pickleball')) {
    return {
      icon: '🏓',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      cardAccent: 'border-l-4 border-l-blue-500',
    };
  }
  if (lower.includes('tennis') || lower.includes('quần vợt')) {
    return {
      icon: '🎾',
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      cardAccent: 'border-l-4 border-l-indigo-500',
    };
  }
  if (lower.includes('bóng rổ')) {
    return {
      icon: '🏀',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      cardAccent: 'border-l-4 border-l-amber-500',
    };
  }
  if (lower.includes('bóng chuyền')) {
    return {
      icon: '🏐',
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
      cardAccent: 'border-l-4 border-l-purple-500',
    };
  }
  return {
    icon: '🏟️',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    cardAccent: 'border-l-4 border-l-teal-500',
  };
}

export default function FacilityManagementPage() {
  const navigate = useNavigate();
  const { user, setAuth } = useAuthStore();

  // Danh sách cơ sở và môn thể thao
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [sports, setSports] = useState<SportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingAccount, setSwitchingAccount] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Bộ lọc tìm kiếm & trạng thái Cơ sở (Cột trái)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [facPage, setFacPage] = useState(1);
  const FACILITIES_PER_PAGE = 4;

  // Cơ sở đang được chọn & Bộ lọc danh sách sân con (Cột phải)
  const [selectedFacility, setSelectedFacility] = useState<FacilityItem | null>(null);
  const [courts, setCourts] = useState<CourtItem[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [courtSearch, setCourtSearch] = useState('');
  const [courtSportFilter, setCourtSportFilter] = useState<string>('ALL');
  const [courtStatusFilter, setCourtStatusFilter] = useState<string>('ALL');
  const [courtPage, setCourtPage] = useState(1);
  const COURTS_PER_PAGE = 4;

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
  }, [courtSearch, courtSportFilter, courtStatusFilter, selectedFacility?.facility_id]);

  async function loadInitialData(preferredFacId?: number) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [facData, sportData] = await Promise.all([
        getOwnerFacilitiesApi(),
        getAllSportsApi({ status: 'ACTIVE' }),
      ]);
      setFacilities(facData);
      setSports(sportData);

      const targetFac =
        (preferredFacId ? facData.find((f) => f.facility_id === preferredFacId) : null) ||
        facData[0] ||
        null;

      if (targetFac) {
        await selectFacility(targetFac);
      } else {
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

  // Tải danh sách sân con khi chọn cơ sở
  async function selectFacility(fac: FacilityItem) {
    setSelectedFacility(fac);
    setLoadingCourts(true);
    try {
      const courtData = await getCourtsByFacilityApi(fac.facility_id);
      setCourts(courtData);
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

  // Chuyển nhanh giữa 3 tài khoản Chủ sân kiểm thử (owner, owner2, owner3)
  async function handleQuickSwitchOwner(email: string, password: string) {
    if (user?.email?.toLowerCase() === email.toLowerCase()) return;
    setSwitchingAccount(email);
    setErrorMsg(null);
    try {
      const res = await login({ email, password });
      if (res && res.token) {
        const raw = res.data || {};
        const normalizedRole = ((raw.role || raw.Role || 'owner') as string).toLowerCase() as UserRole;
        const authenticatedUser: User = {
          id: raw.id ?? raw.Id ?? 0,
          fullName: raw.fullName ?? raw.FullName ?? email,
          email: raw.email ?? raw.Email ?? email,
          role: normalizedRole,
          avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? null,
        };
        setAuth(authenticatedUser, res.token);
        showToast(`Đã chuyển sang tài khoản chủ sân: ${authenticatedUser.fullName} (${email})`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể chuyển tài khoản kiểm thử.';
      setErrorMsg(msg);
    } finally {
      setSwitchingAccount(null);
    }
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

  // Lọc danh sách sân con thuộc cơ sở đang chọn
  const filteredCourts = useMemo(() => {
    const q = courtSearch.trim().toLowerCase();
    return courts.filter((c) => {
      const matchSearch =
        !q ||
        c.court_name.toLowerCase().includes(q) ||
        (c.sport_name && c.sport_name.toLowerCase().includes(q)) ||
        (c.utilities && c.utilities.toLowerCase().includes(q)) ||
        (c.description && c.description.toLowerCase().includes(q));
      const matchSport =
        courtSportFilter === 'ALL' || Number(c.sport_id) === Number(courtSportFilter);
      const matchStatus = courtStatusFilter === 'ALL' || c.status === courtStatusFilter;
      return matchSearch && matchSport && matchStatus;
    });
  }, [courts, courtSearch, courtSportFilter, courtStatusFilter]);

  const totalCourtPages = Math.max(1, Math.ceil(filteredCourts.length / COURTS_PER_PAGE));
  const paginatedCourts = useMemo(() => {
    const start = (courtPage - 1) * COURTS_PER_PAGE;
    return filteredCourts.slice(start, start + COURTS_PER_PAGE);
  }, [filteredCourts, courtPage]);

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

  function handleOpenEditCourt(court: CourtItem) {
    setEditingCourt(court);
    setTargetFacilityForCourt(selectedFacility);
    setCourtForm({
      courtName: court.court_name,
      sportId: court.sport_id,
      capacity: court.capacity || 10,
      description: court.description || '',
      utilities: court.utilities || '',
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
      if (editingCourt) {
        await updateCourtInFacilityApi(editingCourt.court_id, courtForm);
        await loadInitialData(selectedFacility?.facility_id);
        showToast('Đã cập nhật thông tin sân con thành công.');
      } else if (targetFacilityForCourt) {
        await createCourtInFacilityApi(targetFacilityForCourt.facility_id, courtForm);
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
    <div className="flex-1 flex flex-col gap-5 min-h-[calc(100vh-2rem)]">
      {/* Toast thông báo nổi */}
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

      {/* 1. Header Card: Tiêu đề, Badge WBS & Nút Chức năng */}
      <div className="shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 md:p-7 rounded-3xl border border-slate-200/80 shadow-md">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Quản Lý Cơ Sở Sân & Danh Sách Sân Con
            </h1>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              WBS 3.1 (S2-02)
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            Mỗi tài khoản Chủ sân (OWNER) quản lý độc lập các Cơ sở sân (địa điểm) và các Sân con (Sân 1, Sân 2, Sân 3...) trực thuộc cơ sở đó
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/owner/sports')}
            className="inline-flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-2xl transition-all cursor-pointer"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Quản lý loại môn thể thao</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateFacility}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all cursor-pointer shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Thêm cơ sở sân mới</span>
          </button>
        </div>
      </div>

      {/* 1.5. Thanh thông tin Chủ sân hiện tại & Chuyển nhanh 3 tài khoản Chủ sân để kiểm thử phân tách dữ liệu */}
      <div className="shrink-0 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white p-5 rounded-3xl shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-xl shrink-0">
            👤
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wider font-bold text-emerald-300">
                Tài khoản Chủ sân đang đăng nhập:
              </span>
              <span className="text-sm font-extrabold text-white">
                {user?.fullName || 'Chủ sân SportLink'}
              </span>
              {user?.email && (
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-emerald-200 text-xs font-mono">
                  {user.email}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Mỗi tài khoản Chủ sân chỉ nhìn thấy và quản lý các cơ sở & sân con thuộc quyền sở hữu của riêng mình (Mật khẩu chung: <code className="text-emerald-300 font-bold">password123</code>).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-emerald-200 mr-1">
            Chuyển nhanh tài khoản Test:
          </span>
          {DEMO_OWNER_ACCOUNTS.map((acc) => {
            const isCurrent = user?.email?.toLowerCase() === acc.email.toLowerCase();
            const isSwitching = switchingAccount === acc.email;

            return (
              <button
                key={acc.email}
                type="button"
                disabled={isCurrent || Boolean(switchingAccount)}
                onClick={() => handleQuickSwitchOwner(acc.email, acc.password)}
                title={`${acc.subLabel} (Email: ${acc.email} / MK: password123)`}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-start text-left border ${
                  isCurrent
                    ? 'bg-emerald-500 text-white border-emerald-300 shadow-md'
                    : 'bg-white/10 hover:bg-white/20 text-slate-100 border-white/15'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span>{isSwitching ? 'Đang chuyển...' : acc.label}</span>
                  {isCurrent && (
                    <span className="px-1.5 py-0.2 bg-white/25 rounded text-[10px]">Đang chọn</span>
                  )}
                </span>
                <span className="text-[10px] font-mono opacity-80">{acc.email}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Thẻ KPI Thống kê của Chủ sân hiện tại */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Cơ sở sân của bạn
          </span>
          <div className="text-3xl font-black text-slate-900 mt-2">{stats.totalFac}</div>
          <span className="text-xs text-slate-400 mt-1 block">Thuộc tài khoản {user?.email}</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cơ sở đang mở
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-emerald-600 mt-2">{stats.activeFac}</div>
          <span className="text-xs text-slate-400 mt-1 block">Đang hoạt động & nhận đặt lịch</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Tổng sân con trực thuộc
          </span>
          <div className="text-3xl font-black text-slate-900 mt-2">{stats.totalCourts}</div>
          <span className="text-xs text-slate-400 mt-1 block">Các sân nhỏ (Sân 1, Sân 2, Sân 3...)</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sân con sẵn sàng
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
          </div>
          <div className="text-3xl font-black text-teal-600 mt-2">{stats.activeCourts}</div>
          <span className="text-xs text-slate-400 mt-1 block">Đang mở cho khách đặt khung giờ</span>
        </div>
      </div>

      {/* 3. Nội dung chính: Cột trái (Danh sách Cơ sở lớn) - Cột phải (Chi tiết & Danh sách Sân con) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
        {/* ==================== CỘT TRÁI (5 phần): DANH SÁCH CƠ SỞ ĐỊA ĐIỂM ==================== */}
        <div className="lg:col-span-5 flex flex-col gap-3.5 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-md">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                1. Danh sách Cơ sở của tôi ({filteredFacilities.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chọn 1 cơ sở bên dưới để xem/thêm các sân con bên trong
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateFacility}
              className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              + Thêm cơ sở
            </button>
          </div>

          {/* Thanh lọc cơ sở */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm cơ sở, địa chỉ, tên sân..."
                className="w-full pl-3.5 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Lọc trạng thái cơ sở"
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              Đang tải danh sách cơ sở của bạn...
            </div>
          ) : paginatedFacilities.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
              Tài khoản này chưa có cơ sở sân nào phù hợp. Hãy nhấn <strong>"+ Thêm cơ sở"</strong> để khởi tạo cơ sở sân mới!
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {paginatedFacilities.map((fac) => {
                const isSelected = selectedFacility?.facility_id === fac.facility_id;
                const isActive = fac.status === 'ACTIVE';
                const previews = fac.courts_preview || [];

                return (
                  <div
                    key={fac.facility_id}
                    onClick={() => selectFacility(fac)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/30 shadow-md ring-2 ring-emerald-500/20'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-mono font-bold">
                            CS #{fac.facility_id}
                          </span>
                          <h3 className="text-base font-extrabold text-slate-900">{fac.name}</h3>
                        </div>

                        <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="line-clamp-1">{fac.address}</span>
                        </p>

                        {fac.phone && (
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <span>📞 Hotline: {fac.phone}</span>
                          </p>
                        )}
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                      </span>
                    </div>

                    {/* Hiển thị trực quan các sân con nằm trong cơ sở này */}
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                      <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center justify-between">
                        <span>Các sân con trực thuộc ({fac.total_courts} sân):</span>
                        <span className="text-emerald-600">{fac.active_courts} sân đang mở</span>
                      </div>

                      {previews.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">
                          Chưa có sân con nào — nhấn "+ Thêm sân con" để tạo Sân 1, Sân 2...
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {previews.slice(0, 4).map((cp) => {
                            const spVis = getSportVisual(cp.sport_name);
                            return (
                              <span
                                key={cp.court_id}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${
                                  cp.status === 'ACTIVE'
                                    ? 'bg-white text-slate-800 border-slate-200 shadow-2xs'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                                }`}
                              >
                                <span>{spVis.icon}</span>
                                <span className="truncate max-w-[160px]">{cp.court_name}</span>
                              </span>
                            );
                          })}
                          {previews.length > 4 && (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                              +{previews.length - 4} sân khác
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Thanh công cụ thao tác nhanh trên Cơ sở */}
                    <div
                      className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(e) => handleOpenCreateCourt(fac, e)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                      >
                        <span>+ Thêm sân con vào cơ sở này</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditFacility(fac, e)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          Sửa cơ sở
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
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            isActive
                              ? 'text-amber-700 hover:bg-amber-50'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {isActive ? 'Khóa' : 'Mở lại'}
                        </button>
                      </div>
                    </div>
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

        {/* ==================== CỘT PHẢI (7 phần): DANH SÁCH SÂN CON CỦA CƠ SỞ ĐANG CHỌN ==================== */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
            {selectedFacility ? (
              <>
                {/* Header thông tin Cơ sở đang chọn */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                        2. Chi tiết Cơ sở đang chọn
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Mã cơ sở: #{selectedFacility.facility_id}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-slate-900 mt-2">
                      {selectedFacility.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                      <span>📍 {selectedFacility.address}</span>
                      {selectedFacility.phone && <span>• 📞 {selectedFacility.phone}</span>}
                    </p>
                    {selectedFacility.description && (
                      <p className="text-xs text-slate-500 mt-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                        {selectedFacility.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenCreateCourt(selectedFacility)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Thêm sân con mới</span>
                  </button>
                </div>

                {/* Thanh lọc & tìm kiếm Sân con trong cơ sở */}
                <div className="mt-4 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200/70">
                  <input
                    type="text"
                    value={courtSearch}
                    onChange={(e) => setCourtSearch(e.target.value)}
                    placeholder="Tìm theo tên sân con (Sân 1, Sân 2...), tiện ích..."
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                  />

                  <div className="flex items-center gap-2">
                    <select
                      value={courtSportFilter}
                      onChange={(e) => setCourtSportFilter(e.target.value)}
                      aria-label="Lọc sân con theo môn thể thao"
                      className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">Tất cả môn thể thao</option>
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
                  </div>
                </div>

                {/* Danh sách chi tiết các sân con */}
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Danh sách các sân con trong cơ sở ({filteredCourts.length} sân)
                    </h4>
                    {totalCourtPages > 1 && (
                      <span className="text-xs text-slate-500">
                        Trang <strong>{courtPage}</strong> / <strong>{totalCourtPages}</strong>
                      </span>
                    )}
                  </div>

                  {loadingCourts ? (
                    <div className="py-12 text-center text-slate-400 text-sm">
                      Đang tải danh sách các sân con...
                    </div>
                  ) : paginatedCourts.length === 0 ? (
                    <div className="py-12 px-4 text-center border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs">
                      Chưa có sân con nào trong danh sách lọc. Nhấn nút{' '}
                      <strong>"+ Thêm sân con mới"</strong> ở góc phải để thêm Sân 1, Sân 2... vào cơ sở này.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {paginatedCourts.map((court) => {
                        const isCourtActive = court.status === 'ACTIVE';
                        const spVis = getSportVisual(court.sport_name);
                        const utilityList = court.utilities
                          ? court.utilities
                              .split(',')
                              .map((u) => u.trim())
                              .filter(Boolean)
                          : [];

                        return (
                          <div
                            key={court.court_id}
                            className={`p-4 rounded-2xl border border-slate-200/90 bg-white hover:shadow-md transition-all flex flex-col justify-between ${spVis.cardAccent}`}
                          >
                            <div>
                              {/* Dòng 1: Loại môn thể thao & Trạng thái hoạt động */}
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border text-xs font-bold ${spVis.badgeClass}`}
                                >
                                  <span>{spVis.icon}</span>
                                  <span>{court.sport_name || 'Môn thể thao'}</span>
                                </span>

                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
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

                              {/* Dòng 2: Tên sân con & Mã sân */}
                              <div className="mt-2.5">
                                <h5 className="text-base font-extrabold text-slate-900 leading-snug">
                                  {court.court_name}
                                </h5>
                                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                                  <span className="font-mono text-[11px] text-slate-400">
                                    Mã sân: #{court.court_id}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    👥 Sức chứa: <strong className="text-slate-800">{court.capacity || 10} người</strong>
                                  </span>
                                </div>
                              </div>

                              {/* Dòng 3: Mô tả mặt sân */}
                              {court.description && (
                                <p className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2">
                                  {court.description}
                                </p>
                              )}

                              {/* Dòng 4: Tiện ích đi kèm */}
                              {utilityList.length > 0 && (
                                <div className="mt-2.5 flex flex-wrap gap-1">
                                  {utilityList.map((util, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium"
                                    >
                                      ✓ {util}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Chân thẻ: Chỉnh sửa & Đổi trạng thái */}
                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                              <span className="text-[11px] text-slate-400 truncate">
                                Thuộc: {selectedFacility.name}
                              </span>

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

                  {/* Thanh phân trang danh sách sân con */}
                  {totalCourtPages > 1 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">
                        Hiển thị sân{' '}
                        <strong>{(courtPage - 1) * COURTS_PER_PAGE + 1}</strong> -{' '}
                        <strong>
                          {Math.min(courtPage * COURTS_PER_PAGE, filteredCourts.length)}
                        </strong>{' '}
                        trên tổng <strong>{filteredCourts.length}</strong> sân con
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={courtPage <= 1}
                          onClick={() => setCourtPage((p) => Math.max(1, p - 1))}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
                        >
                          ← Trang trước
                        </button>
                        {Array.from({ length: totalCourtPages }, (_, i) => i + 1).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCourtPage(p)}
                            className={`w-8 h-8 rounded-xl text-xs font-bold cursor-pointer ${
                              p === courtPage
                                ? 'bg-emerald-600 text-white'
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
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 disabled:opacity-40 cursor-pointer"
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
                Vui lòng chọn một cơ sở bên trái hoặc nhấn "+ Thêm cơ sở sân mới" để bắt đầu quản lý sân con.
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
                {targetFacilityForCourt && (
                  <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                    Cơ sở: {targetFacilityForCourt.name}
                  </p>
                )}
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

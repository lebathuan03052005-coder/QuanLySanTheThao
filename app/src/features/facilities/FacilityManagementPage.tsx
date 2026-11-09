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
import { useNavigate } from 'react-router';

export default function FacilityManagementPage() {
  const navigate = useNavigate();

  // Danh sách cơ sở và môn thể thao
  const [facilities, setFacilities] = useState<FacilityItem[]>([]);
  const [sports, setSports] = useState<SportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Bộ lọc tìm kiếm & trạng thái
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Cơ sở đang được chọn để xem danh sách sân con (Sub-courts)
  const [selectedFacility, setSelectedFacility] = useState<FacilityItem | null>(null);
  const [courts, setCourts] = useState<CourtItem[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(false);

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
  }, []);

  async function loadInitialData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [facData, sportData] = await Promise.all([
        getOwnerFacilitiesApi(),
        getAllSportsApi({ status: 'ACTIVE' }),
      ]);
      setFacilities(facData);
      setSports(sportData);

      // Mặc định chọn cơ sở đầu tiên nếu có
      if (facData.length > 0 && !selectedFacility) {
        selectFacility(facData[0]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải dữ liệu cơ sở.';
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

  // Lọc cơ sở theo từ khóa và trạng thái
  const filteredFacilities = useMemo(() => {
    return facilities.filter((f) => {
      const matchSearch =
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.phone && f.phone.includes(searchTerm));
      const matchStatus = statusFilter === 'ALL' || f.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [facilities, searchTerm, statusFilter]);

  // Thống kê KPI
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
        setFacilities((prev) =>
          prev.map((f) => (f.facility_id === updated.facility_id ? { ...f, ...updated } : f))
        );
        if (selectedFacility?.facility_id === updated.facility_id) {
          setSelectedFacility((prev) => (prev ? { ...prev, ...updated } : prev));
        }
        showToast('Cập nhật thông tin cơ sở thành công.');
      } else {
        const created = await createFacilityApi(facForm);
        setFacilities((prev) => [created, ...prev]);
        selectFacility(created);
        showToast('Đã thêm mới cơ sở sân thành công.');
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
    setCourtForm({
      courtName: '',
      sportId: sports.length > 0 ? sports[0].sport_id : 0,
      capacity: 10,
      description: '',
      utilities: '',
    });
    setCourtError(null);
    setIsCourtModalOpen(true);
  }

  function handleOpenEditCourt(court: CourtItem) {
    setEditingCourt(court);
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
        const updated = await updateCourtInFacilityApi(editingCourt.court_id, courtForm);
        setCourts((prev) =>
          prev.map((c) =>
            c.court_id === updated.court_id
              ? {
                  ...c,
                  ...updated,
                  sport_name: sports.find((s) => s.sport_id === updated.sport_id)?.sport_name,
                }
              : c
          )
        );
        showToast('Đã cập nhật sân con thành công.');
      } else if (targetFacilityForCourt) {
        const created = await createCourtInFacilityApi(
          targetFacilityForCourt.facility_id,
          courtForm
        );
        const sportObj = sports.find((s) => s.sport_id === created.sport_id);
        const newCourtWithSport: CourtItem = { ...created, sport_name: sportObj?.sport_name };

        // Cập nhật danh sách sân con hiển thị
        if (selectedFacility?.facility_id === targetFacilityForCourt.facility_id) {
          setCourts((prev) => [...prev, newCourtWithSport]);
        }
        // Cập nhật số đếm sân con trong danh sách cơ sở
        setFacilities((prev) =>
          prev.map((f) =>
            f.facility_id === targetFacilityForCourt.facility_id
              ? {
                  ...f,
                  total_courts: Number(f.total_courts || 0) + 1,
                  active_courts: Number(f.active_courts || 0) + 1,
                }
              : f
          )
        );
        showToast('Đã tạo mới sân con thành công.');
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
        const updated = await updateFacilityStatusApi(id, targetStatus);
        setFacilities((prev) =>
          prev.map((f) => (f.facility_id === updated.facility_id ? { ...f, status: updated.status } : f))
        );
        if (selectedFacility?.facility_id === id) {
          setSelectedFacility((prev) => (prev ? { ...prev, status: updated.status } : prev));
        }
        showToast(
          targetStatus === 'ACTIVE'
            ? 'Đã kích hoạt lại hoạt động cơ sở sân.'
            : 'Đã chuyển cơ sở sang trạng thái ngừng hoạt động.'
        );
      } else {
        const updated = await updateCourtStatusApi(id, targetStatus);
        setCourts((prev) =>
          prev.map((c) => (c.court_id === updated.court_id ? { ...c, status: updated.status } : c))
        );
        showToast(
          targetStatus === 'ACTIVE'
            ? 'Đã kích hoạt lại sân con.'
            : 'Đã chuyển sân sang trạng thái ngừng nhận đặt.'
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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Quản Lý Cơ Sở Sân & Sân Con
            </h1>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              WBS 3.1
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            Quản lý các cụm cơ sở thể thao và danh sách các sân trực thuộc cơ sở do bạn sở hữu
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Nút sang quản lý Loại môn thể thao */}
          <button
            type="button"
            onClick={() => navigate('/owner/sports')}
            className="inline-flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-2xl transition-all cursor-pointer"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Quản lý loại môn</span>
          </button>

          {/* Nút Thêm cơ sở */}
          <button
            type="button"
            onClick={handleOpenCreateFacility}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all cursor-pointer shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Thêm cơ sở mới</span>
          </button>
        </div>
      </div>

      {/* 2. Thẻ KPI Thống kê */}
      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Tổng cơ sở sân
          </span>
          <div className="text-3xl font-black text-slate-900 mt-2">{stats.totalFac}</div>
          <span className="text-xs text-slate-400 mt-1 block">Thuộc quyền quản lý của bạn</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cơ sở đang mở
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-3xl font-black text-emerald-600 mt-2">{stats.activeFac}</div>
          <span className="text-xs text-slate-400 mt-1 block">Đang nhận khách và đặt lịch</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Tổng sân con
          </span>
          <div className="text-3xl font-black text-slate-900 mt-2">{stats.totalCourts}</div>
          <span className="text-xs text-slate-400 mt-1 block">Toàn bộ cụm sân trực thuộc</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Sân con hoạt động
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
          </div>
          <div className="text-3xl font-black text-teal-600 mt-2">{stats.activeCourts}</div>
          <span className="text-xs text-slate-400 mt-1 block">Sẵn sàng phục vụ người chơi</span>
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
            placeholder="Tìm theo tên cơ sở, địa chỉ, số điện thoại..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 shrink-0">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Lọc theo trạng thái cơ sở"
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Ngừng hoạt động</option>
          </select>
        </div>
      </div>

      {/* 4. Nội dung chính: Cột trái (Danh sách cơ sở) - Cột phải (Danh sách sân con của cơ sở được chọn) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
        {/* CỘT TRÁI (5 phần): Danh sách các cơ sở */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Danh sách cơ sở ({filteredFacilities.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              Đang tải danh sách cơ sở...
            </div>
          ) : filteredFacilities.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-dashed border-slate-300 text-slate-500">
              Không tìm thấy cơ sở nào phù hợp.
            </div>
          ) : (
            filteredFacilities.map((fac) => {
              const isSelected = selectedFacility?.facility_id === fac.facility_id;
              const isActive = fac.status === 'ACTIVE';

              return (
                <div
                  key={fac.facility_id}
                  onClick={() => selectFacility(fac)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer relative bg-white ${
                    isSelected
                      ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{fac.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="line-clamp-1">{fac.address}</span>
                      </p>
                      {fac.phone && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span>{fac.phone}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Thanh thống kê sân & Hành động */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      <strong className="text-slate-800">{fac.total_courts}</strong> sân con (
                      <span className="text-emerald-600 font-semibold">{fac.active_courts} mở</span>)
                    </span>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleOpenCreateCourt(fac, e)}
                        title="Thêm sân con vào cơ sở này"
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditFacility(fac, e)}
                        title="Chỉnh sửa thông tin cơ sở"
                        className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
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
                        title={isActive ? 'Ngừng hoạt động' : 'Kích hoạt lại'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isActive
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* CỘT PHẢI (7 phần): Danh sách các sân con thuộc cơ sở được chọn */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-md">
            {selectedFacility ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
                  <div>
                    <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider block">
                      Chi tiết cơ sở đang chọn
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">{selectedFacility.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{selectedFacility.address}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenCreateCourt(selectedFacility)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Thêm sân con</span>
                  </button>
                </div>

                {/* Danh sách sân con */}
                <div className="mt-5">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Danh sách các sân con ({courts.length})
                  </h4>

                  {loadingCourts ? (
                    <div className="py-12 text-center text-slate-400">Đang tải danh sách sân con...</div>
                  ) : courts.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-slate-200 rounded-2xl text-slate-400">
                      Cơ sở này chưa có sân con nào. Nhấn "+ Thêm sân con" để tạo sân mới.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {courts.map((court) => {
                        const isCourtActive = court.status === 'ACTIVE';

                        return (
                          <div
                            key={court.court_id}
                            className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-slate-200 hover:shadow-md transition-all flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h5 className="text-sm font-bold text-slate-900 leading-snug">
                                  {court.court_name}
                                </h5>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border shrink-0 ${
                                    isCourtActive
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-slate-200 text-slate-600 border-slate-300'
                                  }`}
                                >
                                  {isCourtActive ? 'Hoạt động' : 'Đóng'}
                                </span>
                              </div>

                              <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold">
                                  {court.sport_name || 'Môn thể thao'}
                                </span>
                                {court.capacity && (
                                  <span className="text-xs text-slate-500">
                                    Sức chứa: <strong>{court.capacity}</strong> người
                                  </span>
                                )}
                              </div>

                              {court.description && (
                                <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                  {court.description}
                                </p>
                              )}
                            </div>

                            <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenEditCourt(court)}
                                className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                              >
                                Sửa
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
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                  isCourtActive
                                    ? 'text-amber-700 hover:bg-amber-100'
                                    : 'text-emerald-700 hover:bg-emerald-100'
                                }`}
                              >
                                {isCourtActive ? 'Ngừng hoạt động' : 'Mở lại'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-16 text-center text-slate-400">
                Vui lòng chọn một cơ sở bên trái để xem và quản lý các sân con trực thuộc.
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
              <h3 className="text-xl font-bold text-slate-900">
                {editingFac ? 'Chỉnh Sửa Thông Tin Cơ Sở' : 'Thêm Mới Cơ Sở Sân'}
              </h3>
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
                  placeholder="Ví dụ: Cụm Sân Thể Thao Man Thiện PTIT"
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
                  placeholder="Ví dụ: Số 106 Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức"
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
                  placeholder="Mô tả cụm sân, hướng dẫn tìm đường hoặc quy định chung..."
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
                  {editingCourt ? 'Chỉnh Sửa Sân Con' : 'Thêm Sân Con Mới'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Cơ sở: <strong>{targetFacilityForCourt?.name || selectedFacility?.name}</strong>
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
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Tên sân con <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={courtForm.courtName}
                  onChange={(e) => setCourtForm({ ...courtForm, courtName: e.target.value })}
                  placeholder="Ví dụ: Sân Bóng 5A, Sân Cầu Lông Số 1..."
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
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800 cursor-pointer"
                  >
                    {sports.map((sp) => (
                      <option key={sp.sport_id} value={sp.sport_id}>
                        {sp.sport_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Sức chứa (số người)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={courtForm.capacity}
                    onChange={(e) => setCourtForm({ ...courtForm, capacity: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Mô tả / Đặc điểm sân
                </label>
                <textarea
                  rows={2}
                  value={courtForm.description}
                  onChange={(e) => setCourtForm({ ...courtForm, description: e.target.value })}
                  placeholder="Ví dụ: Mặt sân cỏ nhân tạo nhập khẩu, hệ thống đèn LED chống lóa..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Tiện ích đi kèm
                </label>
                <input
                  type="text"
                  value={courtForm.utilities}
                  onChange={(e) => setCourtForm({ ...courtForm, utilities: e.target.value })}
                  placeholder="Ví dụ: Căng tin, Chỗ để xe, Phòng tắm, Cho thuê bóng..."
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
                  {courtSubmitting ? 'Đang lưu...' : editingCourt ? 'Cập nhật' : 'Tạo sân con'}
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
                {statusConfirmModal.targetStatus === 'ACTIVE' ? 'kích hoạt lại' : 'ngừng hoạt động'}
              </strong>{' '}
              {statusConfirmModal.type === 'FACILITY' ? 'cơ sở sân' : 'sân con'}{' '}
              <strong className="text-emerald-700">"{statusConfirmModal.name}"</strong>?
              {statusConfirmModal.targetStatus === 'INACTIVE' && (
                <span className="block mt-2 text-xs text-amber-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  Lưu ý nghiệp vụ: Hệ thống không xóa dữ liệu hay lịch sử cũ, nhưng sẽ chặn nhận các đơn đặt lịch mới phát sinh cho sân/cơ sở này.
                </span>
              )}
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

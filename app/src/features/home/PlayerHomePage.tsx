import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { getAllSportsApi, type SportItem } from '../sports/sport.api';
import { fetchCourts, type CourtItem } from '../courts/court.api';
import { createWalkInBookingApi } from '../booking/booking.api';
import { useAuthStore } from '../../shared/stores/authStore';
import { formatCurrency } from '../../shared/utils/format';

// Dữ liệu mẫu môn thể thao mặc định (fallback khi chưa khởi động backend)
const DEFAULT_SPORTS: { id: number; name: string; icon: string }[] = [
  { id: 1, name: 'Bóng đá', icon: '⚽' },
  { id: 2, name: 'Cầu lông', icon: '🏸' },
  { id: 3, name: 'Pickleball', icon: '🏓' },
  { id: 4, name: 'Tennis', icon: '🎾' },
  { id: 5, name: 'Bóng rổ', icon: '🏀' },
  { id: 6, name: 'Bóng chuyền', icon: '🏐' },
];

// Danh sách sân mẫu phổ biến (chuẩn theo mockup và CSDL thực tế)
const INITIAL_POPULAR_COURTS: CourtItem[] = [
  {
    court_id: 101,
    court_name: 'Sân An Phú',
    facility_name: 'CLB Thể Thao An Phú',
    address: 'Quận 2, TP.HCM',
    sport_id: 1,
    sport_name: 'Bóng đá',
    price_per_hour: 220000,
    owner_id: 1,
    status: 'ACTIVE',
    rating: 4.8,
    rating_count: 1240,
    images: 'https://images.unsplash.com/photo-1529900245534-5e6922026142?w=500&auto=format&fit=crop&q=80',
    description: 'Sân cỏ nhân tạo 7 người cao cấp chuẩn FIFA, dàn đèn cao áp chống chói.',
  },
  {
    court_id: 102,
    court_name: 'Sân Bình Thạnh',
    facility_name: 'Trung Tâm Thể Thao Bình Thạnh',
    address: 'Bình Thạnh, TP.HCM',
    sport_id: 1,
    sport_name: 'Bóng đá',
    price_per_hour: 200000,
    owner_id: 2,
    status: 'ACTIVE',
    rating: 4.7,
    rating_count: 856,
    images: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=500&auto=format&fit=crop&q=80',
    description: 'Cụm 4 sân bóng đá 5 người mặt cỏ kim cương, bãi đỗ xe ô tô rộng rãi.',
  },
  {
    court_id: 103,
    court_name: 'Sân Phú Nhuận',
    facility_name: 'Sân Vận Động Phú Nhuận',
    address: 'Phú Nhuận, TP.HCM',
    sport_id: 1,
    sport_name: 'Bóng đá',
    price_per_hour: 250000,
    owner_id: 1,
    status: 'ACTIVE',
    rating: 4.6,
    rating_count: 742,
    images: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=500&auto=format&fit=crop&q=80',
    description: 'Mặt sân thoát nước cực tốt, hỗ trợ cho thuê áo pitch và bóng thi đấu.',
  },
  {
    court_id: 104,
    court_name: 'Sân Pickleball SHTP Arena',
    facility_name: 'Trung Tâm Pickleball & Tennis SportLink SHTP',
    address: 'Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM',
    sport_id: 3,
    sport_name: 'Pickleball',
    price_per_hour: 180000,
    owner_id: 2,
    status: 'ACTIVE',
    rating: 4.9,
    rating_count: 512,
    images: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=500&auto=format&fit=crop&q=80',
    description: 'Sân Pickleball mái che cao 8m, mặt sơn Acrylic chuẩn thi đấu quốc tế.',
  },
  {
    court_id: 105,
    court_name: 'CLB Cầu Lông Arena Hiệp Phú',
    facility_name: 'CLB Cầu Lông SportLink Arena Hiệp Phú',
    address: '112 Lê Văn Việt, P. Hiệp Phú, TP. Thủ Đức, TP.HCM',
    sport_id: 2,
    sport_name: 'Cầu lông',
    price_per_hour: 120000,
    owner_id: 1,
    status: 'ACTIVE',
    rating: 4.8,
    rating_count: 930,
    images: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=500&auto=format&fit=crop&q=80',
    description: 'Thảm PVC chuẩn Yonex chống trượt cổ chân, phòng thay đồ và máy lạnh khu chờ.',
  },
  {
    court_id: 106,
    court_name: 'Sân Tennis Mặt Cứng Man Thiện',
    facility_name: 'Cụm Sân Thể Thao Man Thiện',
    address: '106 Đường Man Thiện, P. Tăng Nhơn Phú A, TP. Thủ Đức',
    sport_id: 4,
    sport_name: 'Tennis',
    price_per_hour: 280000,
    owner_id: 1,
    status: 'ACTIVE',
    rating: 4.7,
    rating_count: 360,
    images: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=500&auto=format&fit=crop&q=80',
    description: 'Sân quần vợt Hard Court chất lượng cao, lưới cáp thép chuẩn giải đấu.',
  },
];

// Tọa độ giả lập các pin sân trên bản đồ mini
const MAP_PINS = [
  { id: 101, x: '68%', y: '60%', name: 'Sân An Phú', area: 'Quận 2', sport: 'Bóng đá' },
  { id: 102, x: '35%', y: '45%', name: 'Sân Bình Thạnh', area: 'Bình Thạnh', sport: 'Bóng đá' },
  { id: 103, x: '55%', y: '78%', name: 'Sân Phú Nhuận', area: 'Phú Nhuận', sport: 'Bóng đá' },
  { id: 104, x: '82%', y: '35%', name: 'Pickleball SHTP', area: 'Thủ Đức', sport: 'Pickleball' },
  { id: 105, x: '25%', y: '65%', name: 'Cầu Lông Arena', area: 'Thủ Đức', sport: 'Cầu lông' },
];

export default function PlayerHomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // 1. Quản lý State cho Bộ lọc tìm kiếm
  const [keyword, setKeyword] = useState('');
  const [selectedSportId, setSelectedSportId] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // 2. Danh sách môn thể thao & Danh sách sân từ API
  const [sportsList, setSportsList] = useState<{ id: number; name: string }[]>([]);
  const [courts, setCourts] = useState<CourtItem[]>(INITIAL_POPULAR_COURTS);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 3. Pin bản đồ được click chọn
  const [activePin, setActivePin] = useState<number | null>(101);

  // 4. Modal đặt sân nhanh
  const [bookingCourt, setBookingCourt] = useState<CourtItem | null>(null);
  const [bookingStartTime, setBookingStartTime] = useState('17:00');
  const [bookingEndTime, setBookingEndTime] = useState('18:30');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [bookingErrorMsg, setBookingErrorMsg] = useState<string | null>(null);

  // Lấy danh mục môn thể thao từ Backend (hoặc dùng fallback)
  useEffect(() => {
    getAllSportsApi()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSportsList(data.map((s) => ({ id: s.sport_id, name: s.sport_name })));
        } else {
          setSportsList(DEFAULT_SPORTS.map((s) => ({ id: s.id, name: s.name })));
        }
      })
      .catch(() => {
        setSportsList(DEFAULT_SPORTS.map((s) => ({ id: s.id, name: s.name })));
      });
  }, []);

  // Tải danh sách sân từ API khi mở trang
  useEffect(() => {
    fetchCourts()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          // Bổ sung ảnh và rating mặc định nếu backend trả về null
          const enriched = data.map((c, idx) => ({
            ...c,
            rating: c.rating || Number((4.6 + (idx % 4) * 0.1).toFixed(1)),
            rating_count: c.rating_count || 500 + (idx * 137) % 800,
            images:
              c.images ||
              INITIAL_POPULAR_COURTS[idx % INITIAL_POPULAR_COURTS.length].images,
          }));
          setCourts(enriched);
        }
      })
      .catch(() => {
        // Giữ fallback INITIAL_POPULAR_COURTS
      });
  }, []);

  // Thực hiện tìm kiếm khi người dùng bấm nút Tìm kiếm
  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setLoadingCourts(true);
    setHasSearched(true);

    try {
      const params: { keyword?: string; sport_id?: string } = {};
      if (keyword.trim()) params.keyword = keyword.trim();
      if (selectedSportId !== 'ALL') params.sport_id = selectedSportId;

      const data = await fetchCourts(params);
      if (Array.isArray(data) && data.length > 0) {
        const enriched = data.map((c, idx) => ({
          ...c,
          rating: c.rating || Number((4.6 + (idx % 4) * 0.1).toFixed(1)),
          rating_count: c.rating_count || 600 + (idx * 115) % 700,
          images:
            c.images ||
            INITIAL_POPULAR_COURTS[idx % INITIAL_POPULAR_COURTS.length].images,
        }));
        setCourts(enriched);
      } else {
        // Lọc client-side trên danh sách hiện tại nếu backend chưa đủ data
        const filtered = INITIAL_POPULAR_COURTS.filter((c) => {
          const matchKw =
            !keyword.trim() ||
            c.court_name.toLowerCase().includes(keyword.toLowerCase()) ||
            (c.address || '').toLowerCase().includes(keyword.toLowerCase()) ||
            (c.facility_name || '').toLowerCase().includes(keyword.toLowerCase());
          const matchSport =
            selectedSportId === 'ALL' || String(c.sport_id) === String(selectedSportId);
          return matchKw && matchSport;
        });
        setCourts(filtered);
      }
    } catch {
      // Fallback lọc client-side
      const filtered = INITIAL_POPULAR_COURTS.filter((c) => {
        const matchKw =
          !keyword.trim() ||
          c.court_name.toLowerCase().includes(keyword.toLowerCase()) ||
          (c.address || '').toLowerCase().includes(keyword.toLowerCase());
        const matchSport =
          selectedSportId === 'ALL' || String(c.sport_id) === String(selectedSportId);
        return matchKw && matchSport;
      });
      setCourts(filtered);
    } finally {
      setLoadingCourts(false);
    }
  }

  // Danh sách 3 sân hiển thị ở cột "Sân bóng phổ biến" bên phải
  const popularThreeCourts = useMemo(() => {
    return courts.slice(0, 3);
  }, [courts]);

  // Xử lý xác nhận đặt sân nhanh
  async function handleConfirmQuickBooking() {
    if (!bookingCourt) return;
    if (!user) {
      navigate('/login');
      return;
    }

    setBookingSubmitting(true);
    setBookingErrorMsg(null);
    setBookingSuccessMsg(null);

    try {
      await createWalkInBookingApi({
        courtId: bookingCourt.court_id,
        bookingDate: selectedDate,
        startTime: bookingStartTime,
        endTime: bookingEndTime,
        customerName: user.fullName,
        customerEmail: user.email,
      });

      setBookingSuccessMsg(
        `Chúc mừng bạn đã đặt thành công sân "${bookingCourt.court_name}" ngày ${selectedDate} (${bookingStartTime} - ${bookingEndTime})!`
      );
      setTimeout(() => {
        setBookingCourt(null);
        setBookingSuccessMsg(null);
      }, 2500);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setBookingErrorMsg(
        errorObj.response?.data?.message ||
          'Không thể hoàn tất đặt sân. Khung giờ này có thể đã kín hoặc xảy ra lỗi kết nối.'
      );
    } finally {
      setBookingSubmitting(false);
    }
  }

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* =========================================================================
          1. HERO BANNER: NỀN XANH SẪM KẾT HỢP ẢNH nenHomePage.png TRONG THƯ MỤC PUBLIC
          ========================================================================= */}
      <section className="relative w-full overflow-hidden bg-gradient-to-r from-[#0a2756] via-[#0d3b7e] to-[#1457ba] text-white pt-10 pb-20 sm:pb-24 lg:pt-14 lg:pb-28">
        {/* Nền ảnh nenHomePage.png được định vị ở phía bên phải có hiệu ứng góc bo và độ tương phản cao */}
        <div className="absolute right-0 top-0 bottom-0 w-full lg:w-3/5 pointer-events-none select-none overflow-hidden opacity-35 lg:opacity-45 mix-blend-screen flex items-center justify-end">
          <img
            src="/nenHomePage.png"
            alt="SportLink Sports Illustration"
            className="h-full w-full object-cover object-right filter brightness-110 contrast-125"
          />
        </div>

        {/* Lớp phủ Gradient mềm mịn để chữ bên trái luôn hiển thị rõ ràng, sắc nét */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a2756] via-[#0a2756]/85 to-transparent pointer-events-none" />

        {/* Nội dung tiêu đề chính của Hero Banner */}
        <div className="relative z-10 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            {/* Tag nhỏ ⚡ Ứng dụng quản lý sân thể thao */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-md text-amber-300 border border-white/10 mb-4 shadow-xs">
              <span>⚡</span>
              <span>Ứng dụng quản lý sân thể thao</span>
            </div>

            {/* Tiêu đề chính lớn */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Khám phá <span className="text-[#38bdf8] font-black">sân thể thao</span>.<br />
              Định vị trực quan quanh bạn.
            </h1>

            {/* Đoạn mô tả phụ */}
            <p className="mt-3.5 text-sm sm:text-base lg:text-lg text-blue-100 font-normal leading-relaxed max-w-xl">
              Dễ dàng tìm kiếm, đặt sân, quản lý sân bóng và tham gia cáp kèo cùng cộng đồng thể thao năng động.
            </p>
          </div>
        </div>

        {/* =========================================================================
            2. THANH TÌM KIẾM NỔI (FLOATING SEARCH BAR CHUẨN MOCKUP)
            Gồm: Tìm tên sân/địa chỉ | Chọn môn thể thao | Chọn ngày | Nút Tìm kiếm
            ========================================================================= */}
        <div className="relative z-20 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 -mb-32 sm:-mb-36 mt-8 sm:mt-12">
          <form
            onSubmit={handleSearch}
            className="bg-white rounded-2xl md:rounded-full shadow-2xl border border-gray-100 p-2 sm:p-2.5 flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-0 transition-all hover:shadow-blue-500/10"
          >
            {/* Ô nhập 1: Tên sân, đường, khu vực */}
            <div className="flex-1 flex items-center gap-3 px-4 py-2 sm:py-2.5">
              <svg
                className="w-5 h-5 text-gray-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Tìm tên sân, đường, khu vực..."
                className="w-full text-sm font-medium text-gray-800 placeholder-gray-400 bg-transparent focus:outline-none"
              />
              {keyword && (
                <button
                  type="button"
                  onClick={() => setKeyword('')}
                  className="text-gray-400 hover:text-gray-600 text-xs p-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Đường phân cách dọc 1 */}
            <div className="hidden md:block w-px h-8 bg-gray-200" />

            {/* Ô chọn 2: Môn thể thao */}
            <div className="flex items-center gap-2.5 px-4 py-2 sm:py-2.5 relative">
              <svg
                className="w-5 h-5 text-gray-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <select
                value={selectedSportId}
                onChange={(e) => setSelectedSportId(e.target.value)}
                className="text-sm font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer pr-4 appearance-none"
              >
                <option value="ALL">Tất cả môn thể thao</option>
                {sportsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <svg
                className="w-4 h-4 text-gray-400 pointer-events-none -ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            {/* Đường phân cách dọc 2 */}
            <div className="hidden md:block w-px h-8 bg-gray-200" />

            {/* Ô chọn 3: Ngày đặt */}
            <div className="flex items-center gap-2.5 px-4 py-2 sm:py-2.5 relative">
              <svg
                className="w-5 h-5 text-gray-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.8" />
                <path strokeWidth="1.8" strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm font-semibold text-gray-700 bg-transparent focus:outline-none cursor-pointer pr-2"
              />
            </div>

            {/* Nút bấm 4: Tìm kiếm màu xanh dương nổi bật */}
            <button
              type="submit"
              disabled={loadingCourts}
              className="bg-[#1d63ed] hover:bg-blue-700 text-white font-bold text-sm px-7 py-3 rounded-xl md:rounded-full flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>{loadingCourts ? 'Đang tìm...' : 'Tìm kiếm'}</span>
            </button>
          </form>
        </div>
      </section>

      {/* =========================================================================
          3. NỘI DUNG CHÍNH: 3 KHỐI GIAO DIỆN CHUẨN MOCKUP
          Cột trái: Tính năng nổi bật | Cột giữa: Bản đồ trực quan | Cột phải: Sân bóng phổ biến
          ========================================================================= */}
      <section className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-12 flex-1">
        {/* Banner thông báo kết quả tìm kiếm nếu người dùng đã bấm Tìm kiếm */}
        {hasSearched && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-blue-600 font-bold text-sm">
                🔍 Kết quả tìm kiếm: Tìm thấy {courts.length} sân thể thao phù hợp
              </span>
              {keyword && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white border border-blue-200 text-blue-700">
                  Từ khóa: "{keyword}"
                </span>
              )}
              {selectedSportId !== 'ALL' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white border border-blue-200 text-blue-700">
                  Môn: {sportsList.find((s) => String(s.id) === selectedSportId)?.name}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setKeyword('');
                setSelectedSportId('ALL');
                setCourts(INITIAL_POPULAR_COURTS);
                setHasSearched(false);
              }}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              Đặt lại bộ lọc
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* -------------------------------------------------------------
              CỘT 1 (Trái - 3.5 cols): TÍNH NĂNG NỔI BẬT (2x2 GRID)
              ------------------------------------------------------------- */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-gray-200/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-5">
              <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                ★
              </span>
              <h2 className="text-base font-bold text-gray-900">Tính năng nổi bật</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1">
              {/* 1. Đặt sân nhanh chóng */}
              <div className="bg-[#f8fafc] hover:bg-blue-50/60 p-4 rounded-xl border border-gray-100 transition-colors flex flex-col justify-between">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-lg mb-3 shadow-xs">
                  ⚡
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-gray-900 leading-snug">
                    Đặt sân nhanh chóng
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1 leading-relaxed">
                    Chỉ vài thao tác đơn giản
                  </p>
                </div>
              </div>

              {/* 2. Quản lý dễ dàng */}
              <div className="bg-[#f8fafc] hover:bg-green-50/60 p-4 rounded-xl border border-gray-100 transition-colors flex flex-col justify-between">
                <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center text-lg mb-3 shadow-xs">
                  📅
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-gray-900 leading-snug">
                    Quản lý dễ dàng
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1 leading-relaxed">
                    Lịch đặt sân trực quan
                  </p>
                </div>
              </div>

              {/* 3. Cáp kèo tiện lợi */}
              <div className="bg-[#f8fafc] hover:bg-purple-50/60 p-4 rounded-xl border border-gray-100 transition-colors flex flex-col justify-between">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-lg mb-3 shadow-xs">
                  👥
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-gray-900 leading-snug">
                    Cáp kèo tiện lợi
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1 leading-relaxed">
                    Kết nối cùng người chơi
                  </p>
                </div>
              </div>

              {/* 4. An toàn & Tin cậy */}
              <div className="bg-[#f8fafc] hover:bg-amber-50/60 p-4 rounded-xl border border-gray-100 transition-colors flex flex-col justify-between">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center text-lg mb-3 shadow-xs">
                  🛡️
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-gray-900 leading-snug">
                    An toàn & Tin cậy
                  </h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-1 leading-relaxed">
                    Thông tin minh bạch
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------------
              CỘT 2 (Giữa - 4.5 cols): BẢN ĐỒ TRỰC QUAN ĐỊNH VỊ SÂN
              ------------------------------------------------------------- */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-4 border border-gray-200/90 shadow-xs flex flex-col relative overflow-hidden">
            {/* Nút Xem bản đồ nổi trên góc phải */}
            <div className="flex items-center justify-between mb-3 z-10">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                Bản đồ khu vực
              </span>
              <Link
                to="/courts"
                className="bg-white/95 hover:bg-white text-blue-600 font-bold text-xs px-3.5 py-1.5 rounded-full shadow-md border border-gray-200 flex items-center gap-1.5 transition-all"
              >
                <span>📍</span>
                <span>Xem bản đồ</span>
              </Link>
            </div>

            {/* Không gian mô phỏng bản đồ tương tác với các Ghim sân bóng */}
            <div className="relative flex-1 min-h-[280px] rounded-xl overflow-hidden bg-[#eaf2f8] border border-blue-100 select-none">
              {/* Lưới đường sá & sông ngòi cách điệu */}
              <svg className="absolute inset-0 w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
                {/* Con sông Sài Gòn cách điệu */}
                <path
                  d="M-20,180 Q120,120 220,190 T450,140"
                  fill="none"
                  stroke="#93c5fd"
                  strokeWidth="24"
                  strokeLinecap="round"
                />
                {/* Các trục đại lộ chính */}
                <line x1="0" y1="90" x2="500" y2="120" stroke="#fcd34d" strokeWidth="6" />
                <line x1="180" y1="0" x2="260" y2="350" stroke="#fcd34d" strokeWidth="6" />
                <line x1="60" y1="0" x2="380" y2="350" stroke="#cbd5e1" strokeWidth="4" />
                <line x1="0" y1="260" x2="500" y2="220" stroke="#cbd5e1" strokeWidth="4" />
                {/* Khu vực công viên / mảng xanh */}
                <rect x="240" y="80" width="60" height="50" rx="8" fill="#dcfce7" />
                <rect x="340" y="220" width="70" height="40" rx="8" fill="#dcfce7" />
              </svg>

              {/* Vị trí radar trung tâm của Người dùng */}
              <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                style={{ left: '50%', top: '52%' }}
              >
                <div className="w-16 h-16 bg-blue-500/20 rounded-full animate-ping absolute" />
                <div className="w-8 h-8 bg-blue-500/40 rounded-full flex items-center justify-center">
                  <div className="w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white shadow-md" />
                </div>
              </div>

              {/* Các Pin sân bóng rải rác trên bản đồ */}
              {MAP_PINS.map((pin) => {
                const isSelected = activePin === pin.id;
                return (
                  <button
                    key={pin.id}
                    onClick={() => setActivePin(pin.id)}
                    style={{ left: pin.x, top: pin.y }}
                    className={`absolute transform -translate-x-1/2 -translate-y-1/2 group transition-transform ${
                      isSelected ? 'scale-125 z-20' : 'hover:scale-110 z-10'
                    }`}
                  >
                    {/* Icon bóng đá trong vòng tròn đen trắng */}
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shadow-lg border-2 ${
                        isSelected
                          ? 'bg-blue-600 border-white text-white'
                          : 'bg-[#0f172a] border-white text-white'
                      }`}
                    >
                      <span className="text-xs">⚽</span>
                    </div>

                    {/* Tooltip hiển thị tên sân khi hover hoặc được chọn */}
                    <div
                      className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-md whitespace-nowrap shadow-md pointer-events-none transition-opacity ${
                        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {pin.name} ({pin.area})
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Thông tin sân được chọn trên bản đồ */}
            <div className="mt-3 flex items-center justify-between text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
              <span className="font-semibold text-gray-800">
                📍 {MAP_PINS.find((p) => p.id === activePin)?.name || 'Sân thể thao gần bạn'}
              </span>
              <span className="text-blue-600 font-bold">5 sân trong bán kính 3km</span>
            </div>
          </div>

          {/* -------------------------------------------------------------
              CỘT 3 (Phải - 4 cols): SÂN BÓNG PHỔ BIẾN (DANH SÁCH SÂN CHUẨN MOCKUP)
              ------------------------------------------------------------- */}
          <div className="lg:col-span-4 bg-white rounded-2xl p-6 border border-gray-200/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-amber-500 text-lg font-bold">🏆</span>
                <h2 className="text-base font-bold text-gray-900">Sân bóng phổ biến</h2>
              </div>
              <Link
                to="/courts"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
              >
                <span>Xem tất cả</span>
                <span>→</span>
              </Link>
            </div>

            {/* Danh sách 3 sân nổi bật */}
            <div className="flex flex-col gap-3.5 flex-1">
              {popularThreeCourts.map((court) => (
                <div
                  key={court.court_id}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition border border-transparent hover:border-gray-100"
                >
                  {/* Ảnh thu nhỏ của sân */}
                  <img
                    src={court.images}
                    alt={court.court_name}
                    className="w-16 h-14 rounded-lg object-cover shrink-0 shadow-xs border border-gray-100"
                  />

                  {/* Thông tin tên sân, địa điểm, sao đánh giá */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                      {court.court_name}
                    </h3>
                    <p className="text-[11px] text-gray-500 truncate mt-0.5 flex items-center gap-1">
                      <span>📍</span>
                      <span>{court.address || court.facility_name}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-amber-400 text-xs font-bold">★</span>
                      <span className="text-[11px] font-bold text-gray-700">
                        {court.rating || '4.8'}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        ({(court.rating_count || 1200).toLocaleString()} đánh giá)
                      </span>
                    </div>
                  </div>

                  {/* Nút Đặt ngay màu xanh tròn trịa theo mockup */}
                  <button
                    onClick={() => setBookingCourt(court)}
                    className="bg-[#1d63ed] hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-full transition-all shrink-0 shadow-xs active:scale-95"
                  >
                    Đặt ngay
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. FOOTER BANNER: KẾT NỐI ĐAM MÊ THỂ THAO, XÂY DỰNG CỘNG ĐỒNG VỮNG MẠNH
          ========================================================================= */}
      <footer className="w-full bg-[#f1f5f9] border-t border-gray-200 mt-auto py-4">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
              👥
            </span>
            <span className="font-bold text-gray-800">SportLink</span>
            <span>–</span>
            <span>Kết nối đam mê thể thao, xây dựng cộng đồng vững mạnh!</span>
          </div>

          <div className="flex items-center gap-4 text-gray-500">
            <span>© 2026 SportLink Platform</span>
            <span>•</span>
            <Link to="/courts" className="hover:text-blue-600">
              Danh sách sân
            </Link>
            <span>•</span>
            <Link to="/matches" className="hover:text-blue-600">
              Cáp kèo
            </Link>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          5. MODAL ĐẶT SÂN NHANH KHI BẤM NÚT "ĐẶT NGAY"
          ========================================================================= */}
      {bookingCourt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                  Đặt sân trực tuyến
                </span>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                  {bookingCourt.court_name}
                </h3>
              </div>
              <button
                onClick={() => setBookingCourt(null)}
                className="text-gray-400 hover:text-gray-600 text-lg p-1 rounded-full hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-sm">
              <div className="bg-gray-50 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Môn thể thao</p>
                  <p className="font-bold text-gray-800">{bookingCourt.sport_name || 'Bóng đá'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Mức giá tham khảo</p>
                  <p className="font-bold text-blue-600">
                    {formatCurrency(bookingCourt.price_per_hour || 200000)}/h
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ngày đặt sân
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Giờ bắt đầu
                  </label>
                  <select
                    value={bookingStartTime}
                    onChange={(e) => setBookingStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {['06:00', '07:30', '09:00', '15:00', '16:30', '17:00', '18:00', '19:30', '20:00'].map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Giờ kết thúc
                  </label>
                  <select
                    value={bookingEndTime}
                    onChange={(e) => setBookingEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {['07:30', '09:00', '10:30', '16:30', '18:00', '18:30', '19:30', '21:00', '21:30'].map(
                      (t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {bookingErrorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-medium">
                  ⚠️ {bookingErrorMsg}
                </div>
              )}

              {bookingSuccessMsg && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-medium">
                  ✓ {bookingSuccessMsg}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setBookingCourt(null)}
                className="px-4 py-2 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={bookingSubmitting}
                onClick={handleConfirmQuickBooking}
                className="px-5 py-2.5 rounded-lg text-xs font-bold bg-[#1d63ed] text-white hover:bg-blue-700 transition shadow-md active:scale-95 disabled:opacity-50"
              >
                {bookingSubmitting ? 'Đang xử lý...' : 'Xác nhận đặt sân'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

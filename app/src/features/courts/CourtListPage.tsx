import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router';
import { fetchCourts, type CourtItem } from './court.api';
import { getAllSportsApi } from '../sports/sport.api';
import { formatCurrency } from '../../shared/utils/format';
import { createWalkInBookingApi } from '../booking/booking.api';
import { useAuthStore } from '../../shared/stores/authStore';

export default function CourtListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();

  const [keyword, setKeyword] = useState(searchParams.get('keyword') || '');
  const [selectedSport, setSelectedSport] = useState(searchParams.get('sport_id') || 'ALL');
  const [sports, setSports] = useState<{ id: number; name: string }[]>([]);
  const [courts, setCourts] = useState<CourtItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal đặt sân nhanh
  const [bookingCourt, setBookingCourt] = useState<CourtItem | null>(null);
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookingStartTime, setBookingStartTime] = useState('17:00');
  const [bookingEndTime, setBookingEndTime] = useState('18:30');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [bookingErrorMsg, setBookingErrorMsg] = useState<string | null>(null);

  // Tải danh mục thể thao
  useEffect(() => {
    getAllSportsApi()
      .then((data) => {
        if (Array.isArray(data)) {
          setSports(data.map((s) => ({ id: s.sport_id, name: s.sport_name })));
        }
      })
      .catch(() => {});
  }, []);

  // Tải danh sách sân theo bộ lọc
  useEffect(() => {
    setLoading(true);
    const params: { keyword?: string; sport_id?: string } = {};
    if (keyword.trim()) params.keyword = keyword.trim();
    if (selectedSport !== 'ALL') params.sport_id = selectedSport;

    fetchCourts(params)
      .then((data) => {
        if (Array.isArray(data)) {
          setCourts(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [keyword, selectedSport]);

  // Xử lý tìm kiếm
  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newParams: Record<string, string> = {};
    if (keyword.trim()) newParams.keyword = keyword.trim();
    if (selectedSport !== 'ALL') newParams.sport_id = selectedSport;
    setSearchParams(newParams);
  }

  // Xác nhận đặt sân
  async function handleConfirmBooking() {
    if (!bookingCourt) return;
    if (!user) {
      alert('Vui lòng đăng nhập để đặt sân!');
      return;
    }

    setBookingSubmitting(true);
    setBookingErrorMsg(null);
    setBookingSuccessMsg(null);

    try {
      await createWalkInBookingApi({
        courtId: bookingCourt.court_id,
        bookingDate,
        startTime: bookingStartTime,
        endTime: bookingEndTime,
        customerName: user.fullName,
        customerEmail: user.email,
      });

      setBookingSuccessMsg(`Đặt sân "${bookingCourt.court_name}" thành công!`);
      setTimeout(() => {
        setBookingCourt(null);
        setBookingSuccessMsg(null);
      }, 2000);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setBookingErrorMsg(
        errorObj.response?.data?.message || 'Không thể đặt sân vào khung giờ này.'
      );
    } finally {
      setBookingSubmitting(false);
    }
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Tiêu đề & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link to="/" className="hover:text-blue-600">
              Trang chủ
            </Link>
            <span>/</span>
            <span className="text-gray-900 font-semibold">Danh sách sân thể thao</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Khám phá & Đặt sân thể thao
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tìm kiếm sân bóng đá, cầu lông, pickleball, tennis và các sân thể thao chất lượng quanh bạn
          </p>
        </div>

        <Link
          to="/"
          className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 self-start sm:self-auto"
        >
          ← Quay lại Trang chủ
        </Link>
      </div>

      {/* Thanh bộ lọc tìm kiếm */}
      <form
        onSubmit={handleFilterSubmit}
        className="mt-6 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row items-center gap-3"
      >
        <div className="flex-1 w-full flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo tên sân, cơ sở, địa chỉ..."
            className="w-full text-sm bg-transparent focus:outline-none text-gray-800"
          />
        </div>

        <div className="w-full md:w-56 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-2">
          <span className="text-sm">⚽</span>
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="w-full text-sm font-semibold bg-transparent focus:outline-none text-gray-700 cursor-pointer"
          >
            <option value="ALL">Tất cả môn thể thao</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="w-full md:w-auto bg-[#1d63ed] hover:bg-blue-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition shadow-xs shrink-0"
        >
          Lọc sân
        </button>
      </form>

      {/* Danh sách các sân thể thao */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Danh sách sân ({courts.length})
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400 font-medium">Đang tải danh sách sân...</div>
        ) : courts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 p-8">
            <span className="text-4xl">🏟️</span>
            <p className="mt-3 text-base font-bold text-gray-800">Không tìm thấy sân phù hợp</p>
            <p className="text-sm text-gray-500 mt-1">
              Thử tìm kiếm với từ khóa khác hoặc đặt lại bộ lọc môn thể thao.
            </p>
            <button
              onClick={() => {
                setKeyword('');
                setSelectedSport('ALL');
              }}
              className="mt-4 px-4 py-2 bg-blue-50 text-blue-600 font-bold text-xs rounded-xl hover:bg-blue-100"
            >
              Xem tất cả sân
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courts.map((court) => (
              <div
                key={court.court_id}
                className="bg-white rounded-2xl border border-gray-200/90 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  {/* Ảnh sân */}
                  <div className="relative h-44 w-full bg-gray-100 overflow-hidden">
                    <img
                      src={
                        court.images ||
                        'https://images.unsplash.com/photo-1529900245534-5e6922026142?w=500&auto=format&fit=crop&q=80'
                      }
                      alt={court.court_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-xs text-blue-700 shadow-xs">
                      {court.sport_name || 'Bóng đá'}
                    </span>
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-xs">
                      {court.status || 'ACTIVE'}
                    </span>
                  </div>

                  {/* Chi tiết sân */}
                  <div className="p-5">
                    <h3 className="font-extrabold text-base text-gray-900 group-hover:text-blue-600 transition-colors">
                      {court.court_name}
                    </h3>
                    <p className="text-xs font-semibold text-gray-500 mt-0.5">
                      {court.facility_name || 'Cơ sở trực thuộc'}
                    </p>
                    <p className="text-xs text-gray-600 mt-2 flex items-center gap-1.5">
                      <span>📍</span>
                      <span className="truncate">{court.address || court.facility_address || 'TP. Hồ Chí Minh'}</span>
                    </p>

                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                      <span>Sức chứa: {court.capacity || 10} người</span>
                      <span className="font-bold text-amber-500">★ 4.8</span>
                    </div>
                  </div>
                </div>

                {/* Footer thẻ: Giá & Nút đặt sân */}
                <div className="px-5 pb-5 pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-gray-400 block">Giá từ</span>
                    <span className="text-base font-extrabold text-blue-600">
                      {formatCurrency(court.price_per_hour || 200000)}/h
                    </span>
                  </div>

                  <button
                    onClick={() => setBookingCourt(court)}
                    className="bg-[#1d63ed] hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs active:scale-95"
                  >
                    Đặt ngay
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal đặt sân */}
      {bookingCourt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <span className="text-[11px] font-bold text-blue-600 uppercase">Đặt sân thể thao</span>
                <h3 className="text-lg font-bold text-gray-900 mt-0.5">{bookingCourt.court_name}</h3>
              </div>
              <button
                onClick={() => setBookingCourt(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
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
                  <p className="text-xs text-gray-500">Giá tham khảo</p>
                  <p className="font-bold text-blue-600">{formatCurrency(bookingCourt.price_per_hour || 200000)}/h</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ngày đặt sân</label>
                <input
                  type="date"
                  value={bookingDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Giờ bắt đầu</label>
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
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Giờ kết thúc</label>
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
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                  ⚠️ {bookingErrorMsg}
                </div>
              )}

              {bookingSuccessMsg && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs">
                  ✓ {bookingSuccessMsg}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setBookingCourt(null)}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={bookingSubmitting}
                onClick={handleConfirmBooking}
                className="px-5 py-2.5 rounded-lg text-xs font-bold bg-[#1d63ed] text-white hover:bg-blue-700 transition shadow-md disabled:opacity-50"
              >
                {bookingSubmitting ? 'Đang gửi...' : 'Xác nhận đặt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

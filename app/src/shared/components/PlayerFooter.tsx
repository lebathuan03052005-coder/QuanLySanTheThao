import { Link } from 'react-router';

export default function PlayerFooter() {
  return (
    <footer className="w-full bg-[#0a192f] text-gray-300 border-t border-slate-800 pt-14 pb-8 mt-auto select-none">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        {/* =========================================================================
            PHẦN 1: LƯỚI 4 CỘT THÔNG TIN CHÍNH
            ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10 pb-12 border-b border-slate-800">
          {/* CỘT 1: THƯƠNG HIỆU & THÔNG TIN LIÊN HỆ (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <Link to="/" className="inline-flex items-center gap-2.5 group">
              <img
                src="/logo/logo.png"
                alt="SportLink Logo"
                className="h-9 w-auto object-contain shrink-0"
              />
              <span className="font-black text-2xl tracking-tight text-white group-hover:text-blue-400 transition-colors">
                Sport<span className="text-[#3b82f6]">Link</span>
              </span>
            </Link>

            <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">
              Nền tảng đặt sân thể thao và kết nối cáp kèo thông minh hàng đầu. Giúp người chơi dễ dàng tìm sân, kết nối đối thủ và quản lý lịch thi đấu mọi lúc mọi nơi.
            </p>

            {/* Thông tin liên hệ cụ thể */}
            <div className="space-y-2.5 pt-2 text-xs sm:text-sm">
              <div className="flex items-start gap-2.5 text-gray-300">
                <span className="text-blue-400 mt-0.5 shrink-0">📍</span>
                <span>
                  <strong>Trụ sở chính:</strong> Khu Công Nghệ Cao (SHTP), Xa Lộ Hà Nội, P. Hiệp Phú, TP. Thủ Đức, TP. Hồ Chí Minh
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-300">
                <span className="text-emerald-400 shrink-0">📞</span>
                <span>
                  <strong>Hotline hỗ trợ:</strong>{' '}
                  <a href="tel:19008888" className="text-white hover:text-blue-400 font-semibold underline">
                    1900 8888
                  </a>{' '}
                  -{' '}
                  <a href="tel:0901234567" className="text-white hover:text-blue-400">
                    0901 234 567
                  </a>{' '}
                  <span className="text-xs text-gray-400">(24/7)</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-300">
                <span className="text-amber-400 shrink-0">✉️</span>
                <span>
                  <strong>Email:</strong>{' '}
                  <a href="mailto:support@sportlink.vn" className="text-white hover:text-blue-400">
                    support@sportlink.vn
                  </a>
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-gray-300">
                <span className="text-purple-400 shrink-0">⏰</span>
                <span>
                  <strong>Giờ làm việc:</strong> Thứ Hai – Chủ Nhật (06:00 – 23:00)
                </span>
              </div>
            </div>
          </div>

          {/* CỘT 2: KHÁM PHÁ & DỊCH VỤ (2.5 cols) */}
          <div className="lg:col-span-3 space-y-3.5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Khám phá & Dịch vụ
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <Link to="/courts" className="text-gray-400 hover:text-white transition flex items-center gap-1.5">
                  <span className="text-blue-500">›</span> Tìm kiếm & Đặt sân thể thao
                </Link>
              </li>
              <li>
                <Link to="/matches" className="text-gray-400 hover:text-white transition flex items-center gap-1.5">
                  <span className="text-blue-500">›</span> Cáp kèo tìm đối thủ & đồng đội
                </Link>
              </li>
              <li>
                <Link to="/bookings" className="text-gray-400 hover:text-white transition flex items-center gap-1.5">
                  <span className="text-blue-500">›</span> Lịch đặt sân của tôi
                </Link>
              </li>
              <li>
                <Link to="/news" className="text-gray-400 hover:text-white transition flex items-center gap-1.5">
                  <span className="text-blue-500">›</span> Tin tức & Giải đấu thể thao
                </Link>
              </li>
              <li>
                <Link to="/owner/bookings" className="text-amber-400 hover:text-amber-300 transition flex items-center gap-1.5 font-medium">
                  <span className="text-amber-400">›</span> Dành cho Chủ sân (Đăng ký cụm sân)
                </Link>
              </li>
            </ul>

            <div className="pt-2">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                Các môn thể thao
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {['Bóng đá', 'Cầu lông', 'Pickleball', 'Tennis', 'Bóng rổ', 'Bóng chuyền'].map((sp) => (
                  <Link
                    key={sp}
                    to={`/courts?keyword=${encodeURIComponent(sp)}`}
                    className="text-[11px] px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-blue-600/30 hover:text-blue-300 text-gray-300 transition border border-slate-700/60"
                  >
                    {sp}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* CỘT 3: HỖ TRỢ & CHÍNH SÁCH (2.5 cols) */}
          <div className="lg:col-span-2 space-y-3.5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Chính sách & Hỗ trợ
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li>
                <a href="#rules" className="text-gray-400 hover:text-white transition flex items-center gap-1.5">
                  <span className="text-blue-500">›</span> Hướng dẫn đặt sân trực tuyến
                </a>
              </li>
              <li>
                <a href="#cancellation" className="text-gray-400 hover:text-white transition flex items-center gap-1.5">
                  <span className="text-blue-500">›</span> Quy định hủy sân & hoàn cọc
                </a>
              </li>
              <li>
                <a href="#reputation" className="text-gray-400 hover:text-white transition flex items-center gap-1.5">
                  <span className="text-blue-500">›</span> Điểm uy tín người chơi
                </a>
              </li>
              <li>
                <a href="#privacy" className="text-gray-400 hover:text-white transition flex items-center gap-1.5">
                  <span className="text-blue-500">›</span> Chính sách bảo mật thông tin
                </a>
              </li>
              <li>
                <a href="#terms" className="text-gray-400 hover:text-white transition flex items-center gap-1.5">
                  <span className="text-blue-500">›</span> Điều khoản & Điều kiện sử dụng
                </a>
              </li>
              <li>
                <a href="#faq" className="text-gray-400 hover:text-white transition flex items-center gap-1.5">
                  <span className="text-blue-500">›</span> Câu hỏi thường gặp (FAQ)
                </a>
              </li>
            </ul>
          </div>

          {/* CỘT 4: KẾT NỐI & PHƯƠNG THỨC THANH TOÁN (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Kết nối với SportLink
            </h3>
            <p className="text-xs text-gray-400">
              Theo dõi chúng tôi trên mạng xã hội để nhận các thông tin ưu đãi khung giờ vàng và sự kiện thể thao.
            </p>

            {/* Icon Mạng xã hội */}
            <div className="flex items-center gap-2.5">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-blue-600 text-white flex items-center justify-center transition shadow-xs"
                title="Facebook"
              >
                <svg className="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-600 text-white flex items-center justify-center transition shadow-xs"
                title="YouTube"
              >
                <svg className="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a
                href="https://tiktok.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center transition shadow-xs"
                title="TikTok"
              >
                <svg className="w-4 h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                </svg>
              </a>
              <span className="text-[11px] px-2 py-1 bg-blue-900/60 text-blue-300 font-bold rounded-md border border-blue-700/50">
                Zalo OA
              </span>
            </div>

            {/* Phương thức thanh toán chấp nhận */}
            <div className="pt-2">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                Phương thức thanh toán
              </h4>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-1 rounded bg-slate-800 text-[11px] font-semibold text-white border border-slate-700">
                  VNPay QR
                </span>
                <span className="px-2 py-1 rounded bg-slate-800 text-[11px] font-semibold text-pink-400 border border-slate-700">
                  MoMo
                </span>
                <span className="px-2 py-1 rounded bg-slate-800 text-[11px] font-semibold text-white border border-slate-700">
                  VietQR
                </span>
                <span className="px-2 py-1 rounded bg-slate-800 text-[11px] font-semibold text-white border border-slate-700">
                  Tiền mặt
                </span>
              </div>
            </div>

            {/* Chứng nhận an toàn */}
            <div className="pt-1 flex items-center gap-2 text-[11px] text-emerald-400">
              <span>🛡️</span>
              <span>Bảo mật dữ liệu chuẩn SSL 256-bit</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            PHẦN 2: THANH BẢN QUYỀN DƯỚI CÙNG (COPYRIGHT BAR)
            ========================================================================= */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>
            © 2026 <strong className="text-gray-300">SportLink Platform</strong>. Tất cả các quyền được bảo lưu. Phát triển phục vụ cộng đồng thể thao Việt Nam.
          </p>

          <div className="flex items-center gap-4 text-gray-400">
            <a href="#privacy" className="hover:text-white transition">
              Bảo mật
            </a>
            <span>•</span>
            <a href="#terms" className="hover:text-white transition">
              Điều khoản
            </a>
            <span>•</span>
            <a href="#sitemap" className="hover:text-white transition">
              Sơ đồ trang
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

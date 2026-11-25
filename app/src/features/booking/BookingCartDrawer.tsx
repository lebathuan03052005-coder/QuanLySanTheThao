import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useBookingCartStore } from '../../shared/stores/bookingCartStore';
import { useAuthStore } from '../../shared/stores/authStore';
import {
  getBookingCartQuoteApi,
  checkoutBookingCartApi,
  type BookingCartQuoteResponse,
} from './booking.api';
import { formatCurrency } from '../../shared/utils/format';
import PaymentSandboxModal from './PaymentSandboxModal';

export default function BookingCartDrawer() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, isOpen, setOpen, removeItem, clearCart } = useBookingCartStore();

  const [cartQuote, setCartQuote] = useState<BookingCartQuoteResponse | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<'VNPAY' | 'MOMO' | 'VIETQR' | 'LATER'>('VNPAY');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [activePaymentBooking, setActivePaymentBooking] = useState<{
    bookingId: number;
    courtName: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    totalPrice: number;
    initialTab: 'VNPAY' | 'MOMO' | 'VIETQR';
  } | null>(null);

  // Tự động gọi API báo giá động giỏ đặt sân mỗi khi mở giỏ hoặc danh sách ca thay đổi
  useEffect(() => {
    if (!isOpen || items.length === 0) {
      if (items.length === 0) setCartQuote(null);
      return;
    }

    let cancelled = false;
    setLoadingQuote(true);
    setErrorMsg(null);

    getBookingCartQuoteApi(
      items.map((it) => ({
        cartItemId: it.cartItemId,
        courtId: it.courtId,
        bookingDate: it.bookingDate,
        startTime: it.startTime,
        endTime: it.endTime,
      }))
    )
      .then((res) => {
        if (!cancelled) setCartQuote(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err?.response?.data?.message || 'Không thể tải báo giá động cho giỏ đặt sân.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingQuote(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, items]);

  async function handleCheckoutCart() {
    if (!user) {
      setOpen(false);
      navigate('/login');
      return;
    }
    if (items.length === 0) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await checkoutBookingCartApi({
        items: items.map((it) => ({
          courtId: it.courtId,
          bookingDate: it.bookingDate,
          startTime: it.startTime,
          endTime: it.endTime,
        })),
        paymentMethod: paymentChoice === 'LATER' ? undefined : paymentChoice,
        customerName: user.fullName,
        customerPhone: user.phone,
        customerEmail: user.email,
      });

      const createdList = res.data?.bookings || [];
      const firstBk = createdList[0];

      clearCart();

      if (firstBk && paymentChoice !== 'LATER') {
        setOpen(false);
        setActivePaymentBooking({
          bookingId: firstBk.booking_id,
          courtName:
            createdList.length > 1
              ? `${firstBk.court_name} (+${createdList.length - 1} ca trong giỏ)`
              : firstBk.court_name,
          bookingDate: firstBk.booking_date,
          startTime: firstBk.start_time,
          endTime: firstBk.end_time,
          totalPrice: Number(firstBk.total_price || 200000),
          initialTab: paymentChoice,
        });
      } else {
        setSuccessMsg(
          res.message || `Đã đặt giữ chỗ thành công ${createdList.length} khung giờ!`
        );
        setTimeout(() => {
          setSuccessMsg(null);
          setOpen(false);
          navigate('/bookings');
        }, 1600);
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorMsg(
        errorObj.response?.data?.message ||
          'Một số khung giờ trong giỏ vừa có người đặt hoặc đang bảo trì. Vui lòng kiểm tra lại.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col justify-between overflow-hidden">
            {/* Header Giỏ đặt sân */}
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-lg shadow-md">
                  🛒
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black">
                      Giỏ Đặt Sân Đa Khung Giờ
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/30 border border-blue-400/40 text-cyan-300">
                      {items.length} ca
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Tự động tính giá động theo khung giờ thường / cao điểm / lễ (TC01)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Danh sách các ca trong giỏ */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 bg-slate-50">
              {items.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8">
                  <div className="text-4xl mb-3">🛒</div>
                  <h4 className="text-base font-black text-slate-800">
                    Giỏ đặt sân của bạn đang trống
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                    Bạn có thể chọn nhiều khung giờ hoặc nhiều sân khác nhau tại trang Chi tiết cơ sở hoặc Danh sách sân rồi thêm vào giỏ để tính tổng tiền tự động.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate('/courts');
                    }}
                    className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    + Khám phá & Chọn khung giờ sân
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>
                      Đã chọn <strong className="text-slate-800">{items.length} khung giờ</strong>
                    </span>
                    <button
                      type="button"
                      onClick={clearCart}
                      className="text-rose-600 hover:underline font-bold cursor-pointer"
                    >
                      🗑️ Xóa toàn bộ giỏ
                    </button>
                  </div>

                  {items.map((item, idx) => {
                    const quoted = cartQuote?.items?.find(
                      (q) =>
                        q.cartItemId === item.cartItemId ||
                        (Number(q.courtId) === Number(item.courtId) &&
                          q.bookingDate === item.bookingDate &&
                          q.startTime === item.startTime &&
                          q.endTime === item.endTime)
                    );
                    const finalPrice = quoted?.totalPrice ?? item.estimatedPrice;
                    const isAvail = quoted ? quoted.isAvailable : true;

                    return (
                      <div
                        key={item.cartItemId}
                        className={`p-4 rounded-2xl bg-white border transition shadow-2xs ${
                          !isAvail
                            ? 'border-red-300 bg-red-50/40'
                            : 'border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-bold">
                                Ca #{idx + 1} • {item.sportName}
                              </span>
                              {quoted && (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    quoted.dayType === 'HOLIDAY'
                                      ? 'bg-rose-100 text-rose-700'
                                      : quoted.dayType === 'WEEKEND'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-blue-50 text-blue-700'
                                  }`}
                                >
                                  {quoted.dayType === 'HOLIDAY'
                                    ? 'Ngày lễ'
                                    : quoted.dayType === 'WEEKEND'
                                    ? 'Cuối tuần'
                                    : 'Ngày thường'}
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  isAvail
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {isAvail ? '✓ Sẵn sàng' : '⚠️ Trùng lịch / Bảo trì'}
                              </span>
                            </div>

                            <h4 className="font-extrabold text-sm text-slate-900 mt-1.5">
                              {item.courtName}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              🏢 {item.facilityName}
                            </p>
                            <p className="text-xs font-bold text-blue-700 mt-1">
                              📅 {item.bookingDate} • ⏰ {item.startTime} – {item.endTime}
                              {quoted ? ` (${quoted.durationHours} giờ)` : ''}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeItem(item.cartItemId)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                            title="Xóa khỏi giỏ"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Chi tiết bóc tách giá động từng lát cắt 30 phút (TC01) */}
                        {quoted?.slotBreakdown && quoted.slotBreakdown.length > 0 && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                            <p className="text-[11px] font-bold text-slate-500 mb-1">
                              Chi tiết bóc tách giá động (bước 30 phút):
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {quoted.slotBreakdown.map((sb, sIdx) => (
                                <span
                                  key={sIdx}
                                  className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                    sb.isPeak
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {sb.slot}: {formatCurrency(sb.slotPrice)}
                                  {sb.isPeak ? ' (Cao điểm)' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {!isAvail && quoted?.conflictReason && (
                          <p className="mt-2 text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                            ⚠️ {quoted.conflictReason}
                          </p>
                        )}

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Thành tiền tự động:</span>
                          <strong className="text-sm font-black text-blue-700">
                            {formatCurrency(finalPrice)}
                          </strong>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  ✅ {successMsg}
                </div>
              )}
            </div>

            {/* Footer Tổng tiền tự động & Thanh toán Giỏ đặt sân */}
            {items.length > 0 && (
              <div className="p-5 border-t border-slate-200 bg-white space-y-3.5">
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Tổng số ca đặt sân:</span>
                    <strong className="text-slate-900">
                      {cartQuote?.totalItems ?? items.length} ca ({cartQuote?.totalDurationHours ?? 0} giờ)
                    </strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tiền cọc giữ sân đề xuất (30%):</span>
                    <strong className="text-slate-800">
                      {formatCurrency(
                        cartQuote?.totalDepositSuggested ??
                          Math.round(
                            items.reduce((s, i) => s + i.estimatedPrice, 0) * 0.3
                          )
                      )}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center pt-1.5 border-t border-blue-200">
                    <span className="font-bold text-blue-950 text-sm">
                      Tổng tiền giỏ đặt sân:
                    </span>
                    <strong className="text-lg font-black text-blue-700">
                      {loadingQuote
                        ? 'Đang tính...'
                        : formatCurrency(
                            cartQuote?.totalCartPrice ??
                              items.reduce((s, i) => s + i.estimatedPrice, 0)
                          )}
                    </strong>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Chọn phương thức thanh toán:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(
                      [
                        { id: 'VNPAY', label: '🏦 VNPay Sandbox' },
                        { id: 'MOMO', label: '👛 MoMo Sandbox' },
                        { id: 'VIETQR', label: '📲 VietQR Dự phòng' },
                        { id: 'LATER', label: '⏳ Đặt giữ chỗ trước' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentChoice(m.id)}
                        className={`p-2 rounded-xl border text-left font-bold transition cursor-pointer ${
                          paymentChoice === m.id
                            ? 'border-blue-600 bg-blue-50 text-blue-800'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    submitting ||
                    loadingQuote ||
                    (cartQuote !== null && !cartQuote.allAvailable)
                  }
                  onClick={handleCheckoutCart}
                  className="w-full py-3.5 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs sm:text-sm shadow-lg shadow-blue-600/30 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? 'Đang khóa Transaction & tạo đơn...'
                    : cartQuote && !cartQuote.allAvailable
                    ? '⚠️ Vui lòng xóa ca bị trùng / bảo trì trong giỏ'
                    : paymentChoice === 'LATER'
                    ? `⚡ Xác nhận đặt giữ chỗ (${items.length} ca)`
                    : `⚡ Đặt sân & Thanh toán (${items.length} ca - ${paymentChoice})`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activePaymentBooking && (
        <PaymentSandboxModal
          isOpen={Boolean(activePaymentBooking)}
          bookingId={activePaymentBooking.bookingId}
          courtName={activePaymentBooking.courtName}
          bookingDate={activePaymentBooking.bookingDate}
          startTime={activePaymentBooking.startTime}
          endTime={activePaymentBooking.endTime}
          totalPrice={activePaymentBooking.totalPrice}
          initialTab={activePaymentBooking.initialTab}
          onClose={() => {
            setActivePaymentBooking(null);
            navigate('/bookings');
          }}
          onPaymentSuccess={() => {
            setActivePaymentBooking(null);
            navigate('/bookings');
          }}
        />
      )}
    </>
  );
}

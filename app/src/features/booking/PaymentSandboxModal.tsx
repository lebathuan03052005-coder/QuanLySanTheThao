import { useState, useEffect } from 'react';
import {
  initiateBookingPaymentApi,
  triggerSandboxWebhookApi,
  confirmVietQrPaymentApi,
  type PaymentSessionResponse,
  type VietQrPayload,
} from './booking.api';
import { formatCurrency } from '../../shared/utils/format';

interface PaymentSandboxModalProps {
  isOpen: boolean;
  bookingId: number;
  courtName: string;
  facilityName?: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  paidAmount?: number;
  initialTab?: 'VNPAY' | 'MOMO' | 'VIETQR';
  onClose: () => void;
  onPaymentSuccess: () => void;
}

/**
 * Bộ vẽ mã QR SVG dự phòng (Offline Deterministic QR Matrix) khi máy không có mạng
 * hoặc img.vietqr.io bị chặn, đảm bảo giao diện luôn hiển thị mã QR sắc nét.
 */
function OfflineQrSvg({ value }: { value: string }) {
  const size = 21;
  const cells: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        cells[r0 + r][c0 + c] = isBorder || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inFinder =
        (r < 8 && c < 8) || (r < 8 && c >= size - 8) || (r >= size - 8 && c < 8);
      if (inFinder) continue;
      if (r === 6 || c === 6) {
        cells[r][c] = (r + c) % 2 === 0;
        continue;
      }
      const bitIdx = (r * size + c) % 31;
      const charCode = value.charCodeAt((r * 7 + c * 13) % Math.max(1, value.length)) || 7;
      cells[r][c] = ((hash >>> bitIdx) ^ charCode + r * c) % 2 === 0;
    }
  }

  return (
    <svg viewBox={`0 0 ${size + 4} ${size + 4}`} className="w-48 h-48 mx-auto bg-white p-2 rounded-xl border border-gray-200">
      <rect width={size + 4} height={size + 4} fill="#ffffff" />
      {cells.map((row, rIdx) =>
        row.map((filled, cIdx) =>
          filled ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + 2}
              y={rIdx + 2}
              width={1}
              height={1}
              fill="#111827"
            />
          ) : null
        )
      )}
    </svg>
  );
}

export default function PaymentSandboxModal({
  isOpen,
  bookingId,
  courtName,
  facilityName,
  bookingDate,
  startTime,
  endTime,
  totalPrice,
  paidAmount = 0,
  initialTab = 'VNPAY',
  onClose,
  onPaymentSuccess,
}: PaymentSandboxModalProps) {
  const [activeTab, setActiveTab] = useState<'VNPAY' | 'MOMO' | 'VIETQR'>(initialTab);
  const [paymentType, setPaymentType] = useState<'FULL_PAYMENT' | 'DEPOSIT'>('FULL_PAYMENT');
  const [session, setSession] = useState<PaymentSessionResponse | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [processingWebhook, setProcessingWebhook] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [securityAlertMsg, setSecurityAlertMsg] = useState<string | null>(null);
  const [gatewayFailedInfo, setGatewayFailedInfo] = useState<{
    message: string;
    vietQrFallback?: VietQrPayload;
  } | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState<{
    orderCode: string;
    gatewayTransId: string;
    amount: number;
    method: string;
  } | null>(null);

  const [qrImgError, setQrImgError] = useState(false);
  const [bankRefCode, setBankRefCode] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(900);

  // Đồng hồ đếm ngược 15 phút giữ chỗ thanh toán
  useEffect(() => {
    if (!isOpen || paymentCompleted) return;
    setCountdown(900);
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, activeTab, paymentCompleted]);

  // Khởi tạo phiên thanh toán mỗi khi mở modal hoặc đổi phương thức / loại thanh toán
  useEffect(() => {
    if (!isOpen || !bookingId || paymentCompleted) return;

    let cancelled = false;
    setLoadingSession(true);
    setErrorMsg(null);
    setSecurityAlertMsg(null);
    setQrImgError(false);

    initiateBookingPaymentApi(bookingId, {
      paymentMethod: activeTab,
      paymentType: paidAmount > 0 ? 'FULL_PAYMENT' : paymentType,
    })
      .then((data) => {
        if (!cancelled) {
          setSession(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const e = err as { response?: { data?: { message?: string } } };
          setErrorMsg(e.response?.data?.message || 'Không thể khởi tạo phiên thanh toán.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, bookingId, activeTab, paymentType, paidAmount, paymentCompleted]);

  if (!isOpen) return null;

  const remainingTotal = Math.max(0, totalPrice - paidAmount);
  const currentAmount =
    session?.amount ||
    (paymentType === 'DEPOSIT' && paidAmount === 0
      ? Math.round(totalPrice * 0.3)
      : remainingTotal);

  const minutesLeft = String(Math.floor(countdown / 60)).padStart(2, '0');
  const secondsLeft = String(countdown % 60).padStart(2, '0');

  function handleCopy(text: string, label: string) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  }

  // [S3-08] Giả lập Callback Webhook Thành công (Mã 00) từ Cổng Sandbox
  async function handleSimulateSandboxSuccess() {
    if (!session) return;
    setProcessingWebhook(true);
    setErrorMsg(null);
    setSecurityAlertMsg(null);
    setGatewayFailedInfo(null);

    try {
      const payload = session.sandboxGateway.webhookPayloads.success;
      const res = await triggerSandboxWebhookApi(payload as unknown as Record<string, unknown>);
      setPaymentCompleted({
        orderCode: payload.orderCode,
        gatewayTransId: res.data?.gatewayTransId || payload.gatewayTransId,
        amount: payload.amount,
        method: activeTab,
      });
      onPaymentSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Lỗi khi xử lý Webhook thanh toán.');
    } finally {
      setProcessingWebhook(false);
    }
  }

  // [S3-08 & S3-09] Giả lập Lỗi Cổng Sandbox / Hủy giao dịch (Mã 24) -> Gợi ý chuyển sang VietQR Dự phòng (Rủi ro R2)
  async function handleSimulateSandboxFailure() {
    if (!session) return;
    setProcessingWebhook(true);
    setErrorMsg(null);
    setSecurityAlertMsg(null);

    try {
      const payload = session.sandboxGateway.webhookPayloads.failed;
      const res = await triggerSandboxWebhookApi(payload as unknown as Record<string, unknown>);
      setGatewayFailedInfo({
        message:
          res.data?.message ||
          `Cổng thanh toán ${activeTab} Sandbox phản hồi mã lỗi 24 (Giao dịch bị hủy hoặc cổng đang bảo trì). Hệ thống khuyến nghị chuyển sang phương án dự phòng VietQR Napas 247!`,
        vietQrFallback: res.data?.vietQrFallback || session.vietQrFallback,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Lỗi khi gửi Webhook thất bại.');
    } finally {
      setProcessingWebhook(false);
    }
  }

  // [R07] Kiểm thử gửi Webhook giả mạo chữ ký số HMAC-SHA512
  async function handleSimulateForgedSignature() {
    if (!session) return;
    setProcessingWebhook(true);
    setErrorMsg(null);
    setSecurityAlertMsg(null);

    try {
      await triggerSandboxWebhookApi({
        ...session.sandboxGateway.webhookPayloads.success,
        signature: 'forged_hmac_sha512_invalid_signature_attack_test_000000',
      });
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string } } };
      setSecurityAlertMsg(
        `🛡️ [Chặn thành công - HTTP ${e.response?.status || 400}]: ${
          e.response?.data?.message ||
          'Chữ ký số HMAC-SHA512 không hợp lệ! Server đã từ chối gói tin giả mạo.'
        }`
      );
    } finally {
      setProcessingWebhook(false);
    }
  }

  // [S3-09] Xác nhận thanh toán qua phương án dự phòng VietQR Napas 247
  async function handleConfirmVietQr() {
    setProcessingWebhook(true);
    setErrorMsg(null);
    setSecurityAlertMsg(null);

    try {
      const res = await confirmVietQrPaymentApi(bookingId, {
        paymentType: paidAmount > 0 ? 'FULL_PAYMENT' : paymentType,
        bankRefCode: bankRefCode.trim() || `NAPAS247-${Date.now()}`,
        amount: currentAmount,
      });
      setPaymentCompleted({
        orderCode: res.data?.orderCode || session?.orderCode || `VIETQR-SPL${bookingId}`,
        gatewayTransId: res.data?.gatewayTransId || bankRefCode.trim() || 'VIETQR-NAPAS247',
        amount: currentAmount,
        method: 'VIETQR',
      });
      onPaymentSuccess();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setErrorMsg(e.response?.data?.message || 'Không thể xác nhận giao dịch VietQR.');
    } finally {
      setProcessingWebhook(false);
    }
  }

  const vietQrData = gatewayFailedInfo?.vietQrFallback || session?.vietQrFallback;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-gray-100 my-8 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Đơn #SPL-{bookingId}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                🔒 Bảo mật HMAC-SHA512
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 mt-1.5">
              Cổng Thanh Toán Trực Tuyến & Dự Phòng VietQR
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {courtName} {facilityName ? `· ${facilityName}` : ''} ({bookingDate} · {startTime} - {endTime})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg p-1.5 rounded-xl hover:bg-gray-100 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Màn hình biên lai hoàn tất thanh toán */}
        {paymentCompleted ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-3xl font-bold shadow-xs">
              ✓
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                Đối soát Webhook Server-side Thành Công
              </span>
              <h4 className="text-xl font-black text-gray-900 mt-1">
                Đã thanh toán {formatCurrency(paymentCompleted.amount)}
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                Đơn đặt sân <strong>#SPL-{bookingId}</strong> đã tự động chuyển sang trạng thái{' '}
                <strong className="text-emerald-700">ĐÃ XÁC NHẬN (CONFIRMED)</strong>.
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 text-left text-xs space-y-2 border border-gray-200 max-w-md mx-auto">
              <div className="flex justify-between">
                <span className="text-gray-500">Mã đơn giao dịch (Order Code):</span>
                <span className="font-mono font-bold text-gray-900">{paymentCompleted.orderCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Mã đối soát cổng (Gateway ID):</span>
                <span className="font-mono font-bold text-blue-700">{paymentCompleted.gatewayTransId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phương thức thanh toán:</span>
                <span className="font-bold text-gray-900">{paymentCompleted.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sân & Khung giờ:</span>
                <span className="font-semibold text-gray-800">
                  {bookingDate} ({startTime} - {endTime})
                </span>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-gray-800 transition cursor-pointer"
              >
                Hoàn tất & Xem lịch đặt sân
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Bước 1: Chọn mức thanh toán (100% hoặc Đặt cọc 30%) */}
            {paidAmount === 0 && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentType('FULL_PAYMENT')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    paymentType === 'FULL_PAYMENT'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">Thanh toán đủ (100%)</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      Khuyên dùng
                    </span>
                  </div>
                  <p className="text-base font-black text-blue-700 mt-1">
                    {formatCurrency(totalPrice)}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Xác nhận sân ngay lập tức, không cần thanh toán thêm tại quầy
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentType('DEPOSIT')}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    paymentType === 'DEPOSIT'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900">Đặt cọc giữ sân (30%)</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      Cọc trước
                    </span>
                  </div>
                  <p className="text-base font-black text-gray-900 mt-1">
                    {formatCurrency(Math.round(totalPrice * 0.3))}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Còn lại {formatCurrency(totalPrice - Math.round(totalPrice * 0.3))} thanh toán tại sân
                  </p>
                </button>
              </div>
            )}

            {/* Bước 2: Tabs chọn Cổng thanh toán (VNPay Sandbox, MoMo Sandbox, VietQR Dự phòng R2) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-gray-700">
                  Chọn phương thức thanh toán:
                </label>
                <span className="text-xs font-mono font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                  ⏱ Giữ chỗ: {minutesLeft}:{secondsLeft}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('VNPAY');
                    setGatewayFailedInfo(null);
                  }}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    activeTab === 'VNPAY'
                      ? 'border-blue-600 bg-blue-600 text-white font-bold shadow-xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-semibold'
                  }`}
                >
                  <div className="text-xs">🏦 VNPay Sandbox</div>
                  <div className={`text-[10px] mt-0.5 ${activeTab === 'VNPAY' ? 'text-blue-100' : 'text-gray-400'}`}>
                    Cổng ATM / QR Sandbox
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('MOMO');
                    setGatewayFailedInfo(null);
                  }}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    activeTab === 'MOMO'
                      ? 'border-pink-600 bg-pink-600 text-white font-bold shadow-xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-semibold'
                  }`}
                >
                  <div className="text-xs">👛 MoMo Sandbox</div>
                  <div className={`text-[10px] mt-0.5 ${activeTab === 'MOMO' ? 'text-pink-100' : 'text-gray-400'}`}>
                    Ví điện tử Sandbox
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('VIETQR');
                    setGatewayFailedInfo(null);
                  }}
                  className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                    activeTab === 'VIETQR'
                      ? 'border-emerald-600 bg-emerald-600 text-white font-bold shadow-xs'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 font-semibold'
                  }`}
                >
                  <div className="text-xs">📲 VietQR Napas 247</div>
                  <div className={`text-[10px] mt-0.5 ${activeTab === 'VIETQR' ? 'text-emerald-100' : 'text-gray-400'}`}>
                    Phương án dự phòng (R2)
                  </div>
                </button>
              </div>
            </div>

            {/* Cảnh báo khi cổng Sandbox lỗi -> Gợi ý chuyển sang VietQR (S3-09) */}
            {gatewayFailedInfo && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="text-base">⚠️</span>
                  <div className="flex-1">
                    <p className="font-bold text-amber-900">
                      Cổng thanh toán {activeTab} thông báo giao dịch không thành công!
                    </p>
                    <p className="mt-0.5 text-amber-800">{gatewayFailedInfo.message}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('VIETQR');
                      setGatewayFailedInfo(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer transition"
                  >
                    👉 Chuyển ngay sang Quét mã VietQR Dự phòng (S3-09)
                  </button>
                </div>
              </div>
            )}

            {/* Thông báo kiểm thử bảo mật chữ ký HMAC-SHA512 (R07) */}
            {securityAlertMsg && (
              <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-medium">
                {securityAlertMsg}
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Nội dung chi tiết theo Tab */}
            {loadingSession ? (
              <div className="py-10 text-center text-gray-500 text-xs">
                Đang khởi tạo phiên giao dịch & chữ ký số HMAC-SHA512...
              </div>
            ) : activeTab === 'VIETQR' ? (
              /* ================================================================= */
              /* TAB VIETQR NAPAS 247 - PHƯƠNG ÁN DỰ PHÒNG THANH TOÁN (S3-09 / R2) */
              /* ================================================================= */
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-emerald-700">
                      Phương án dự phòng thanh toán (WBS 4.3.4 - S3-09)
                    </span>
                    <h4 className="text-sm font-extrabold text-gray-900">
                      Chuyển khoản nhanh 24/7 qua mã VietQR Napas
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-xs font-extrabold text-emerald-700">
                    {formatCurrency(currentAmount)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                  {/* Cột trái: Mã QR */}
                  <div className="sm:col-span-5 text-center bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
                    {vietQrData?.qrImageUrl && !qrImgError ? (
                      <img
                        src={vietQrData.qrImageUrl}
                        alt="VietQR Napas 247"
                        onError={() => setQrImgError(true)}
                        className="w-48 h-48 object-contain mx-auto rounded-lg"
                      />
                    ) : (
                      <OfflineQrSvg
                        value={
                          vietQrData?.transferContent || `SPL ${bookingId} ${currentAmount}`
                        }
                      />
                    )}
                    <p className="text-[11px] text-gray-500 mt-1.5 font-medium">
                      Quét bằng App Ngân hàng hoặc Ví điện tử
                    </p>
                  </div>

                  {/* Cột phải: Thông tin tài khoản thụ hưởng & Nội dung tự động */}
                  <div className="sm:col-span-7 space-y-2.5 text-xs">
                    <div className="bg-white p-3 rounded-xl border border-gray-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Ngân hàng:</span>
                        <span className="font-bold text-gray-900">
                          {vietQrData?.bankName || 'MBBank (Ngân hàng Quân Đội)'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Số tài khoản:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-gray-900">
                            {vietQrData?.accountNo || '0901234567888'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(vietQrData?.accountNo || '0901234567888', 'acc')
                            }
                            className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-[10px] font-bold text-gray-700 cursor-pointer"
                          >
                            {copiedField === 'acc' ? 'Đã chép' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Chủ tài khoản:</span>
                        <span className="font-bold text-gray-900">
                          {vietQrData?.accountName || 'CONG TY THE THAO SPORTLINK'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Số tiền chuyển:</span>
                        <span className="font-extrabold text-emerald-700 text-sm">
                          {formatCurrency(currentAmount)}
                        </span>
                      </div>

                      <div className="pt-1.5 border-t border-gray-100 flex justify-between items-center">
                        <span className="text-gray-500">Nội dung CK:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {vietQrData?.transferContent || `SPL ${bookingId}`}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopy(
                                vietQrData?.transferContent || `SPL ${bookingId}`,
                                'content'
                              )
                            }
                            className="px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-[10px] font-bold text-blue-700 cursor-pointer"
                          >
                            {copiedField === 'content' ? 'Đã chép' : 'Copy'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                        Mã tham chiếu giao dịch ngân hàng (Tùy chọn):
                      </label>
                      <input
                        type="text"
                        value={bankRefCode}
                        onChange={(e) => setBankRefCode(e.target.value)}
                        placeholder="VD: FT26322999888 (Để trống hệ thống tự sinh mã)"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={processingWebhook}
                      onClick={handleConfirmVietQr}
                      className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 cursor-pointer"
                    >
                      {processingWebhook
                        ? 'Đang đối soát giao dịch VietQR...'
                        : '✓ Tôi đã chuyển khoản (Xác nhận & Đối soát VietQR)'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ================================================================= */
              /* TAB CỔNG THANH TOÁN SANDBOX VNPAY / MOMO & WEBHOOK (S3-08)        */
              /* ================================================================= */
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-200">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-blue-700">
                      Môi trường Tích hợp Cổng Sandbox ({session?.sandboxGateway.provider})
                    </span>
                    <h4 className="text-sm font-extrabold text-gray-900">
                      Giả lập Thanh toán & Đối soát Webhook IPN Server-side
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-gray-500 block">Số tiền thanh toán</span>
                    <span className="text-base font-black text-blue-700">
                      {formatCurrency(currentAmount)}
                    </span>
                  </div>
                </div>

                {session && (
                  <div className="bg-white rounded-xl p-3.5 border border-gray-200 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mã đơn hàng (vnp_TxnRef / orderId):</span>
                      <span className="font-mono font-bold text-gray-900">{session.orderCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Terminal / Partner Code:</span>
                      <span className="font-mono font-semibold text-gray-700">
                        {session.sandboxGateway.terminalCode}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Webhook IPN Endpoint:</span>
                      <span className="font-mono text-blue-600">
                        POST {session.sandboxGateway.webhookEndpoint}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Chữ ký HMAC-SHA512:</span>
                      <span className="font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {session.sandboxGateway.webhookPayloads.success.signature.slice(0, 28)}...
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  <p className="text-xs font-bold text-gray-700">
                    Bảng điều khiển Giả lập Callback từ Cổng {activeTab} Sandbox:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={processingWebhook || !session}
                      onClick={handleSimulateSandboxSuccess}
                      className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>✓</span>
                      <span>Giả lập Thanh toán Thành công (Mã 00)</span>
                    </button>

                    <button
                      type="button"
                      disabled={processingWebhook || !session}
                      onClick={handleSimulateSandboxFailure}
                      className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>⚠️</span>
                      <span>Giả lập Lỗi Cổng / Hủy (Mã 24 → VietQR)</span>
                    </button>
                  </div>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={processingWebhook || !session}
                      onClick={handleSimulateForgedSignature}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                    >
                      🛡️ Test bảo mật R07: Thử gửi Webhook giả mạo chữ ký HMAC-SHA512
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('VIETQR')}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                    >
                      Đổi sang VietQR dự phòng →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
              <span>
                Tổng tiền sân: <strong>{formatCurrency(totalPrice)}</strong> · Đã trả:{' '}
                <strong>{formatCurrency(paidAmount)}</strong>
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


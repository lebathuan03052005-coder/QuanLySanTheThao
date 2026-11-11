import { useState, useEffect } from 'react';
import {
  getCourtPricesApi,
  updateCourtPricesApi,
  type CourtItem,
  type CourtPriceRule,
} from './facility.api';

interface CourtPricingModalProps {
  court: CourtItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type TabType = 'NORMAL' | 'WEEKEND' | 'HOLIDAY';

export default function CourtPricingModal({
  court,
  isOpen,
  onClose,
  onSaved,
}: CourtPricingModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('NORMAL');
  const [rules, setRules] = useState<CourtPriceRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && court) {
      loadPrices(court.court_id);
    } else {
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, court]);

  async function loadPrices(courtId: number) {
    try {
      setLoading(true);
      setError(null);
      const data = await getCourtPricesApi(courtId);
      if (data && data.length > 0) {
        setRules(data);
      } else {
        // Áp dụng bộ khung giờ mặc định nếu sân chưa từng có giá
        applyPreset('BADMINTON');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Không thể tải biểu giá sân.');
    } finally {
      setLoading(false);
    }
  }

  // Danh sách các quy tắc thuộc tab đang chọn (chuẩn hóa WEEKDAY thành NORMAL)
  const currentTabRules = rules.filter((r) => {
    const dt = r.day_type === 'WEEKDAY' ? 'NORMAL' : r.day_type;
    return dt === activeTab;
  });

  function handleRuleChange(indexInTab: number, field: keyof CourtPriceRule, value: any) {
    const tabIndices = rules
      .map((r, idx) => {
        const dt = r.day_type === 'WEEKDAY' ? 'NORMAL' : r.day_type;
        return dt === activeTab ? idx : -1;
      })
      .filter((i) => i !== -1);

    const actualIdx = tabIndices[indexInTab];
    if (actualIdx !== undefined) {
      const next = [...rules];
      next[actualIdx] = { ...next[actualIdx], [field]: value };
      setRules(next);
    }
  }

  function handleAddSlot() {
    const lastRule = currentTabRules[currentTabRules.length - 1];
    const newStart = lastRule ? lastRule.end_time : '06:00';
    const newEnd = '23:00';
    const newRule: CourtPriceRule = {
      day_type: activeTab,
      start_time: newStart,
      end_time: newEnd,
      price: lastRule ? lastRule.price : 100000,
    };
    setRules([...rules, newRule]);
  }

  function handleRemoveSlot(indexInTab: number) {
    const tabIndices = rules
      .map((r, idx) => {
        const dt = r.day_type === 'WEEKDAY' ? 'NORMAL' : r.day_type;
        return dt === activeTab ? idx : -1;
      })
      .filter((i) => i !== -1);

    const actualIdx = tabIndices[indexInTab];
    if (actualIdx !== undefined) {
      const next = rules.filter((_, idx) => idx !== actualIdx);
      setRules(next);
    }
  }

  function applyPreset(type: 'FOOTBALL' | 'BADMINTON' | 'TENNIS') {
    let newRules: CourtPriceRule[] = [];
    if (type === 'FOOTBALL') {
      newRules = [
        { day_type: 'NORMAL', start_time: '06:00', end_time: '16:00', price: 200000 },
        { day_type: 'NORMAL', start_time: '16:00', end_time: '21:00', price: 350000 },
        { day_type: 'NORMAL', start_time: '21:00', end_time: '23:00', price: 280000 },
        { day_type: 'WEEKEND', start_time: '06:00', end_time: '16:00', price: 280000 },
        { day_type: 'WEEKEND', start_time: '16:00', end_time: '23:00', price: 420000 },
        { day_type: 'HOLIDAY', start_time: '06:00', end_time: '23:00', price: 480000 },
      ];
    } else if (type === 'TENNIS') {
      newRules = [
        { day_type: 'NORMAL', start_time: '06:00', end_time: '16:00', price: 150000 },
        { day_type: 'NORMAL', start_time: '16:00', end_time: '22:00', price: 260000 },
        { day_type: 'NORMAL', start_time: '22:00', end_time: '23:00', price: 180000 },
        { day_type: 'WEEKEND', start_time: '06:00', end_time: '16:00', price: 220000 },
        { day_type: 'WEEKEND', start_time: '16:00', end_time: '23:00', price: 320000 },
        { day_type: 'HOLIDAY', start_time: '06:00', end_time: '23:00', price: 360000 },
      ];
    } else {
      // BADMINTON / PICKLEBALL
      newRules = [
        { day_type: 'NORMAL', start_time: '06:00', end_time: '16:00', price: 80000 },
        { day_type: 'NORMAL', start_time: '16:00', end_time: '21:00', price: 140000 },
        { day_type: 'NORMAL', start_time: '21:00', end_time: '23:00', price: 110000 },
        { day_type: 'WEEKEND', start_time: '06:00', end_time: '16:00', price: 120000 },
        { day_type: 'WEEKEND', start_time: '16:00', end_time: '23:00', price: 160000 },
        { day_type: 'HOLIDAY', start_time: '06:00', end_time: '23:00', price: 180000 },
      ];
    }
    setRules(newRules);
    setSuccessMsg(`Đã áp dụng mẫu biểu phí ${type === 'FOOTBALL' ? 'Bóng đá' : type === 'TENNIS' ? 'Tennis' : 'Cầu lông / Pickleball'}. Nhớ bấm Lưu biểu giá!`);
  }

  async function handleSave() {
    if (!court) return;
    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      if (rules.length === 0) {
        throw new Error('Vui lòng thiết lập ít nhất 1 khung giờ tính giá.');
      }

      await updateCourtPricesApi(court.court_id, rules);
      setSuccessMsg('Đã lưu cấu hình biểu giá thành công!');
      if (onSaved) onSaved();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Lỗi khi lưu bảng giá.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen || !court) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="px-6 py-5 bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <h3 className="text-lg font-extrabold tracking-tight">Cấu hình Biểu phí Động (WBS 3.2)</h3>
            </div>
            <p className="text-xs text-teal-100/90 mt-1">
              Sân: <strong className="text-white">{court.court_name}</strong> • Môn: <strong className="text-white">{court.sport_name || 'Thể thao'}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Nội dung cấu hình */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
              <span>✅</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Preset nhanh */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                ⚡ Áp dụng nhanh Biểu giá mẫu (Presets)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('FOOTBALL')}
                className="px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200/80 rounded-xl transition-colors cursor-pointer text-center"
              >
                ⚽ Sân Bóng đá
              </button>
              <button
                type="button"
                onClick={() => applyPreset('BADMINTON')}
                className="px-3 py-2 text-xs font-bold text-cyan-800 bg-cyan-100/80 hover:bg-cyan-200/80 rounded-xl transition-colors cursor-pointer text-center"
              >
                🏸 Cầu lông / Pickleball
              </button>
              <button
                type="button"
                onClick={() => applyPreset('TENNIS')}
                className="px-3 py-2 text-xs font-bold text-indigo-800 bg-indigo-100/80 hover:bg-indigo-200/80 rounded-xl transition-colors cursor-pointer text-center"
              >
                🎾 Sân Tennis
              </button>
            </div>
          </div>

          {/* Tabs loại ngày */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('NORMAL')}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                activeTab === 'NORMAL'
                  ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              📅 Ngày thường (T2 - T6)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('WEEKEND')}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                activeTab === 'WEEKEND'
                  ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🌟 Cuối tuần (T7, CN)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HOLIDAY')}
              className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                activeTab === 'HOLIDAY'
                  ? 'bg-teal-700 text-white shadow-md shadow-teal-700/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              🎉 Ngày lễ Quốc gia
            </button>
          </div>

          {/* Danh sách các khung giờ trong tab */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Các khung giờ áp dụng ({currentTabRules.length} khung):
              </span>
              <button
                type="button"
                onClick={handleAddSlot}
                className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
              >
                <span>➕ Thêm khung giờ</span>
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Đang tải dữ liệu biểu giá...</div>
            ) : currentTabRules.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Chưa có quy tắc giá nào cho loại ngày này. Bấm "Thêm khung giờ" hoặc chọn Preset mẫu ở trên.
              </div>
            ) : (
              <div className="space-y-2.5">
                {currentTabRules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center gap-3"
                  >
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <div className="flex items-center gap-2 flex-1">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Từ giờ</label>
                        <input
                          type="time"
                          value={rule.start_time}
                          onChange={(e) => handleRuleChange(idx, 'start_time', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-teal-600"
                        />
                      </div>
                      <span className="text-slate-400 font-bold mt-3">➔</span>
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Đến giờ</label>
                        <input
                          type="time"
                          value={rule.end_time}
                          onChange={(e) => handleRuleChange(idx, 'end_time', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 focus:outline-teal-600"
                        />
                      </div>
                    </div>

                    <div className="w-36">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Đơn giá (đ/giờ)</label>
                      <input
                        type="number"
                        min="0"
                        step="5000"
                        value={rule.price}
                        onChange={(e) => handleRuleChange(idx, 'price', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-emerald-700 focus:outline-teal-600"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(idx)}
                      title="Xóa khung giờ"
                      className="w-8 h-8 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center transition-colors cursor-pointer shrink-0 mt-3"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Modal */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 italic">
            * Giá sẽ tự động chia đều theo phút khi khách đặt vắt qua biên đổi giá (TC01).
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-xl shadow-md shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>💾 Lưu biểu giá</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

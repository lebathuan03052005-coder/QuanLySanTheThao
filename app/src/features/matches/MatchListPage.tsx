import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  cancelMatch,
  fetchMatchById,
  fetchMatches,
  joinMatch,
  type Match,
} from './match.api';
import { formatCurrency, formatDate } from '../../shared/utils/format';
import { useAuthStore } from '../../shared/stores/authStore';
import Button from '../../shared/components/Button';
import Modal from '../../shared/components/Modal';

/**
 * Trang danh sách Cáp kèo — hiển thị các trận đấu đang tìm người chơi
 * và hỗ trợ mở trực tiếp chi tiết trận đấu khi đi từ thông báo (?matchId=...).
 */
export default function MatchListPage() {
  const { user, token } = useAuthStore();
  const { id: routeMatchId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetMatchId = Number(searchParams.get('matchId') || routeMatchId || 0);

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [highlightedMatchId, setHighlightedMatchId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const data = await fetchMatches();
      setMatches(Array.isArray(data) ? data : []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Mở chi tiết trận đấu & cuộn tới thẻ tương ứng khi đi từ thông báo (?matchId=... hoặc /matches/:id)
  useEffect(() => {
    if (!targetMatchId) return;

    let cancelled = false;
    async function focusTargetMatch() {
      const inList = matches.find((m) => m.id === targetMatchId);
      let detail = inList || null;

      if (!detail) {
        try {
          detail = await fetchMatchById(targetMatchId);
        } catch {
          detail = null;
        }
      }

      if (cancelled || !detail) return;

      setSelectedMatch(detail);
      setHighlightedMatchId(targetMatchId);
      setActionMsg(null);

      window.setTimeout(() => {
        const el = document.getElementById(`match-card-${targetMatchId}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);

      if (searchParams.has('matchId')) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('matchId');
        setSearchParams(nextParams, { replace: true });
      }
    }

    if (!loading) {
      focusTargetMatch();
    }

    return () => {
      cancelled = true;
    };
  }, [targetMatchId, loading, matches]);

  async function handleJoin(matchId: number) {
    if (!token) {
      setActionMsg({ type: 'error', text: 'Vui lòng đăng nhập để tham gia kèo đấu.' });
      return;
    }
    setActionLoading(true);
    setActionMsg(null);
    try {
      await joinMatch(matchId);
      setActionMsg({ type: 'success', text: 'Tham gia kèo đấu thành công!' });
      const refreshed = await fetchMatchById(matchId);
      setSelectedMatch(refreshed);
      await loadAll();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setActionMsg({
        type: 'error',
        text: e.response?.data?.message || 'Không thể tham gia kèo đấu này.',
      });
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel(matchId: number) {
    setActionLoading(true);
    setActionMsg(null);
    try {
      await cancelMatch(matchId);
      setActionMsg({ type: 'success', text: 'Đã hủy kèo đấu.' });
      const refreshed = await fetchMatchById(matchId);
      setSelectedMatch(refreshed);
      await loadAll();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setActionMsg({
        type: 'error',
        text: e.response?.data?.message || 'Không thể hủy kèo đấu này.',
      });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-20 text-gray-400">Đang tải...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Cáp kèo thể thao</h1>
        <Link to="/matches/create">
          <Button>+ Tạo trận mới</Button>
        </Link>
      </div>

      {matches.length === 0 ? (
        <p className="text-center text-gray-500 py-20">Chưa có trận đấu nào đang mở.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((match) => {
            const isHighlighted = highlightedMatchId === match.id;
            return (
              <div
                id={`match-card-${match.id}`}
                key={match.id}
                onClick={() => {
                  setSelectedMatch(match);
                  setActionMsg(null);
                }}
                className={`bg-white rounded-xl border p-5 hover:shadow-md transition-all cursor-pointer ${
                  isHighlighted
                    ? 'border-blue-500 ring-4 ring-blue-500/20 shadow-lg'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-green-600">
                    {match.sport}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-gray-400">
                    #M-{match.id}
                  </span>
                </div>
                <p className="mt-1 text-gray-800 font-semibold">
                  {formatDate(match.matchDate)}
                </p>
                {match.courtName && (
                  <p className="text-xs text-gray-600 mt-0.5 truncate">📍 {match.courtName}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">
                  Còn {match.slots} chỗ trống
                </p>
                <span
                  className={`inline-block mt-3 text-xs px-2.5 py-1 rounded-full font-medium ${
                    match.status === 'open'
                      ? 'bg-green-100 text-green-700'
                      : match.status === 'cancelled'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {match.status === 'open'
                    ? 'Đang mở'
                    : match.status === 'cancelled'
                      ? 'Đã hủy'
                      : 'Đã đầy'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal chi tiết Kèo đấu (Mở trực tiếp khi click card hoặc đi từ Thông báo) */}
      <Modal
        isOpen={Boolean(selectedMatch)}
        onClose={() => {
          setSelectedMatch(null);
          setActionMsg(null);
        }}
        title={selectedMatch ? `Chi tiết kèo đấu #M-${selectedMatch.id}` : 'Chi tiết kèo đấu'}
      >
        {selectedMatch && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-gray-100">
              <span className="px-2.5 py-1 rounded-lg bg-green-100 text-green-800 font-bold text-xs">
                {selectedMatch.sport}
              </span>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  selectedMatch.status === 'open'
                    ? 'bg-blue-100 text-blue-700'
                    : selectedMatch.status === 'cancelled'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {selectedMatch.status === 'open'
                  ? 'Đang mở tìm người'
                  : selectedMatch.status === 'cancelled'
                    ? 'Đã hủy'
                    : 'Đã đủ quân'}
              </span>
            </div>

            <div className="space-y-2 text-gray-700">
              {selectedMatch.hostName && (
                <p>
                  <span className="font-semibold text-gray-900">Chủ kèo:</span>{' '}
                  {selectedMatch.hostName}
                </p>
              )}
              {selectedMatch.courtName && (
                <p>
                  <span className="font-semibold text-gray-900">Sân thi đấu:</span>{' '}
                  {selectedMatch.courtName}
                </p>
              )}
              <p>
                <span className="font-semibold text-gray-900">Thời gian bắt đầu:</span>{' '}
                {formatDate(selectedMatch.matchDate)}
              </p>
              {selectedMatch.endTime && (
                <p>
                  <span className="font-semibold text-gray-900">Kết thúc dự kiến:</span>{' '}
                  {formatDate(selectedMatch.endTime)}
                </p>
              )}
              <p>
                <span className="font-semibold text-gray-900">Số người chơi:</span>{' '}
                {selectedMatch.currentPlayers ?? 1} / {selectedMatch.maxPlayers ?? (selectedMatch.slots + 1)} (Còn{' '}
                {selectedMatch.slots} chỗ)
              </p>
              {selectedMatch.level && (
                <p>
                  <span className="font-semibold text-gray-900">Trình độ:</span>{' '}
                  {selectedMatch.level}
                </p>
              )}
              {selectedMatch.estimatedCostPerPerson != null && (
                <p>
                  <span className="font-semibold text-gray-900">Chi phí dự kiến/người:</span>{' '}
                  {formatCurrency(Number(selectedMatch.estimatedCostPerPerson))}
                </p>
              )}
            </div>

            {actionMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  actionMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {actionMsg.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              {selectedMatch.status === 'open' &&
                user &&
                Number(user.id) === Number(selectedMatch.hostId) && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleCancel(selectedMatch.id)}
                    className="px-4 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'Đang xử lý...' : 'Hủy kèo đấu'}
                  </button>
                )}

              {selectedMatch.status === 'open' &&
                (!user || Number(user.id) !== Number(selectedMatch.hostId)) && (
                  <Button
                    disabled={actionLoading}
                    onClick={() => handleJoin(selectedMatch.id)}
                  >
                    {actionLoading ? 'Đang tham gia...' : 'Tham gia kèo ngay'}
                  </Button>
                )}

              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

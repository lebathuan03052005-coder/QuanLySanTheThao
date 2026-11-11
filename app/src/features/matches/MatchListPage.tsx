import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { fetchMatches, type Match } from './match.api';
import { formatDate } from '../../shared/utils/format';
import Button from '../../shared/components/Button';

/**
 * Trang danh sách Cáp kèo — hiển thị các trận đấu đang tìm người chơi.
 */
export default function MatchListPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches()
      .then((data) => setMatches(Array.isArray(data) ? data : []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-center py-20 text-gray-400">Đang tải...</div>;
  }

  return (
    <div>
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
          {matches.map((match) => (
            <Link key={match.id} to={`/matches/${match.id}`}>
              <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <span className="text-xs font-semibold uppercase tracking-wide text-green-600">
                  {match.sport}
                </span>
                <p className="mt-1 text-gray-700 font-medium">
                  {formatDate(match.matchDate)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Còn {match.slots} chỗ trống
                </p>
                <span
                  className={`inline-block mt-3 text-xs px-2 py-1 rounded-full font-medium ${
                    match.status === 'open'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {match.status === 'open' ? 'Đang mở' : 'Đã đầy'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import { getPool } from '../../core/config/db.js';

/**
 * Lấy danh sách các trận đấu (có thể filter theo môn thể thao, khu vực, trạng thái).
 * @param {{ sport?, area?, status? }} filters
 */
export async function getAllMatches(filters = {}) {
  const pool = await getPool();
  const result = await pool.request()
    .query('SELECT * FROM Matches WHERE Status = \'open\' ORDER BY MatchDate ASC');
  return result.recordset;
}

/**
 * Lấy thông tin một trận đấu theo ID.
 * @param {number} matchId
 */
export async function getMatchById(matchId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('id', matchId)
    .query('SELECT * FROM Matches WHERE Id = @id');
  return result.recordset[0] || null;
}

/**
 * Tạo trận đấu mới (Cáp kèo).
 * @param {{ hostId, courtId, sport, matchDate, slots }} data
 */
export async function createMatch(data) {
  const { hostId, courtId, sport, matchDate, slots } = data;
  const pool = await getPool();
  const result = await pool.request()
    .input('hostId', hostId)
    .input('courtId', courtId)
    .input('sport', sport)
    .input('matchDate', matchDate)
    .input('slots', slots)
    .query(`
      INSERT INTO Matches (HostId, CourtId, Sport, MatchDate, Slots, Status, CreatedAt)
      OUTPUT INSERTED.*
      VALUES (@hostId, @courtId, @sport, @matchDate, @slots, 'open', GETDATE())
    `);
  return result.recordset[0];
}

/**
 * Người chơi tham gia trận đấu.
 * @param {number} matchId
 * @param {number} userId
 */
export async function joinMatch(matchId, userId) {
  const pool = await getPool();
  const result = await pool.request()
    .input('matchId', matchId)
    .input('userId', userId)
    .query(`
      INSERT INTO MatchPlayers (MatchId, UserId, JoinedAt)
      OUTPUT INSERTED.*
      VALUES (@matchId, @userId, GETDATE())
    `);
  return result.recordset[0];
}

/**
 * Hủy trận đấu (chỉ host được phép).
 * @param {number} matchId
 * @param {number} userId
 */
export async function cancelMatch(matchId, userId) {
  const pool = await getPool();
  await pool.request()
    .input('id', matchId)
    .input('hostId', userId)
    .query(`UPDATE Matches SET Status = 'cancelled' WHERE Id = @id AND HostId = @hostId`);
}

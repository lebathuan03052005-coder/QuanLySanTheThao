import sql, { getPool } from '../../core/config/db.js';
import { AppError } from '../../core/errors/AppError.js';
import {
  createNotificationSafe,
  createNotificationsForUsers,
} from '../notifications/notification.service.js';

/**
 * Lấy danh sách các trận đấu (có thể filter theo môn thể thao, trạng thái).
 * @param {{ sport?, status? }} filters
 */
export async function getAllMatches(filters = {}) {
  const pool = await getPool();
  const statusFilter = filters.status ? String(filters.status).toUpperCase() : 'OPEN';

  const result = await pool
    .request()
    .input('status', sql.VarChar(20), statusFilter)
    .query(`
      SELECT
        m.match_id AS id,
        m.creator_id AS hostId,
        u.full_name AS hostName,
        m.court_id AS courtId,
        c.court_name AS courtName,
        COALESCE(s.sport_name, N'Thể thao') AS sport,
        m.start_time AS matchDate,
        m.end_time AS endTime,
        CASE
          WHEN m.max_players - ISNULL(m.current_players, 1) > 0
          THEN m.max_players - ISNULL(m.current_players, 1)
          ELSE 0
        END AS slots,
        m.max_players AS maxPlayers,
        ISNULL(m.current_players, 1) AS currentPlayers,
        m.match_type AS matchType,
        m.level,
        m.estimated_cost_per_person AS estimatedCostPerPerson,
        LOWER(ISNULL(m.status, 'OPEN')) AS status
      FROM matches m
      LEFT JOIN courts c ON m.court_id = c.court_id
      LEFT JOIN sports s ON COALESCE(m.sport_id, c.sport_id) = s.sport_id
      LEFT JOIN users u ON m.creator_id = u.user_id
      WHERE UPPER(ISNULL(m.status, 'OPEN')) = @status
      ORDER BY m.start_time ASC
    `);
  return result.recordset;
}

/**
 * Lấy thông tin chi tiết một trận đấu theo ID.
 * @param {number} matchId
 */
export async function getMatchById(matchId) {
  const cleanId = Number(matchId);
  if (!cleanId || Number.isNaN(cleanId)) return null;

  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', sql.Int, cleanId)
    .query(`
      SELECT
        m.match_id AS id,
        m.creator_id AS hostId,
        u.full_name AS hostName,
        m.court_id AS courtId,
        c.court_name AS courtName,
        m.sport_id AS sportId,
        COALESCE(s.sport_name, N'Thể thao') AS sport,
        m.start_time AS matchDate,
        m.end_time AS endTime,
        CASE
          WHEN m.max_players - ISNULL(m.current_players, 1) > 0
          THEN m.max_players - ISNULL(m.current_players, 1)
          ELSE 0
        END AS slots,
        m.max_players AS maxPlayers,
        ISNULL(m.current_players, 1) AS currentPlayers,
        m.match_type AS matchType,
        m.level,
        m.estimated_cost_per_person AS estimatedCostPerPerson,
        LOWER(ISNULL(m.status, 'OPEN')) AS status
      FROM matches m
      LEFT JOIN courts c ON m.court_id = c.court_id
      LEFT JOIN sports s ON COALESCE(m.sport_id, c.sport_id) = s.sport_id
      LEFT JOIN users u ON m.creator_id = u.user_id
      WHERE m.match_id = @id
    `);

  return result.recordset[0] || null;
}

/**
 * Tạo trận đấu mới (Cáp kèo).
 * @param {{ hostId, courtId?, sportId?, sport?, matchDate?, startTime?, endTime?, slots?, maxPlayers?, matchType?, level?, estimatedCostPerPerson? }} data
 */
export async function createMatch(data) {
  const {
    hostId,
    courtId = null,
    sportId = null,
    sport = null,
    matchDate,
    startTime,
    endTime,
    slots,
    maxPlayers,
    matchType = 'FIND_PLAYER',
    level = null,
    estimatedCostPerPerson = null,
  } = data;

  const pool = await getPool();

  // Xác định sport_id hợp lệ
  let resolvedSportId = sportId ? Number(sportId) : null;
  let resolvedSportName = sport ? String(sport).trim() : '';

  if (!resolvedSportId && courtId) {
    const courtRes = await pool
      .request()
      .input('courtId', sql.Int, Number(courtId))
      .query('SELECT sport_id FROM courts WHERE court_id = @courtId');
    resolvedSportId = courtRes.recordset[0]?.sport_id || null;
  }

  if (!resolvedSportId && resolvedSportName) {
    const sportRes = await pool
      .request()
      .input('sportName', sql.NVarChar(100), resolvedSportName)
      .query('SELECT TOP 1 sport_id, sport_name FROM sports WHERE sport_name LIKE @sportName');
    resolvedSportId = sportRes.recordset[0]?.sport_id || null;
  }

  if (!resolvedSportId) {
    const anySportRes = await pool
      .request()
      .query("SELECT TOP 1 sport_id, sport_name FROM sports WHERE UPPER(status) = 'ACTIVE' ORDER BY sport_id ASC");
    resolvedSportId = anySportRes.recordset[0]?.sport_id || null;
    if (!resolvedSportName) {
      resolvedSportName = anySportRes.recordset[0]?.sport_name || 'Thể thao';
    }
  }

  if (!resolvedSportId) {
    throw new AppError('Không tìm thấy môn thể thao hợp lệ để tạo trận đấu.', 400);
  }

  const startDt = startTime ? new Date(startTime) : matchDate ? new Date(matchDate) : new Date();
  const endDt = endTime ? new Date(endTime) : new Date(startDt.getTime() + 60 * 60 * 1000);
  const totalSlots = Math.max(2, Number(maxPlayers || (slots ? Number(slots) + 1 : 4)));
  const cleanMatchType = ['FIND_OPPONENT', 'FIND_PLAYER'].includes(String(matchType).toUpperCase())
    ? String(matchType).toUpperCase()
    : 'FIND_PLAYER';

  const result = await pool
    .request()
    .input('creatorId', sql.Int, Number(hostId))
    .input('sportId', sql.Int, resolvedSportId)
    .input('courtId', sql.Int, courtId ? Number(courtId) : null)
    .input('matchType', sql.VarChar(20), cleanMatchType)
    .input('startTime', sql.DateTime, startDt)
    .input('endTime', sql.DateTime, endDt)
    .input('maxPlayers', sql.Int, totalSlots)
    .input('estimatedCost', sql.Decimal(10, 2), estimatedCostPerPerson != null ? Number(estimatedCostPerPerson) : null)
    .input('level', sql.NVarChar(50), level ? String(level) : null)
    .query(`
      INSERT INTO matches (
        creator_id, sport_id, court_id, match_type, start_time, end_time,
        max_players, current_players, estimated_cost_per_person, level, status, created_at
      )
      OUTPUT INSERTED.*
      VALUES (
        @creatorId, @sportId, @courtId, @matchType, @startTime, @endTime,
        @maxPlayers, 1, @estimatedCost, @level, 'OPEN', GETDATE()
      )
    `);

  const created = result.recordset[0];

  // Tự động thêm chủ kèo vào bảng match_participants
  await pool
    .request()
    .input('matchId', sql.Int, created.match_id)
    .input('userId', sql.Int, Number(hostId))
    .query(`
      INSERT INTO match_participants (match_id, user_id, team_side, payment_status, joined_at)
      VALUES (@matchId, @userId, 'TEAM_A', 'PENDING', GETDATE())
    `);

  await createNotificationSafe(pool, {
    userId: hostId,
    type: 'MATCH',
    link: `/matches?matchId=${created.match_id}`,
    title: `Tạo kèo đấu #M-${created.match_id} thành công`,
    content: `Kèo đấu (${resolvedSportName || 'Thể thao'}) đã được mở tìm người chơi. Hệ thống sẽ báo ngay khi có người tham gia!`,
  });

  return getMatchById(created.match_id);
}

/**
 * Người chơi tham gia trận đấu.
 * @param {number} matchId
 * @param {number} userId
 */
export async function joinMatch(matchId, userId) {
  const cleanMatchId = Number(matchId);
  const cleanUserId = Number(userId);
  if (!cleanMatchId || Number.isNaN(cleanMatchId)) {
    throw new AppError('Mã trận đấu không hợp lệ.', 400);
  }

  const pool = await getPool();

  const matchRes = await pool
    .request()
    .input('matchId', sql.Int, cleanMatchId)
    .query(`
      SELECT m.*, s.sport_name, c.court_name
      FROM matches m
      LEFT JOIN sports s ON m.sport_id = s.sport_id
      LEFT JOIN courts c ON m.court_id = c.court_id
      WHERE m.match_id = @matchId
    `);

  const match = matchRes.recordset[0];
  if (!match) {
    throw new AppError('Không tìm thấy trận đấu.', 404);
  }

  if (String(match.status || 'OPEN').toUpperCase() !== 'OPEN') {
    throw new AppError('Trận đấu này đã đầy hoặc đã bị hủy.', 400);
  }

  const existingRes = await pool
    .request()
    .input('matchId', sql.Int, cleanMatchId)
    .input('userId', sql.Int, cleanUserId)
    .query('SELECT participant_id FROM match_participants WHERE match_id = @matchId AND user_id = @userId');

  if (existingRes.recordset.length > 0) {
    throw new AppError('Bạn đã tham gia trận đấu này rồi.', 409);
  }

  const currentCount = Number(match.current_players || 1);
  if (currentCount >= Number(match.max_players)) {
    throw new AppError('Trận đấu đã đủ số lượng người chơi.', 400);
  }

  const participantRes = await pool
    .request()
    .input('matchId', sql.Int, cleanMatchId)
    .input('userId', sql.Int, cleanUserId)
    .query(`
      INSERT INTO match_participants (match_id, user_id, team_side, payment_status, joined_at)
      OUTPUT INSERTED.*
      VALUES (@matchId, @userId, 'TEAM_B', 'PENDING', GETDATE())
    `);

  const nextPlayers = currentCount + 1;
  const nextStatus = nextPlayers >= Number(match.max_players) ? 'FULL' : 'OPEN';

  await pool
    .request()
    .input('matchId', sql.Int, cleanMatchId)
    .input('currentPlayers', sql.Int, nextPlayers)
    .input('status', sql.VarChar(20), nextStatus)
    .query(`
      UPDATE matches
      SET current_players = @currentPlayers,
          status = @status
      WHERE match_id = @matchId
    `);

  // Lấy tên người tham gia để đưa vào thông báo
  const joinerRes = await pool
    .request()
    .input('uid', sql.Int, cleanUserId)
    .query('SELECT full_name FROM users WHERE user_id = @uid');
  const joinerName = joinerRes.recordset[0]?.full_name || 'Một người chơi';
  const sportLabel = match.sport_name || 'Thể thao';

  // Thông báo cho Host kèo
  if (match.creator_id && Number(match.creator_id) !== cleanUserId) {
    await createNotificationSafe(pool, {
      userId: match.creator_id,
      type: 'MATCH',
      link: `/matches?matchId=${cleanMatchId}`,
      title: `Có người tham gia kèo #M-${cleanMatchId}`,
      content: `${joinerName} vừa tham gia kèo đấu ${sportLabel} của bạn (${nextPlayers}/${match.max_players} người).`,
    });
  }

  // Thông báo xác nhận cho người vừa tham gia
  await createNotificationSafe(pool, {
    userId: cleanUserId,
    type: 'MATCH',
    link: `/matches?matchId=${cleanMatchId}`,
    title: `Tham gia kèo #M-${cleanMatchId} thành công`,
    content: `Bạn đã tham gia kèo đấu ${sportLabel}${match.court_name ? ` tại ${match.court_name}` : ''}.`,
  });

  // Nếu kèo đã đủ người -> Thông báo cho toàn bộ thành viên trong kèo
  if (nextStatus === 'FULL') {
    const membersRes = await pool
      .request()
      .input('matchId', sql.Int, cleanMatchId)
      .query('SELECT user_id FROM match_participants WHERE match_id = @matchId');
    const memberIds = [match.creator_id, ...membersRes.recordset.map((r) => r.user_id)];

    await createNotificationsForUsers(pool, memberIds, {
      type: 'MATCH',
      link: `/matches?matchId=${cleanMatchId}`,
      title: `Kèo đấu #M-${cleanMatchId} đã đủ quân!`,
      content: `Kèo ${sportLabel} đã đủ ${match.max_players}/${match.max_players} thành viên. Hãy chuẩn bị ra sân đúng giờ nhé!`,
    });
  }

  return participantRes.recordset[0];
}

/**
 * Hủy trận đấu (chỉ host được phép).
 * @param {number} matchId
 * @param {number} userId
 */
export async function cancelMatch(matchId, userId) {
  const cleanMatchId = Number(matchId);
  const cleanUserId = Number(userId);
  const pool = await getPool();

  const matchRes = await pool
    .request()
    .input('id', sql.Int, cleanMatchId)
    .query(`
      SELECT m.*, s.sport_name
      FROM matches m
      LEFT JOIN sports s ON m.sport_id = s.sport_id
      WHERE m.match_id = @id
    `);
  const match = matchRes.recordset[0];
  if (!match) {
    throw new AppError('Không tìm thấy trận đấu.', 404);
  }
  if (Number(match.creator_id) !== cleanUserId) {
    throw new AppError('Chỉ chủ kèo mới được phép hủy trận đấu này.', 403);
  }

  await pool
    .request()
    .input('id', sql.Int, cleanMatchId)
    .query(`UPDATE matches SET status = 'CANCELLED' WHERE match_id = @id`);

  const membersRes = await pool
    .request()
    .input('matchId', sql.Int, cleanMatchId)
    .query('SELECT user_id FROM match_participants WHERE match_id = @matchId');
  const otherMemberIds = membersRes.recordset
    .map((r) => Number(r.user_id))
    .filter((uid) => uid !== cleanUserId);

  if (otherMemberIds.length > 0) {
    await createNotificationsForUsers(pool, otherMemberIds, {
      type: 'MATCH',
      link: `/matches?matchId=${cleanMatchId}`,
      title: `Kèo đấu #M-${cleanMatchId} đã bị hủy`,
      content: `Chủ kèo đã hủy trận đấu ${match.sport_name || 'Thể thao'}. Bạn có thể tìm hoặc tạo kèo mới trên SportLink.`,
    });
  }
}

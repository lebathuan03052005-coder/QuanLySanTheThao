import * as matchService from './match.service.js';

export async function getMatches(req, res, next) {
  try {
    const matches = await matchService.getAllMatches(req.query);
    res.json({ success: true, data: matches });
  } catch (err) {
    next(err);
  }
}

export async function getMatchById(req, res, next) {
  try {
    const match = await matchService.getMatchById(req.params.id);
    if (!match) return res.status(404).json({ success: false, message: 'Không tìm thấy trận đấu.' });
    res.json({ success: true, data: match });
  } catch (err) {
    next(err);
  }
}

export async function createMatch(req, res, next) {
  try {
    const match = await matchService.createMatch({ ...req.body, hostId: req.user.id });
    res.status(201).json({ success: true, data: match });
  } catch (err) {
    next(err);
  }
}

export async function joinMatch(req, res, next) {
  try {
    const result = await matchService.joinMatch(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function cancelMatch(req, res, next) {
  try {
    await matchService.cancelMatch(req.params.id, req.user.id);
    res.json({ success: true, message: 'Đã hủy trận đấu.' });
  } catch (err) {
    next(err);
  }
}

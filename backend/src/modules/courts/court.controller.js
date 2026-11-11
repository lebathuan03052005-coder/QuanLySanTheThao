import * as courtService from './court.service.js';

export async function getCourts(req, res, next) {
  try {
    const courts = await courtService.getAllCourts(req.query);
    res.json({ success: true, data: courts });
  } catch (err) {
    next(err);
  }
}

export async function getCourtById(req, res, next) {
  try {
    const court = await courtService.getCourtById(req.params.id);
    if (!court) return res.status(404).json({ success: false, message: 'Không tìm thấy sân.' });
    res.json({ success: true, data: court });
  } catch (err) {
    next(err);
  }
}

export async function createCourt(req, res, next) {
  try {
    const court = await courtService.createCourt({ ...req.body, ownerId: req.user.id });
    res.status(201).json({ success: true, data: court });
  } catch (err) {
    next(err);
  }
}

export async function updateCourt(req, res, next) {
  try {
    const court = await courtService.updateCourt(req.params.id, req.body);
    res.json({ success: true, data: court });
  } catch (err) {
    next(err);
  }
}

export async function deleteCourt(req, res, next) {
  try {
    await courtService.deleteCourt(req.params.id);
    res.json({ success: true, message: 'Đã xóa sân.' });
  } catch (err) {
    next(err);
  }
}

export async function getCourtPrices(req, res, next) {
  try {
    const courtId = parseInt(req.params.id);
    const prices = await courtService.getCourtPrices(courtId);
    res.json({ success: true, data: prices });
  } catch (err) {
    next(err);
  }
}

export async function updateCourtPrices(req, res, next) {
  try {
    const courtId = parseInt(req.params.id);
    const rules = Array.isArray(req.body) ? req.body : req.body.rules;
    const prices = await courtService.updateCourtPrices(courtId, rules);
    res.json({ success: true, data: prices, message: 'Cập nhật biểu giá sân thành công.' });
  } catch (err) {
    next(err);
  }
}

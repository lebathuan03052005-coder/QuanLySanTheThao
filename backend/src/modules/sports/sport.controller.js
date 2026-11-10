import * as sportService from './sport.service.js';

/**
 * ============================================================================
 * SPORTLINK - SPORT TYPE CONTROLLER
 * ============================================================================
 */

export async function getAllSports(req, res, next) {
  try {
    const { search, status } = req.query;
    const sports = await sportService.getAllSports({ search, status });
    res.json({ success: true, data: sports });
  } catch (err) {
    next(err);
  }
}

export async function getOwnerSports(req, res, next) {
  try {
    const { search, status } = req.query;
    const ownerId = req.user.id;
    const sports = await sportService.getOwnerSports(ownerId, { search, status });
    res.json({ success: true, data: sports });
  } catch (err) {
    next(err);
  }
}

export async function getSportById(req, res, next) {
  try {
    const sportId = parseInt(req.params.id);
    const sport = await sportService.getSportById(sportId);
    res.json({ success: true, data: sport });
  } catch (err) {
    next(err);
  }
}

export async function createSport(req, res, next) {
  try {
    const sport = await sportService.createSport(req.body, req.user);
    res.status(201).json({ success: true, data: sport });
  } catch (err) {
    next(err);
  }
}

export async function updateSport(req, res, next) {
  try {
    const sportId = parseInt(req.params.id);
    const updated = await sportService.updateSport(sportId, req.body, req.user);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function updateSportStatus(req, res, next) {
  try {
    const sportId = parseInt(req.params.id);
    const { status } = req.body;
    const updated = await sportService.updateSportStatus(sportId, status, req.user);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

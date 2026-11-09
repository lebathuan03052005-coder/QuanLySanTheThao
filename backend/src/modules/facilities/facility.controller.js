import * as facilityService from './facility.service.js';

/**
 * ============================================================================
 * SPORTLINK - FACILITY & SUB-COURT CONTROLLER
 * ============================================================================
 */

export async function getOwnerFacilities(req, res, next) {
  try {
    const ownerId = req.user.id;
    const { search, status } = req.query;
    const facilities = await facilityService.getOwnerFacilities(ownerId, { search, status });
    res.json({ success: true, data: facilities });
  } catch (err) {
    next(err);
  }
}

export async function getFacilityById(req, res, next) {
  try {
    const ownerId = req.user.id;
    const facilityId = parseInt(req.params.id);
    const facility = await facilityService.getFacilityById(facilityId, ownerId);
    res.json({ success: true, data: facility });
  } catch (err) {
    next(err);
  }
}

export async function createFacility(req, res, next) {
  try {
    const ownerId = req.user.id;
    const facility = await facilityService.createFacility(ownerId, req.body);
    res.status(201).json({ success: true, data: facility });
  } catch (err) {
    next(err);
  }
}

export async function updateFacility(req, res, next) {
  try {
    const ownerId = req.user.id;
    const facilityId = parseInt(req.params.id);
    const updated = await facilityService.updateFacility(facilityId, ownerId, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function updateFacilityStatus(req, res, next) {
  try {
    const ownerId = req.user.id;
    const facilityId = parseInt(req.params.id);
    const { status } = req.body;
    const updated = await facilityService.updateFacilityStatus(facilityId, ownerId, status);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ====================== Sub-court Controllers ======================

export async function getCourtsByFacility(req, res, next) {
  try {
    const ownerId = req.user.id;
    const facilityId = parseInt(req.params.facilityId);
    const { status, sportId } = req.query;
    const courts = await facilityService.getCourtsByFacility(facilityId, ownerId, { status, sportId });
    res.json({ success: true, data: courts });
  } catch (err) {
    next(err);
  }
}

export async function createCourtInFacility(req, res, next) {
  try {
    const ownerId = req.user.id;
    const facilityId = parseInt(req.params.facilityId);
    const court = await facilityService.createCourtInFacility(facilityId, ownerId, req.body);
    res.status(201).json({ success: true, data: court });
  } catch (err) {
    next(err);
  }
}

export async function updateCourtInFacility(req, res, next) {
  try {
    const ownerId = req.user.id;
    const courtId = parseInt(req.params.courtId);
    const updated = await facilityService.updateCourtInFacility(courtId, ownerId, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

export async function updateCourtStatus(req, res, next) {
  try {
    const ownerId = req.user.id;
    const courtId = parseInt(req.params.courtId);
    const { status } = req.body;
    const updated = await facilityService.updateCourtStatus(courtId, ownerId, status);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}


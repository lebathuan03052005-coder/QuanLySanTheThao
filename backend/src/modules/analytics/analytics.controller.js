import * as analyticsService from './analytics.service.js';

export async function getRevenueDashboard(req, res, next) {
  try {
    const data = await analyticsService.getRevenueDashboard(req.user, req.query);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOccupancyAnalytics(req, res, next) {
  try {
    const data = await analyticsService.getOccupancyAnalytics(req.user, req.query);
    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
}


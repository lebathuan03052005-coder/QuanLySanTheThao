import * as staffService from './staff.service.js';

export async function getStaffList(req, res, next) {
  try {
    const list = await staffService.getStaffList(req.user.id, req.query);
    res.json({
      success: true,
      data: list,
    });
  } catch (err) {
    next(err);
  }
}

export async function getStaffById(req, res, next) {
  try {
    const staffId = parseInt(req.params.id);
    const staff = await staffService.getStaffById(req.user.id, staffId);
    res.json({
      success: true,
      data: staff,
    });
  } catch (err) {
    next(err);
  }
}

export async function createStaff(req, res, next) {
  try {
    const staff = await staffService.createStaff(req.user.id, req.body);
    res.status(201).json({
      success: true,
      message: 'Tạo tài khoản nhân viên và phân công sân thành công.',
      data: staff,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStaff(req, res, next) {
  try {
    const staffId = parseInt(req.params.id);
    const staff = await staffService.updateStaff(req.user.id, staffId, req.body);
    res.json({
      success: true,
      message: 'Cập nhật thông tin và phân công nhân viên thành công.',
      data: staff,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateStaffStatus(req, res, next) {
  try {
    const staffId = parseInt(req.params.id);
    const result = await staffService.updateStaffStatus(req.user.id, staffId, req.body.status);
    res.json({
      success: true,
      message: `Đã cập nhật trạng thái nhân viên thành '${result.status}'.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getOwnerCourts(req, res, next) {
  try {
    const courts = await staffService.getOwnerCourts(req.user.id);
    res.json({
      success: true,
      data: courts,
    });
  } catch (err) {
    next(err);
  }
}

import * as facilityService from './facility.service.js';
import { AppError } from '../../core/errors/AppError.js';

/**
 * ============================================================================
 * SPORTLINK - FACILITY & SUB-COURT CONTROLLER
 * ============================================================================
 */

export async function getPublicFacilities(req, res, next) {
  try {
    const facilities = await facilityService.getPublicFacilities();
    res.json({ success: true, data: facilities });
  } catch (err) {
    next(err);
  }
}

export async function getPublicFacilityDetail(req, res, next) {
  try {
    const facilityId = parseInt(req.params.id);
    const facility = await facilityService.getPublicFacilityById(facilityId);
    if (!facility) {
      return res.status(404).json({ success: false, message: 'Cơ sở không tồn tại hoặc đã ngừng hoạt động' });
    }
    res.json({ success: true, data: facility });
  } catch (err) {
    next(err);
  }
}

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

export async function uploadFacilityImage(req, res, next) {
  try {
    const rawFiles = req.files || (req.file ? [req.file] : []);
    const fileList = Array.isArray(rawFiles)
      ? rawFiles
      : typeof rawFiles === 'object'
      ? Object.values(rawFiles).flat()
      : [];

    if (fileList.length === 0) {
      throw new AppError('Vui lòng chọn ít nhất một file hình ảnh để tải lên.', 400);
    }

    const ownerId = req.user.id;
    const facilityId = parseInt(req.params.id);
    const imageUrls = fileList.map((f) => `/uploads/facilities/${f.filename}`);
    const images = await facilityService.addFacilityImage(facilityId, ownerId, imageUrls);

    res.json({
      success: true,
      message: `Đã tải lên ${imageUrls.length} ảnh cơ sở thành công.`,
      data: {
        imageUrl: imageUrls[0],
        imageUrls,
        images,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteFacilityImage(req, res, next) {
  try {
    const ownerId = req.user.id;
    const facilityId = parseInt(req.params.id);
    const imageUrl = req.body.imageUrl || req.query.imageUrl;
    if (!imageUrl) {
      throw new AppError('Đường dẫn ảnh cần xóa không được để trống.', 400);
    }
    const images = await facilityService.deleteFacilityImage(facilityId, ownerId, imageUrl);
    res.json({
      success: true,
      message: 'Xóa ảnh cơ sở thành công.',
      data: { images },
    });
  } catch (err) {
    next(err);
  }
}

export async function uploadCourtImage(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('Vui lòng chọn file hình ảnh sân con hợp lệ.', 400);
    }
    const ownerId = req.user.id;
    const courtId = parseInt(req.params.courtId);
    const imageUrl = `/uploads/courts/${req.file.filename}`;
    const updated = await facilityService.updateCourtImage(courtId, ownerId, imageUrl);
    res.json({
      success: true,
      message: 'Cập nhật ảnh sân con thành công.',
      data: { courtId, imageUrl },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteCourtImage(req, res, next) {
  try {
    const ownerId = req.user.id;
    const courtId = parseInt(req.params.courtId);
    await facilityService.deleteCourtImage(courtId, ownerId);
    res.json({
      success: true,
      message: 'Đã xóa ảnh sân con thành công.',
      data: { courtId, imageUrl: null },
    });
  } catch (err) {
    next(err);
  }
}


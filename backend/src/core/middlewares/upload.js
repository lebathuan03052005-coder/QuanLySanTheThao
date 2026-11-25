import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { AppError } from '../errors/AppError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục lưu trữ avatar trong backend
const AVATAR_DIR = path.resolve(__dirname, '../../../uploads/avatars');
const FACILITY_DIR = path.resolve(__dirname, '../../../uploads/facilities');
const COURT_DIR = path.resolve(__dirname, '../../../uploads/courts');

// Tự động tạo thư mục nếu chưa tồn tại
[AVATAR_DIR, FACILITY_DIR, COURT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Cấu hình lưu trữ file bằng Multer diskStorage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(AVATAR_DIR)) {
      fs.mkdirSync(AVATAR_DIR, { recursive: true });
    }
    cb(null, AVATAR_DIR);
  },
  filename: function (req, file, cb) {
    const userId = req.user?.id || 'anon';
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    cb(null, `avatar-${userId}-${uniqueSuffix}${ext}`);
  },
});

const facilityStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(FACILITY_DIR)) {
      fs.mkdirSync(FACILITY_DIR, { recursive: true });
    }
    cb(null, FACILITY_DIR);
  },
  filename: function (req, file, cb) {
    const facilityId = req.params?.id || 'facility';
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    cb(null, `facility-${facilityId}-${uniqueSuffix}${ext}`);
  },
});

const courtStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(COURT_DIR)) {
      fs.mkdirSync(COURT_DIR, { recursive: true });
    }
    cb(null, COURT_DIR);
  },
  filename: function (req, file, cb) {
    const courtId = req.params?.courtId || 'court';
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e4)}`;
    cb(null, `court-${courtId}-${uniqueSuffix}${ext}`);
  },
});

// Bộ lọc chỉ chấp nhận định dạng ảnh
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Định dạng file không hợp lệ. Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF.',
        400
      ),
      false
    );
  }
};

export const uploadAvatarMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Giới hạn tối đa 5MB
  },
  fileFilter,
});

export const uploadFacilityImageMiddleware = multer({
  storage: facilityStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Giới hạn tối đa 10MB
  },
  fileFilter,
});

export const uploadCourtImageMiddleware = multer({
  storage: courtStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // Giới hạn tối đa 10MB
  },
  fileFilter,
});

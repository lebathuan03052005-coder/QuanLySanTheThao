import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bookingRouter from './modules/bookings/booking.route.js';
import matchRouter from './modules/matches/match.route.js';
import authRouter from './modules/auth/auth.route.js';
import courtRouter from './modules/courts/court.route.js';
import staffRouter from './modules/staff/staff.route.js';
import facilityRouter from './modules/facilities/facility.route.js';
import sportRouter from './modules/sports/sport.route.js';
import customerRouter from './modules/customers/customer.route.js';
import analyticsRouter from './modules/analytics/analytics.route.js';
import { errorHandler } from './core/middlewares/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware cấu hình CORS để Frontend (Vite :5173) có thể gọi API an toàn
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Phục vụ thư mục tĩnh uploads (ảnh đại diện, hình ảnh hệ thống)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'SportLink API Server đang chạy bình thường!' });
});
app.use('/api/auth', authRouter);
app.use('/api/courts', courtRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/matches', matchRouter);
app.use('/api/staff', staffRouter);
app.use('/api/facilities', facilityRouter);
app.use('/api/sports', sportRouter);
app.use('/api/customers', customerRouter);
app.use('/api/analytics', analyticsRouter);

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SportLink API đang chạy tại http://localhost:${PORT}`);
});

export default app;

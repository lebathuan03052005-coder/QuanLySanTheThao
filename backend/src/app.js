import express from 'express';
import bookingRouter from './modules/bookings/booking.route.js';
import matchRouter from './modules/matches/match.route.js';
import authRouter from './modules/auth/auth.route.js';
import courtRouter from './modules/courts/court.route.js';
import { errorHandler } from './core/middlewares/errorHandler.js';

const app = express();

// Middleware cấu hình CORS để Frontend (Vite :5173) có thể gọi API an toàn
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/courts', courtRouter);
app.use('/api/bookings', bookingRouter);
app.use('/api/matches', matchRouter);

// Centralized error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SportLink API đang chạy tại http://localhost:${PORT}`);
});

export default app;

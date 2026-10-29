import express from 'express';
import bookingRouter from './modules/bookings/booking.route.js';
import matchRouter from './modules/matches/match.route.js';
import authRouter from './modules/auth/auth.route.js';
import courtRouter from './modules/courts/court.route.js';
import { errorHandler } from './core/middlewares/errorHandler.js';

const app = express();

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

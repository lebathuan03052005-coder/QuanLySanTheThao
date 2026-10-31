import * as authService from './auth.service.js';

export async function register(req, res, next) {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { token, user } = await authService.login(req.body);
    res.json({ success: true, token, data: user });
  } catch (err) {
    next(err);
  }
}

export async function googleLogin(req, res, next) {
  try {
    const { credential } = req.body;
    const { token, user } = await authService.googleLogin(credential);
    res.json({ success: true, token, data: user });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    res.json({ success: true, message: 'Đăng xuất thành công.' });
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req, res, next) {
  try {
    const user = await authService.getUserById(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

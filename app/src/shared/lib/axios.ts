import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

/**
 * Instance Axios dùng chung toàn ứng dụng.
 * Tự động gắn Authorization header và xử lý 401 tập trung.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor — Gắn JWT token vào mỗi request
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor — Xử lý lỗi 401 tập trung (token hết hạn trên các trang được bảo vệ)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest =
      error.config?.url?.includes('/auth/login') ||
      error.config?.url?.includes('/auth/google');

    // Chỉ logout và reload nếu KHÔNG PHẢI là request đăng nhập
    // (Tránh reload trang khi người dùng nhập sai mật khẩu để thông báo lỗi màu đỏ được giữ nguyên trên giao diện)
    if (error.response?.status === 401 && !isLoginRequest) {
      useAuthStore.getState().logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

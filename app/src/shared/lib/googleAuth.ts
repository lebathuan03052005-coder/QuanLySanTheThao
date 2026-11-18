/**
 * Quản lý Google Identity Services (GIS) tập trung.
 * Đảm bảo google.accounts.id.initialize() chỉ được gọi duy nhất 1 lần trong suốt vòng đời ứng dụng,
 * giải quyết triệt để cảnh báo [GSI_LOGGER] multiple initialize,
 * tương thích 100% với React StrictMode và hỗ trợ dynamic callback.
 */

export interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

export interface GoogleButtonOptions {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number | string;
  locale?: string;
}

export interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    prompt_parent_id?: string;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: GoogleButtonOptions
  ) => void;
  prompt: (momentListener?: (notification: unknown) => void) => void;
  cancel: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
    __sportlink_gsi_initialized__?: boolean;
  }
}

// Trạng thái module-level (tồn tại xuyên suốt phiên chạy ứng dụng SPA)
let isInitialized = false;
let activeCallback: ((response: GoogleCredentialResponse) => void) | null = null;

/**
 * Dispatcher tiếp nhận kết quả credential từ Google GIS và gửi tới component đang active
 */
function globalGoogleCallbackDispatcher(response: GoogleCredentialResponse) {
  if (activeCallback) {
    activeCallback(response);
  } else {
    console.warn('[SportLink Google Auth]: Đã nhận được credential từ Google nhưng chưa có callback listener.');
  }
}

/**
 * Đợi script Google Identity Services (accounts.google.com/gsi/client) sẵn sàng
 */
export function waitForGoogleScript(timeoutMs = 8000): Promise<GoogleAccountsId> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      return resolve(window.google.accounts.id);
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const gsi = window.google?.accounts?.id;
      if (gsi) {
        clearInterval(interval);
        resolve(gsi);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        reject(new Error('Google Identity Services script tải quá thời gian cho phép.'));
      }
    }, 100);
  });
}

/**
 * Khởi tạo Google Identity Services duy nhất một lần trong toàn bộ vòng đời ứng dụng.
 * An toàn với React StrictMode (double-mounting trong dev mode).
 */
export async function initializeGoogleAuth(
  clientId: string,
  callback?: (response: GoogleCredentialResponse) => void
): Promise<void> {
  if (callback) {
    activeCallback = callback;
  }

  // Nếu đã khởi tạo rồi (ở module scope hoặc window scope), bỏ qua không gọi initialize() lại
  if (isInitialized || window.__sportlink_gsi_initialized__) {
    return;
  }

  const gsi = await waitForGoogleScript();

  if (isInitialized || window.__sportlink_gsi_initialized__) {
    return;
  }

  gsi.initialize({
    client_id: clientId,
    callback: globalGoogleCallbackDispatcher,
    auto_select: false,
  });

  isInitialized = true;
  window.__sportlink_gsi_initialized__ = true;
}

/**
 * Đăng ký callback cho component hiện tại (nhận credential khi đăng nhập thành công).
 * Trả về hàm hủy đăng ký khi component unmount.
 */
export function registerGoogleCallback(
  callback: (response: GoogleCredentialResponse) => void
): () => void {
  activeCallback = callback;
  return () => {
    if (activeCallback === callback) {
      activeCallback = null;
    }
  };
}

/**
 * Render nút Google Sign-In vào một container DOM cụ thể
 */
export async function renderGoogleButton(
  container: HTMLElement,
  options: GoogleButtonOptions = {}
): Promise<void> {
  const gsi = await waitForGoogleScript();
  gsi.renderButton(container, options);
}

/**
 * Kích hoạt popup đăng nhập Google (Prompt / One Tap)
 */
export async function promptGoogleSignIn(): Promise<void> {
  const gsi = await waitForGoogleScript();
  gsi.prompt();
}

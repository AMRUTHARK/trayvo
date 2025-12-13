import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

console.log('API URL configured as:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout (increased for email operations)
});

// Add token to requests and refresh proactively if close to expiring
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    // Check if token is close to expiring (refresh if less than 1 day remaining)
    try {
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = tokenPayload.exp * 1000; // Convert to milliseconds
      const timeUntilExpiry = expirationTime - Date.now();
      const oneDayInMs = 24 * 60 * 60 * 1000;
      
      // If token expires in less than 1 day, refresh it proactively
      if (timeUntilExpiry < oneDayInMs && timeUntilExpiry > 0) {
        try {
          const refreshResponse = await axios.post(`${API_URL}/auth/refresh`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (refreshResponse.data.success && refreshResponse.data.token) {
            localStorage.setItem('token', refreshResponse.data.token);
            config.headers.Authorization = `Bearer ${refreshResponse.data.token}`;
            return config;
          }
        } catch (refreshError) {
          // If refresh fails, continue with existing token
          console.warn('Token refresh failed, using existing token:', refreshError);
        }
      }
    } catch (e) {
      // If token parsing fails, just use the token as-is
    }
    
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle token expiration and refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: any) => void;
  reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh token by calling refresh endpoint
        const token = localStorage.getItem('token');
        if (token) {
          // Use a separate axios instance to avoid interceptor loop
          const refreshResponse = await axios.post(`${API_URL}/auth/refresh`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (refreshResponse.data.success && refreshResponse.data.token) {
            const newToken = refreshResponse.data.token;
            localStorage.setItem('token', newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            processQueue(null, newToken);
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        // Refresh failed, logout user
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // If it's a 401 and we've already tried refreshing, or it's not a token issue
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;


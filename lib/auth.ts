export interface User {
  id: number;
  shop_id: number | null;
  username: string;
  email: string;
  role: 'admin' | 'cashier' | 'super_admin';
  full_name?: string;
  shop_name?: string;
  gstin?: string;
}

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const setStoredUser = (user: User) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('user', JSON.stringify(user));
};

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const setToken = (token: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', token);
};

export const clearAuth = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('lastActivityTime');
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};

export const isAdmin = (): boolean => {
  const user = getStoredUser();
  return user?.role === 'admin';
};

export const isSuperAdmin = (): boolean => {
  const user = getStoredUser();
  return user?.role === 'super_admin';
};

export const isCashier = (): boolean => {
  const user = getStoredUser();
  return user?.role === 'cashier';
};

// Session activity management
export const updateLastActivity = () => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  localStorage.setItem('lastActivityTime', now.toString());
};

export const getLastActivity = (): number | null => {
  if (typeof window === 'undefined') return null;
  const lastActivity = localStorage.getItem('lastActivityTime');
  return lastActivity ? parseInt(lastActivity) : null;
};

export const clearLastActivity = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('lastActivityTime');
};


'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { setToken, setStoredUser, updateLastActivity } from '@/lib/auth';
import PasswordInput from '@/components/PasswordInput';
import CompanyLogo from '@/components/CompanyLogo';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  useEffect(() => {
    // Redirect if already logged in
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (loading) return; // Prevent double submission
    
    setLoading(true);

    try {
      const payload: any = {
        username: formData.username.trim(),
        password: formData.password,
      };

      // shop_id is optional for all user roles (admin, cashier, super_admin)
      // The backend will automatically determine the shop from username
      // For super admin, backend will match users with NULL shop_id
      if (isSuperAdmin) {
        payload.shop_id = null; // Explicitly null for super admin
      }
      // For regular users (admin/cashier), don't send shop_id - backend finds it from username

      console.log('Attempting login with:', { username: payload.username, hasPassword: !!payload.password });
      
      const response = await api.post('/auth/login', payload);
      
      console.log('Login response:', response.data);

      if (response.data && response.data.success) {
        if (response.data.data && response.data.data.token) {
          // Store token and user
          setToken(response.data.data.token);
          setStoredUser(response.data.data.user);
          updateLastActivity(); // Initialize session activity tracking
          
          console.log('Token stored, redirecting to dashboard...');
          toast.success('Login successful!');
          
          // Use window.location for a hard redirect to ensure clean state
          window.location.href = '/dashboard';
        } else {
          toast.error('Invalid response from server');
          console.error('Missing token in response:', response.data);
        }
      } else {
        toast.error(response.data?.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.response) {
        // Server responded with error
        const errorMessage = error.response.data?.message || 
                            error.response.data?.errors?.[0]?.msg ||
                            `Login failed: ${error.response.status}`;
        toast.error(errorMessage);
      } else if (error.request) {
        // Request was made but no response received
        console.error('No response from server. Is backend running?');
        toast.error('Cannot connect to server. Please make sure the backend is running on port 5000');
      } else {
        // Something else happened
        toast.error(error.message || 'An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-700">Signing in...</p>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-6">
            <div className="rounded-lg p-4 shadow-lg w-full max-w-md flex items-center justify-center" style={{ backgroundColor: 'rgb(74, 106, 177)', minHeight: '200px', maxHeight: '220px' }}>
              <CompanyLogo size="lg" showText={false} />
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <PasswordInput
              id="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter your password"
            />
          </div>

          <div className="flex items-center">
            <input
              id="superadmin"
              type="checkbox"
              checked={isSuperAdmin}
              onChange={(e) => {
                setIsSuperAdmin(e.target.checked);
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="superadmin" className="ml-2 block text-sm text-gray-700">
              Login as Super Admin
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Register your shop
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}


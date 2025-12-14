'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import CompanyLogo from '@/components/CompanyLogo';
import PasswordInput from '@/components/PasswordInput';
import toast from 'react-hot-toast';

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [valid, setValid] = useState(false);
  const [userInfo, setUserInfo] = useState<{ username?: string; email?: string } | null>(null);
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setValid(false);
      setLoading(false);
      return;
    }

    // Verify token
    const verifyToken = async () => {
      try {
        const response = await api.get(`/auth/reset-password/${token}`);
        if (response.data.success) {
          setValid(true);
          setUserInfo(response.data.data);
        } else {
          setValid(false);
        }
      } catch (error: any) {
        setValid(false);
        if (error.response?.status === 400) {
          toast.error(error.response.data.message || 'Invalid or expired reset token');
        } else {
          toast.error('Failed to verify reset token');
        }
      } finally {
        setVerifying(false);
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setResetting(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        password: formData.password,
      });
      toast.success('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-700">Verifying reset token...</p>
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center items-center mb-6">
              <div className="rounded-lg p-4 shadow-lg w-full max-w-md flex items-center justify-center" style={{ backgroundColor: 'rgb(74, 106, 177)', minHeight: '200px', maxHeight: '220px' }}>
                <CompanyLogo size="lg" showText={false} />
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className="mb-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Invalid or Expired Link</h2>
            <p className="text-sm text-gray-600 mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/forgot-password')}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                Request New Reset Link
              </button>
              <button
                onClick={() => router.push('/login')}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                ← Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-6">
            <div className="rounded-lg p-4 shadow-lg w-full max-w-md flex items-center justify-center" style={{ backgroundColor: 'rgb(74, 106, 177)', minHeight: '200px', maxHeight: '220px' }}>
              <CompanyLogo size="lg" showText={false} />
            </div>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Reset Your Password</h2>
        {userInfo?.username && (
          <p className="text-sm text-gray-600 mb-6 text-center">
            Resetting password for: <strong>{userInfo.username}</strong>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <PasswordInput
              id="password"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter your new password (min 6 characters)"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password
            </label>
            <PasswordInput
              id="confirmPassword"
              required
              minLength={6}
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Confirm your new password"
            />
          </div>

          <button
            type="submit"
            disabled={resetting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {resetting ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/login')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}


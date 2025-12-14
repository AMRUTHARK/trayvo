'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import CompanyLogo from '@/components/CompanyLogo';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email && !formData.username) {
      toast.error('Please enter either email or username');
      return;
    }

    setLoading(true);
    try {
      // Only send fields that have values
      const payload: { email?: string; username?: string } = {};
      if (formData.email) {
        payload.email = formData.email;
      }
      if (formData.username) {
        payload.username = formData.username;
      }
      await api.post('/auth/forgot-password', payload);
      setSubmitted(true);
      toast.success('If an account exists, a password reset link has been sent to your email.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
    }
  };

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

        {!submitted ? (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Forgot Password?</h2>
            <p className="text-sm text-gray-600 mb-6 text-center">
              Enter your email or username and we'll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  placeholder="Enter your email address"
                />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">OR</span>
                </div>
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                  placeholder="Enter your username"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
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
          </>
        ) : (
          <div className="text-center">
            <div className="mb-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Check Your Email</h2>
            <p className="text-sm text-gray-600 mb-6">
              If an account exists with that email/username, we've sent a password reset link.
              Please check your email and click the link to reset your password.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-xs text-yellow-800">
                <strong>Note:</strong> The reset link will expire in 1 hour. If you don't receive the email, check your spam folder or try again.
              </p>
            </div>
            <button
              onClick={() => {
                setSubmitted(false);
                setFormData({ email: '', username: '' });
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium mb-4"
            >
              Try Again
            </button>
            <div className="mt-4">
              <button
                onClick={() => router.push('/login')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                ← Back to Login
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


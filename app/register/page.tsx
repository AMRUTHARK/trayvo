'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';
import toast from 'react-hot-toast';

// Force dynamic rendering to prevent prerendering issues with useSearchParams
export const dynamic = 'force-dynamic';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [formData, setFormData] = useState({
    registration_token: '',
    shop_id: '',
    shop_name: '',
    full_name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirmPassword: '',
    gstin: '',
  });
  const [selectedGstRates, setSelectedGstRates] = useState<string[]>(['0']); // Default: 0% selected
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); // Track field-specific errors
  const availableGstRates = [
    { value: '0', label: '0% (Nil)' },
    { value: '0.25', label: '0.25% (Rough Diamonds)' },
    { value: '3', label: '3% (Gold, Silver, etc.)' },
    { value: '5', label: '5% (Essential Goods)' },
    { value: '12', label: '12% (Standard Rate)' },
    { value: '18', label: '18% (Standard Rate)' },
    { value: '28', label: '28% (Luxury Goods)' },
  ];

  // Validate token on mount
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setValidatingToken(false);
      setTokenValid(false);
      return;
    }

    // Validate token
    const validateToken = async () => {
      try {
        const response = await api.get(`/registration-tokens/validate/${token}`);
        if (response.data.success) {
          setTokenValid(true);
          setTokenData(response.data.data);
          setFormData(prev => ({
            ...prev,
            registration_token: token,
            shop_id: response.data.data.shop_id.toString(),
            shop_name: response.data.data.shop_name,
            email: response.data.data.email || '',
            username: response.data.data.suggested_username || '',
          }));
        }
      } catch (error: any) {
        setTokenValid(false);
        toast.error(error.response?.data?.message || 'Invalid registration token');
      } finally {
        setValidatingToken(false);
      }
    };

    validateToken();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tokenValid || !formData.registration_token) {
      toast.error('Valid registration token is required');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Clear previous field errors
    setFieldErrors({});
    setLoading(true);

    try {
      // Registration creates shop admin - GST rates selection is for admin
      // Ensure 0% is always included in GST rates
      const gstRatesToSubmit = Array.from(new Set([...selectedGstRates, '0']));

      const response = await api.post('/auth/register', {
        registration_token: formData.registration_token,
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone || null,
        username: formData.username,
        password: formData.password,
        role: 'admin', // Always admin for registration links
        ...(gstRatesToSubmit && { gst_rates: gstRatesToSubmit }),
        ...(formData.gstin && { gstin: formData.gstin.trim() }),
      });

      if (response.data.success) {
        toast.success('Account created successfully! Please login.');
        router.push('/login');
      }
    } catch (error: any) {
      // Handle validation errors with field-specific messages
      if (error.response?.status === 400 && error.response?.data?.errors) {
        const validationErrors: Record<string, string> = {};
        
        // Parse validation errors from express-validator format
        // express-validator returns: { param: 'fieldname', msg: 'error message', location: 'body' }
        error.response.data.errors.forEach((err: any) => {
          // Try multiple possible field name properties
          const fieldName = err.param || err.path || err.field || err.location;
          if (fieldName && fieldName !== 'body' && fieldName !== 'query' && fieldName !== 'params') {
            validationErrors[fieldName] = err.msg || err.message || 'Invalid value';
          }
        });

        // Set field-specific errors
        if (Object.keys(validationErrors).length > 0) {
          setFieldErrors(validationErrors);
          
          // Show general error message with count
          const errorCount = Object.keys(validationErrors).length;
          toast.error(
            `Validation failed: Please check ${errorCount} field${errorCount > 1 ? 's' : ''} below.`,
            { duration: 5000 }
          );
        } else {
          // Fallback to general error message
          toast.error(error.response?.data?.message || 'Registration failed');
        }
      } else {
        // Non-validation errors (network, server, etc.)
        toast.error(error.response?.data?.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  if (validatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Validating registration token...</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="text-6xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Registration Requires Invitation</h1>
          <p className="text-gray-600 mb-6">
            To create an account, you need a registration invitation from your system administrator.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-700">
              <strong>What to do:</strong>
            </p>
            <ul className="text-sm text-gray-600 mt-2 list-disc list-inside space-y-1">
              <li>Check your email for a registration invitation</li>
              <li>Click the registration link in the email</li>
              <li>If you haven't received an invitation, contact your system administrator</li>
            </ul>
          </div>
          <div className="mt-6">
            <a
              href="/login"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Already have an account? Sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4 py-12">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Create User Account</h1>
          <p className="text-gray-600">Complete your registration for {formData.shop_name}</p>
        </div>

        {formData.shop_name && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              <strong>Shop:</strong> {formData.shop_name} (ID: {formData.shop_id})
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {formData.shop_id && (
            <div>
              <label htmlFor="shop_id" className="block text-sm font-medium text-gray-700 mb-2">
                Shop ID
              </label>
              <input
                id="shop_id"
                type="text"
                value={formData.shop_id}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name *
              </label>
              <input
                id="full_name"
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => {
                  setFormData({ ...formData, full_name: e.target.value });
                  if (fieldErrors.full_name) {
                    const newErrors = { ...fieldErrors };
                    delete newErrors.full_name;
                    setFieldErrors(newErrors);
                  }
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent bg-white text-gray-900 ${
                  fieldErrors.full_name 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Your full name"
              />
              {fieldErrors.full_name && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ {fieldErrors.full_name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                id="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (fieldErrors.email) {
                    const newErrors = { ...fieldErrors };
                    delete newErrors.email;
                    setFieldErrors(newErrors);
                  }
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent bg-white text-gray-900 ${
                  fieldErrors.email 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="your.email@example.com"
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
                placeholder="Phone number (optional)"
              />
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                Role *
              </label>
              <input
                id="role"
                type="text"
                value="Admin"
                readOnly
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                title="Role is fixed to Admin for registration links"
              />
              <p className="text-xs text-gray-500 mt-1">
                Registration links create Shop Admin accounts only
              </p>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username *
              </label>
              <input
                id="username"
                type="text"
                required
                minLength={3}
                value={formData.username}
                onChange={(e) => {
                  setFormData({ ...formData, username: e.target.value });
                  if (fieldErrors.username) {
                    const newErrors = { ...fieldErrors };
                    delete newErrors.username;
                    setFieldErrors(newErrors);
                  }
                }}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent bg-white text-gray-900 ${
                  fieldErrors.username 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="Choose a username"
              />
              {fieldErrors.username && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ {fieldErrors.username}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password *
              </label>
              <PasswordInput
                id="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (fieldErrors.password) {
                    const newErrors = { ...fieldErrors };
                    delete newErrors.password;
                    setFieldErrors(newErrors);
                  }
                }}
                className={fieldErrors.password ? 'border-red-500' : ''}
                placeholder="Minimum 6 characters"
              />
              {fieldErrors.password && (
                <p className="text-xs text-red-600 mt-1 font-medium">
                  ⚠️ {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password *
              </label>
              <PasswordInput
                id="confirmPassword"
                required
                minLength={6}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Re-enter password"
              />
            </div>
          </div>

          {/* Shop Details - Registration links create shop admin */}
          <div className="border-t pt-6 space-y-6">
              {/* GSTIN Field */}
              <div>
                <label htmlFor="gstin" className="block text-sm font-medium text-gray-700 mb-2">
                  GSTIN (Optional)
                </label>
                <input
                  id="gstin"
                  type="text"
                  maxLength={15}
                  value={formData.gstin}
                  onChange={(e) => {
                    // Convert to uppercase and allow only alphanumeric
                    const value = e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
                    setFormData({ ...formData, gstin: value });
                    // Clear error when user starts typing
                    if (fieldErrors.gstin) {
                      const newErrors = { ...fieldErrors };
                      delete newErrors.gstin;
                      setFieldErrors(newErrors);
                    }
                  }}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent bg-white text-gray-900 ${
                    fieldErrors.gstin 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="22AAAAA0000A1Z5 (15 characters)"
                />
                {fieldErrors.gstin && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    ⚠️ {fieldErrors.gstin}
                  </p>
                )}
                <p className={`text-xs mt-1 ${
                  fieldErrors.gstin ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Goods and Services Tax Identification Number (optional). Format: 15 alphanumeric characters.
                </p>
              </div>

              {/* GST Rate Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select GST Rates for Your Shop *
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Select the GST rates your shop will use. You can change this later in settings. 0% is always included.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {availableGstRates.map((rate) => {
                    const isSelected = selectedGstRates.includes(rate.value);
                    const isZeroRate = rate.value === '0';
                    
                    return (
                      <label
                        key={rate.value}
                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                          isSelected || isZeroRate
                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        } ${isZeroRate ? 'opacity-75' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected || isZeroRate}
                          disabled={isZeroRate}
                          onChange={(e) => {
                            if (isZeroRate) return; // 0% is always included
                            if (e.target.checked) {
                              setSelectedGstRates([...selectedGstRates, rate.value]);
                            } else {
                              setSelectedGstRates(selectedGstRates.filter(r => r !== rate.value));
                            }
                          }}
                          className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="text-sm font-medium">{rate.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </a>
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Don't have a Shop ID? Contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading...</p>
        </div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}


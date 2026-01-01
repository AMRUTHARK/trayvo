'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { isAdmin, getStoredUser, isCashier, isSuperAdmin } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import PasswordInput from '@/components/PasswordInput';

export default function SettingsPage() {
  const router = useRouter();
  const currentUser = getStoredUser();
  const isCashierUser = isCashier();
  const isSuperAdminUser = isSuperAdmin();
  const [shop, setShop] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [showCreateCashier, setShowCreateCashier] = useState(false);
  const [creatingCashier, setCreatingCashier] = useState(false);
  const [showGstRatesModal, setShowGstRatesModal] = useState(false);
  const [cashierForm, setCashierForm] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
  });
  const [formData, setFormData] = useState({
    shop_name: '',
    owner_name: '',
    email: '',
    phone: '',
    address: '',
    state: '',
    gstin: '',
    bank_name: '',
    bank_branch: '',
    account_number: '',
    ifsc_code: '',
    invoice_number_prefix: 'BILL',
    invoice_number_pattern: '{PREFIX}-{DATE}-{SEQUENCE}',
    printer_type: '58mm',
    logo_url: '',
  });
  const [selectedGstRates, setSelectedGstRates] = useState<string[]>(['0']);
  const availableGstRates = [
    { value: '0', label: '0% (Nil)' },
    { value: '0.25', label: '0.25% (Rough Diamonds)' },
    { value: '3', label: '3% (Gold, Silver, etc.)' },
    { value: '5', label: '5% (Essential Goods)' },
    { value: '12', label: '12% (Standard Rate)' },
    { value: '18', label: '18% (Standard Rate)' },
    { value: '28', label: '28% (Luxury Goods)' },
  ];
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [defaultThermalTemplate, setDefaultThermalTemplate] = useState<number | null>(null);
  const [defaultA4Template, setDefaultA4Template] = useState<number | null>(null);
  const [settingDefaultTemplate, setSettingDefaultTemplate] = useState<number | null>(null);
  // For cashiers and superadmins: only allow editing own username/password
  const [profileForm, setProfileForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    current_password: '',
  });

  useEffect(() => {
    if (isCashierUser || isSuperAdminUser) {
      // Cashiers and superadmins can access settings but only to edit their own profile
      fetchUserProfile();
    } else if (!isAdmin()) {
      router.push('/dashboard');
      return;
    } else {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      const userData = response.data.data;
      setProfileForm({
        username: userData.username || '',
        password: '',
        confirmPassword: '',
        current_password: '',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      const [shopRes, usersRes, templatesRes] = await Promise.all([
        api.get('/shops'),
        api.get('/shops/users'),
        api.get('/invoice-templates').catch(() => ({ data: { data: [] } })), // Fetch templates, handle if endpoint doesn't exist
      ]);
      setShop(shopRes.data.data);
      setUsers(usersRes.data.data || []);
      
      // Process templates
      const templatesList = templatesRes.data.data || [];
      setTemplates(templatesList);
      
      // Find default templates
      const thermalDefault = templatesList.find((t: any) => t.template_type === 'thermal' && t.is_default_for_type);
      const a4Default = templatesList.find((t: any) => t.template_type === 'a4' && t.is_default_for_type);
      
      setDefaultThermalTemplate(thermalDefault?.id || null);
      setDefaultA4Template(a4Default?.id || null);
      setFormData({
        shop_name: shopRes.data.data.shop_name || '',
        owner_name: shopRes.data.data.owner_name || '',
        email: shopRes.data.data.email || '',
        phone: shopRes.data.data.phone || '',
        address: shopRes.data.data.address || '',
        state: shopRes.data.data.state || '',
        gstin: shopRes.data.data.gstin || '',
        bank_name: shopRes.data.data.bank_name || '',
        bank_branch: shopRes.data.data.bank_branch || '',
        account_number: shopRes.data.data.account_number || '',
        ifsc_code: shopRes.data.data.ifsc_code || '',
        invoice_number_prefix: shopRes.data.data.invoice_number_prefix || 'BILL',
        invoice_number_pattern: shopRes.data.data.invoice_number_pattern || '{PREFIX}-{DATE}-{SEQUENCE}',
        printer_type: shopRes.data.data.printer_type || '58mm',
        logo_url: shopRes.data.data.logo_url || '',
      });
      setLogoPreview(shopRes.data.data.logo_url || null);
      
      // Set GST rates from shop data (ensure 0% is always included)
      const shopGstRates = shopRes.data.data.gst_rates;
      if (shopGstRates && Array.isArray(shopGstRates) && shopGstRates.length > 0) {
        const ratesSet = new Set(shopGstRates.map((r: any) => String(r)));
        ratesSet.add('0'); // Ensure 0% is always included
        setSelectedGstRates(Array.from(ratesSet).sort((a, b) => parseFloat(a) - parseFloat(b)));
      } else {
        setSelectedGstRates(['0']); // Default to just 0% if no rates set
      }
    } catch (error: any) {
      // Only show error for actual failures (network/server errors)
      // Settings page should show error because shop data is required
      if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch settings. Please try again.');
      } else if (error.response?.status === 404) {
        toast.error('Shop not found');
      } else {
        toast.error(error.response?.data?.message || 'Failed to fetch settings');
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (profileForm.password && !profileForm.current_password) {
      toast.error('Current password is required to change password');
      return;
    }

    try {
      const payload: any = {};
      if (profileForm.username && profileForm.username !== currentUser?.username) {
        payload.username = profileForm.username;
      }
      if (profileForm.password) {
        payload.password = profileForm.password;
        payload.current_password = profileForm.current_password;
      }

      await api.put('/auth/profile', payload);
      toast.success('Profile updated successfully');
      
      // Update local storage if username changed
      if (payload.username) {
        const updatedUser = { ...currentUser, username: payload.username };
        localStorage.setItem('user', JSON.stringify(updatedUser));
      }
      
      // Reset password fields
      setProfileForm({
        ...profileForm,
        password: '',
        confirmPassword: '',
        current_password: '',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    const user = getStoredUser();
    if (user?.id === userId) {
      toast.error('You cannot delete your own account');
      return;
    }

    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingUserId(userId);
      await api.delete(`/shops/users/${userId}`);
      toast.success('User deleted successfully');
      fetchData(); // Refresh the users list
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put('/shops', formData);
      toast.success('Settings updated successfully');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Update failed');
    }
  };

  const handleGstRateChange = (rateValue: string, isChecked: boolean) => {
    if (rateValue === '0') return; // 0% is always selected and cannot be changed
    setSelectedGstRates(prev => {
      if (isChecked) {
        return Array.from(new Set([...prev, rateValue])).sort((a, b) => parseFloat(a) - parseFloat(b));
      } else {
        return prev.filter(r => r !== rateValue);
      }
    });
  };

  const handleSaveGstRates = async () => {
    try {
      // Ensure 0% is always included in GST rates
      const gstRatesToSubmit = Array.from(new Set([...selectedGstRates, '0']));
      await api.put('/shops', { gst_rates: gstRatesToSubmit });
      toast.success('GST rates updated successfully');
      setShowGstRatesModal(false);
      fetchData(); // Refresh data to show updated state
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update GST rates');
    }
  };

  const handleSetDefaultTemplate = async (templateId: number, templateType: 'thermal' | 'a4') => {
    if (settingDefaultTemplate === templateId) return; // Prevent double-clicking
    
    try {
      setSettingDefaultTemplate(templateId);
      
      await api.post(`/invoice-templates/${templateId}/set-default`);
      
      toast.success(`${templateType === 'thermal' ? 'Thermal' : 'A4'} template set as default successfully`);
      
      // Refresh templates to update UI
      const templatesRes = await api.get('/invoice-templates');
      const templatesList = templatesRes.data.data || [];
      setTemplates(templatesList);
      
      // Update default template states
      const thermalDefault = templatesList.find((t: any) => t.template_type === 'thermal' && t.is_default_for_type);
      const a4Default = templatesList.find((t: any) => t.template_type === 'a4' && t.is_default_for_type);
      
      setDefaultThermalTemplate(thermalDefault?.id || null);
      setDefaultA4Template(a4Default?.id || null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to set default template');
    } finally {
      setSettingDefaultTemplate(null);
    }
  };

  const handleCreateCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCashier(true);
    try {
      await api.post('/shops/users', {
        ...cashierForm,
        role: 'cashier', // Always cashier - enforced by backend
      });
      toast.success('Cashier created successfully');
      setCashierForm({
        username: '',
        email: '',
        password: '',
        full_name: '',
        phone: '',
      });
      setShowCreateCashier(false);
      fetchData(); // Refresh users list
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create cashier');
    } finally {
      setCreatingCashier(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center text-gray-500">Loading...</div>
      </Layout>
    );
  }

  // Cashier and superadmin view: only show profile edit form
  if (isCashierUser || isSuperAdminUser) {
    return (
      <Layout>
        <div className="space-y-6">
          <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">My Profile</h2>
            <p className="text-sm text-gray-600 mb-4">Update your username and password</p>
            
            <div className="mb-4">
              <a
                href="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot Password? Reset it via email →
              </a>
            </div>
            
            <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  minLength={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password (optional)</label>
                <input
                  type="password"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  minLength={6}
                  placeholder="Leave empty to keep current password"
                />
              </div>
              
              {profileForm.password && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={profileForm.confirmPassword}
                      onChange={(e) => setProfileForm({ ...profileForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      minLength={6}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Password *</label>
                    <input
                      type="password"
                      value={profileForm.current_password}
                      onChange={(e) => setProfileForm({ ...profileForm, current_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      required
                      placeholder="Required to change password"
                    />
                  </div>
                </>
              )}
              
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Update Profile
              </button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  // Admin view: show full shop settings
  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Settings</h1>

        {/* Shop Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Shop Information</h2>
          {shop && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop ID</label>
              <div className="text-lg font-semibold text-gray-900">{shop.id}</div>
              <p className="text-xs text-gray-500 mt-1">Your unique shop identifier</p>
            </div>
          )}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
                <input
                  type="text"
                  value={formData.shop_name}
                  onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
                <input
                  type="text"
                  value={formData.owner_name}
                  onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  placeholder="e.g., KERALA"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                <input
                  type="text"
                  maxLength={15}
                  value={formData.gstin}
                  onChange={(e) => {
                    // Convert to uppercase automatically
                    const value = e.target.value.toUpperCase();
                    setFormData({ ...formData, gstin: value });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Printer Type</label>
                <select
                  value={formData.printer_type}
                  onChange={(e) => setFormData({ ...formData, printer_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  <option value="58mm">58mm</option>
                  <option value="80mm">80mm</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                rows={3}
              />
            </div>
            
            {/* Bank Details */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <input
                    type="text"
                    value={formData.bank_branch}
                    onChange={(e) => setFormData({ ...formData, bank_branch: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    value={formData.ifsc_code}
                    onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>
              </div>
            </div>
            
            {/* Invoice Number Format */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoice Number Format</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prefix</label>
                  <input
                    type="text"
                    value={formData.invoice_number_prefix}
                    onChange={(e) => setFormData({ ...formData, invoice_number_prefix: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    style={{ textTransform: 'uppercase' }}
                    placeholder="BILL"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used as {`{PREFIX}`} in pattern</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pattern</label>
                  <select
                    value={formData.invoice_number_pattern}
                    onChange={(e) => setFormData({ ...formData, invoice_number_pattern: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  >
                    <option value="{PREFIX}-{DATE}-{SEQUENCE}">{`{PREFIX}-{DATE}-{SEQUENCE}`} (e.g., BILL-20241216-0001)</option>
                    <option value="{PREFIX}{YEAR}{MONTH}-{SEQUENCE}">{`{PREFIX}{YEAR}{MONTH}-{SEQUENCE}`} (e.g., INV202412-001)</option>
                    <option value="{PREFIX}-{SEQUENCE}">{`{PREFIX}-{SEQUENCE}`} (e.g., TVMDEC-19)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Available: {`{PREFIX}, {DATE}, {YEAR}, {MONTH}, {DAY}, {SEQUENCE}, {SEQUENCE4}`}</p>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shop Logo</label>
              <div className="flex items-center space-x-4">
                {logoPreview && (
                  <div className="h-20 w-20 rounded-lg overflow-hidden border-2 border-gray-200 bg-white flex items-center justify-center">
                    <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain p-1" />
                  </div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error('Image size must be less than 2MB');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64String = reader.result as string;
                          setFormData({ ...formData, logo_url: base64String });
                          setLogoPreview(base64String);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Recommended: Square image, max 2MB (PNG, JPG)</p>
                </div>
                {logoPreview && (
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, logo_url: '' });
                      setLogoPreview(null);
                    }}
                    className="px-3 py-2 text-sm text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Changes
            </button>
          </form>
        </div>

        {/* Invoice & Billing Settings */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Invoice & Billing Settings</h2>
          <p className="text-sm text-gray-600 mb-4">
            Configure invoice templates and formatting. Default templates are automatically created for your shop.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Invoice Template
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Click on a template card to set it as the default. You can select different templates when printing.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {/* Thermal Template Card */}
                {templates.filter((t: any) => t.template_type === 'thermal').length > 0 ? (
                  templates.filter((t: any) => t.template_type === 'thermal').map((template: any) => (
                    <div
                      key={template.id}
                      onClick={() => handleSetDefaultTemplate(template.id, 'thermal')}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        template.is_default_for_type
                          ? 'border-green-500 bg-green-50 hover:bg-green-100'
                          : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
                      } ${settingDefaultTemplate === template.id ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      <h4 className="font-semibold mb-2">{template.template_name}</h4>
                      <p className="text-xs text-gray-600 mb-2">Quick receipt format for thermal printers</p>
                      {template.is_default_for_type ? (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                          ✓ Default for Thermal
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          Click to set as default
                        </span>
                      )}
                      {settingDefaultTemplate === template.id && (
                        <p className="text-xs text-blue-600 mt-2">Setting as default...</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 border border-gray-300 rounded-lg opacity-50">
                    <h4 className="font-semibold mb-2">Thermal Receipt</h4>
                    <p className="text-xs text-gray-600 mb-2">Loading templates...</p>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Default for Thermal</span>
                  </div>
                )}
                
                {/* A4 Template Cards */}
                {templates.filter((t: any) => t.template_type === 'a4').length > 0 ? (
                  templates.filter((t: any) => t.template_type === 'a4').map((template: any) => (
                    <div
                      key={template.id}
                      onClick={() => handleSetDefaultTemplate(template.id, 'a4')}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        template.is_default_for_type
                          ? 'border-blue-500 bg-blue-50 hover:bg-blue-100'
                          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                      } ${settingDefaultTemplate === template.id ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      <h4 className="font-semibold mb-2">{template.template_name}</h4>
                      <p className="text-xs text-gray-600 mb-2">Full tax invoice format for A4 printing</p>
                      {template.is_default_for_type ? (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">
                          ✓ Default for A4
                        </span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          Click to set as default
                        </span>
                      )}
                      {settingDefaultTemplate === template.id && (
                        <p className="text-xs text-blue-600 mt-2">Setting as default...</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-4 border border-gray-300 rounded-lg opacity-50">
                    <h4 className="font-semibold mb-2">A4 Professional</h4>
                    <p className="text-xs text-gray-600 mb-2">Loading templates...</p>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Default for A4</span>
                  </div>
                )}
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={() => {
                  // Future: Open template customization modal
                  toast('Template customization coming soon', { icon: 'ℹ️' });
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Customize Templates (Coming Soon)
              </button>
            </div>
          </div>
        </div>

        {/* GST Rates Configuration Button */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">GST Rates Configuration</h2>
              <p className="text-sm text-gray-600">
                Configure the GST rates available for your products. Currently selected: {' '}
                {Array.from(new Set([...selectedGstRates, '0']))
                  .sort((a, b) => parseFloat(a) - parseFloat(b))
                  .map(r => `${r}%`)
                  .join(', ')}
              </p>
            </div>
            <button
              onClick={() => setShowGstRatesModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Configure GST Rates
            </button>
          </div>
        </div>

        {/* Users Management */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">Users</h2>
            {!showCreateCashier && (
              <button
                onClick={() => setShowCreateCashier(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                + Create Cashier
              </button>
            )}
          </div>

          {/* Create Cashier Form */}
          {showCreateCashier && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Create New Cashier</h3>
                <button
                  onClick={() => {
                    setShowCreateCashier(false);
                    setCashierForm({
                      username: '',
                      email: '',
                      password: '',
                      full_name: '',
                      phone: '',
                    });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreateCashier} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={3}
                      value={cashierForm.username}
                      onChange={(e) => setCashierForm({ ...cashierForm, username: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={cashierForm.email}
                      onChange={(e) => setCashierForm({ ...cashierForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      placeholder="Enter email"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <PasswordInput
                      required
                      minLength={6}
                      value={cashierForm.password}
                      onChange={(e) => setCashierForm({ ...cashierForm, password: e.target.value })}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={cashierForm.full_name}
                      onChange={(e) => setCashierForm({ ...cashierForm, full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={cashierForm.phone}
                      onChange={(e) => setCashierForm({ ...cashierForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={creatingCashier}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingCashier ? 'Creating...' : 'Create Cashier'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateCashier(false);
                      setCashierForm({
                        username: '',
                        email: '',
                        password: '',
                        full_name: '',
                        phone: '',
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">{user.username}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{user.full_name || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs ${
                          user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={deletingUserId === user.id || getStoredUser()?.id === user.id}
                        className={`text-red-600 hover:text-red-700 ${
                          deletingUserId === user.id || getStoredUser()?.id === user.id
                            ? 'opacity-50 cursor-not-allowed'
                            : ''
                        }`}
                        title={getStoredUser()?.id === user.id ? 'You cannot delete your own account' : 'Delete user'}
                      >
                        {deletingUserId === user.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* GST Rates Configuration Modal */}
        {showGstRatesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">GST Rates Configuration</h2>
                <button
                  onClick={() => setShowGstRatesModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Select the GST rates your shop will use. These rates will be available when creating products.{' '}
                <strong className="text-gray-900">0% GST is always included and cannot be removed.</strong>
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
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
                        onChange={(e) => handleGstRateChange(rate.value, e.target.checked)}
                        className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium">{rate.label}</span>
                    </label>
                  );
                })}
              </div>
              
              <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>Selected Rates:</strong>{' '}
                  {Array.from(new Set([...selectedGstRates, '0']))
                    .sort((a, b) => parseFloat(a) - parseFloat(b))
                    .map(r => `${r}%`)
                    .join(', ')}
                </p>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowGstRatesModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGstRates}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save GST Rates
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}


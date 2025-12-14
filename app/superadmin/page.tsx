'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function SuperAdminPage() {
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShop, setSelectedShop] = useState<any>(null);
  const [showShopModal, setShowShopModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [editingShop, setEditingShop] = useState<any>(null);
  const [shopUsers, setShopUsers] = useState<any[]>([]);
  const [invitationEmail, setInvitationEmail] = useState('');
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [registrationUrl, setRegistrationUrl] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [disablingShop, setDisablingShop] = useState<number | null>(null);
  const [shopForm, setShopForm] = useState({
    shop_name: '',
    owner_name: '',
    email: '',
    phone: '',
    address: '',
    gstin: '',
    username: '',
    password: '',
    sendInvitation: false,
    logo_url: '',
    suggested_username: '',
  });
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'pending'>('all');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'cashier',
    full_name: '',
    phone: '',
  });
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [shopRegistrationTokens, setShopRegistrationTokens] = useState<any[]>([]);
  const [loadingShopTokens, setLoadingShopTokens] = useState(false);

  useEffect(() => {
    fetchShops(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchShops = async (status?: 'all' | 'active' | 'pending') => {
    try {
      setLoading(true);
      const filterStatus = status || statusFilter;
      const url = filterStatus === 'all' 
        ? '/superadmin/shops' 
        : `/superadmin/shops?status=${filterStatus}`;
      const response = await api.get(url);
      setShops(response.data.data || []);
    } catch (error: any) {
      // Only show error for actual failures (network/server errors)
      if (error.response?.status >= 500 || error.request) {
        toast.error(error.response?.data?.message || 'Failed to fetch shops. Please try again.');
      }
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchShopUsers = async (shopId: number) => {
    try {
      const response = await api.get(`/superadmin/shops/${shopId}/users`);
      setShopUsers(response.data.data || []);
    } catch (error: any) {
      // Only show error for actual failures (network/server errors)
      if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch shop users. Please try again.');
      }
      setShopUsers([]);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/superadmin/shops', shopForm);
      
      // Show appropriate message based on shop status
      if (response.data.data?.status === 'pending') {
        toast.success('Shop created with pending status. Invitation sent.');
      } else {
        toast.success('Shop created successfully');
      }
      
      // Handle invitation response
      if (response.data.data?.invitation) {
        const invitation = response.data.data.invitation;
        if (invitation.sent) {
          toast.success('Registration invitation email sent successfully!');
        } else if (invitation.warning) {
          toast.success('Shop created, but invitation email could not be sent', {
            duration: 5000,
          });
          toast(invitation.warning, {
            icon: '⚠️',
            duration: 8000,
          });
          if (invitation.registration_url) {
            console.log('Registration URL:', invitation.registration_url);
          }
        }
      }
      
      setShowShopModal(false);
      setShopForm({
        shop_name: '',
        owner_name: '',
        email: '',
        phone: '',
        address: '',
        gstin: '',
        username: '',
        password: '',
        sendInvitation: false,
        logo_url: '',
        suggested_username: '',
      });
      setLogoPreview(null);
      fetchShops(statusFilter);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create shop');
    }
  };

  const handleUpdateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/superadmin/shops/${editingShop.id}`, shopForm);
      toast.success('Shop updated successfully');
      setShowShopModal(false);
      setEditingShop(null);
      setShopForm({
        shop_name: '',
        owner_name: '',
        email: '',
        phone: '',
        address: '',
        gstin: '',
        username: '',
        password: '',
        sendInvitation: false,
        logo_url: '',
        suggested_username: '',
      });
      setLogoPreview(null);
      fetchShops(statusFilter);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update shop');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/superadmin/shops/${selectedShop.id}/users`, userForm);
      toast.success('User created successfully');
      setShowUserModal(false);
      setUserForm({
        username: '',
        email: '',
        password: '',
        role: 'cashier',
        full_name: '',
        phone: '',
      });
      fetchShopUsers(selectedShop.id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!selectedShop) return;

    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingUserId(userId);
      await api.delete(`/superadmin/shops/${selectedShop.id}/users/${userId}`);
      toast.success('User deleted successfully');
      fetchShopUsers(selectedShop.id); // Refresh the users list
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop || !invitationEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setSendingInvitation(true);
    setRegistrationUrl(null);
    setEmailError(null);
    
    try {
      const response = await api.post(`/superadmin/shops/${selectedShop.id}/send-invitation`, {
        email: invitationEmail,
      });
      
      if (response.data.warning) {
        // Email failed but token was generated
        setRegistrationUrl(response.data.data?.registration_url || null);
        setEmailError(response.data.warning);
        toast('Token generated but email sending failed', {
          icon: '⚠️',
          duration: 5000,
        });
      } else {
        // Email sent successfully
        toast.success('Registration invitation sent successfully!');
        setShowInvitationModal(false);
        setInvitationEmail('');
        setSelectedShop(null);
        setRegistrationUrl(null);
        setEmailError(null);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 
                           error.response?.data?.warning || 
                           error.message || 
                           'Failed to send invitation';
      setEmailError(errorMessage);
      
      // If there's a registration URL in the response, show it
      if (error.response?.data?.data?.registration_url) {
        setRegistrationUrl(error.response.data.data.registration_url);
      }
      
      toast.error(errorMessage);
    } finally {
      setSendingInvitation(false);
    }
  };

  const handleDisableShop = async (shopId: number) => {
    if (!confirm('Are you sure you want to disable this shop? All admin and cashier accounts will be deactivated and unable to access the system.')) {
      return;
    }

    setDisablingShop(shopId);
    try {
      await api.post(`/superadmin/shops/${shopId}/disable`);
      toast.success('Shop disabled successfully');
      fetchShops();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to disable shop');
    } finally {
      setDisablingShop(null);
    }
  };

  const handleEnableShop = async (shopId: number) => {
    setDisablingShop(shopId);
    try {
      await api.post(`/superadmin/shops/${shopId}/enable`);
      toast.success('Shop enabled successfully');
      fetchShops();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to enable shop');
    } finally {
      setDisablingShop(null);
    }
  };

  const openEditShop = (shop: any) => {
    setEditingShop(shop);
    setShopForm({
      shop_name: shop.shop_name,
      owner_name: shop.owner_name,
      email: shop.email,
      phone: shop.phone || '',
      address: shop.address || '',
      gstin: shop.gstin || '',
      username: '',
      password: '',
      sendInvitation: false,
      logo_url: shop.logo_url || '',
      suggested_username: shop.suggested_username || '',
    });
    setLogoPreview(shop.logo_url || null);
    setShowShopModal(true);
  };

  const openViewUsers = async (shop: any) => {
    setSelectedShop(shop);
    await fetchShopUsers(shop.id);
    await fetchShopRegistrationTokens(shop.id);
    setShowUserModal(true);
  };

  const fetchShopRegistrationTokens = async (shopId: number) => {
    try {
      setLoadingShopTokens(true);
      const response = await api.get(`/registration-tokens/shop/${shopId}`);
      setShopRegistrationTokens(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch registration tokens:', error);
      setShopRegistrationTokens([]);
    } finally {
      setLoadingShopTokens(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Super Admin - Shop Management</h1>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setEditingShop(null);
                setShopForm({
                  shop_name: '',
                  owner_name: '',
                  email: '',
                  phone: '',
                  address: '',
                  gstin: '',
                  username: '',
                  password: '',
                  sendInvitation: false,
                  logo_url: '',
                  suggested_username: '',
                });
                setLogoPreview(null);
                setShowShopModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Create New Shop
            </button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All Shops
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'active'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 rounded-lg ${
              statusFilter === 'pending'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Pending
          </button>
        </div>

        {/* Shops Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading shops...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shop Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    {statusFilter === 'pending' && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suggested Username</th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bills</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shops.length === 0 ? (
                    <tr>
                      <td colSpan={statusFilter === 'pending' ? 11 : 10} className="px-6 py-8 text-center text-gray-500">
                        No shops found
                      </td>
                    </tr>
                  ) : (
                    shops.map((shop) => (
                      <tr key={shop.id} className={`hover:bg-gray-50 ${!shop.is_active ? 'opacity-60' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{shop.shop_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shop.owner_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shop.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shop.phone || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {shop.status === 'pending' ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            Pending
                          </span>
                        ) : shop.is_active ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Disabled
                          </span>
                        )}
                      </td>
                      {statusFilter === 'pending' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {shop.suggested_username || '-'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shop.user_count || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shop.product_count || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shop.bill_count || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(shop.created_at), 'dd MMM yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => openEditShop(shop)}
                          className="text-blue-600 hover:text-blue-700 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setSelectedShop(shop);
                            setInvitationEmail(shop.email || '');
                            setShowInvitationModal(true);
                          }}
                          className="text-purple-600 hover:text-purple-700 mr-3"
                        >
                          Invite
                        </button>
                        <button
                          onClick={() => openViewUsers(shop)}
                          className="text-green-600 hover:text-green-700 mr-3"
                        >
                          Users
                        </button>
                        {shop.is_active ? (
                          <button
                            onClick={() => handleDisableShop(shop.id)}
                            disabled={disablingShop === shop.id}
                            className="text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            {disablingShop === shop.id ? 'Disabling...' : 'Disable'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnableShop(shop.id)}
                            disabled={disablingShop === shop.id}
                            className="text-green-600 hover:text-green-700 disabled:opacity-50"
                          >
                            {disablingShop === shop.id ? 'Enabling...' : 'Enable'}
                          </button>
                        )}
                      </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Shop Modal */}
        {showShopModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">
                {editingShop ? 'Edit Shop' : 'Create New Shop'}
              </h2>
              <form onSubmit={editingShop ? handleUpdateShop : handleCreateShop} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name *</label>
                    <input
                      type="text"
                      required
                      value={shopForm.shop_name}
                      onChange={(e) => setShopForm({ ...shopForm, shop_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                    <input
                      type="text"
                      required
                      value={shopForm.owner_name}
                      onChange={(e) => setShopForm({ ...shopForm, owner_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={shopForm.email}
                      onChange={(e) => setShopForm({ ...shopForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={shopForm.phone}
                      onChange={(e) => setShopForm({ ...shopForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                    <input
                      type="text"
                      maxLength={15}
                      value={shopForm.gstin}
                      onChange={(e) => {
                        // Convert to uppercase automatically
                        const value = e.target.value.toUpperCase();
                        setShopForm({ ...shopForm, gstin: value });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      style={{ textTransform: 'uppercase' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    value={shopForm.address}
                    onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    rows={2}
                  />
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
                              setShopForm({ ...shopForm, logo_url: base64String });
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
                          setShopForm({ ...shopForm, logo_url: '' });
                          setLogoPreview(null);
                        }}
                        className="px-3 py-2 text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                {!editingShop && (
                  <div className="pt-4 border-t">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={shopForm.sendInvitation}
                        onChange={(e) => setShopForm({ ...shopForm, sendInvitation: e.target.checked })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Send registration invitation email to shop owner
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1 ml-6">
                      {shopForm.sendInvitation 
                        ? 'If sending invite, username/password are optional. The invited user will become the first admin.'
                        : 'A registration link will be sent to the shop owner\'s email address'}
                    </p>
                  </div>
                )}
                {!editingShop && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {shopForm.sendInvitation ? 'Suggested Username (optional)' : 'Admin Username *'}
                      </label>
                      <input
                        type="text"
                        required={!shopForm.sendInvitation}
                        value={shopForm.sendInvitation ? shopForm.suggested_username : shopForm.username}
                        onChange={(e) => {
                          if (shopForm.sendInvitation) {
                            // When sending invitation, update suggested_username
                            setShopForm({ ...shopForm, suggested_username: e.target.value });
                          } else {
                            // When not sending invitation, update username
                            setShopForm({ ...shopForm, username: e.target.value });
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {shopForm.sendInvitation ? 'Admin Password (optional)' : 'Admin Password *'}
                      </label>
                      <PasswordInput
                        required={!shopForm.sendInvitation}
                        value={shopForm.password}
                        onChange={(e) => setShopForm({ ...shopForm, password: e.target.value })}
                        placeholder="Enter admin password"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingShop ? 'Update Shop' : 'Create Shop'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowShopModal(false);
                      setEditingShop(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users Modal */}
        {showUserModal && selectedShop && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">
                Users for {selectedShop.shop_name}
              </h2>
              
              <div className="mb-4">
                <button
                  onClick={() => {
                    setUserForm({
                      username: '',
                      email: '',
                      password: '',
                      role: 'cashier',
                      full_name: '',
                      phone: '',
                    });
                    setShowUserModal(true);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 mb-4"
                >
                  + Add User
                </button>
              </div>

              <div className="overflow-x-auto mb-6">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {shopUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      shopUsers.map((user) => (
                        <tr key={user.id}>
                          <td className="px-4 py-2 text-sm text-gray-900">{user.username}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{user.email}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            <span className={`px-2 py-1 rounded text-xs ${
                              user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{user.full_name || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            <span className={`px-2 py-1 rounded text-xs ${
                              user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {user.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={deletingUserId === user.id}
                              className={`text-red-600 hover:text-red-700 ${
                                deletingUserId === user.id ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
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

              {/* Registration Links Section */}
              <div className="border-t pt-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Links</h3>
                {loadingShopTokens ? (
                  <div className="text-center text-gray-500 py-4">Loading registration links...</div>
                ) : shopRegistrationTokens.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">No registration links found for this shop</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Expires</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {shopRegistrationTokens.map((token: any) => {
                          const registrationUrl = token.registration_url || `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'}/register?token=${token.token}`;
                          const isExpired = new Date(token.expires_at) < new Date();
                          const isUsed = token.used_at !== null;
                          const isActive = !isExpired && !isUsed;
                          
                          return (
                            <tr key={token.id} className={!isActive ? 'opacity-60' : ''}>
                              <td className="px-4 py-2 text-sm text-gray-900">{token.email}</td>
                              <td className="px-4 py-2 text-sm">
                                {isUsed ? (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                    Used
                                  </span>
                                ) : isExpired ? (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                    Expired
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                    Active
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {format(new Date(token.expires_at), 'dd MMM yyyy HH:mm')}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">
                                {format(new Date(token.created_at), 'dd MMM yyyy HH:mm')}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {isActive && (
                                  <button
                                    onClick={() => copyToClipboard(registrationUrl, 'Registration link')}
                                    className="text-blue-600 hover:text-blue-700"
                                  >
                                    Copy Link
                                  </button>
                                )}
                                {token.used_at && (
                                  <span className="text-xs text-gray-500">
                                    Used: {format(new Date(token.used_at), 'dd MMM yyyy')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-gray-900">Create New User</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                    <input
                      type="text"
                      required
                      value={userForm.username}
                      onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <PasswordInput
                      required
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      placeholder="Enter password"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                    <select
                      required
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    >
                      <option value="cashier">Cashier</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={userForm.full_name}
                      onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={userForm.phone}
                      onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Create User
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserModal(false);
                      setSelectedShop(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Invitation Modal */}
        {showInvitationModal && selectedShop && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">
                Send Registration Invitation
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Send a registration invitation email for <strong>{selectedShop.shop_name}</strong> (Shop ID: {selectedShop.id})
              </p>
              
              {registrationUrl ? (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-yellow-800 mb-2">⚠️ Email sending failed</p>
                    {emailError && (
                      <p className="text-xs text-yellow-700 mb-3">{emailError}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Registration Link (Copy and share manually):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={registrationUrl}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(registrationUrl);
                          toast.success('Registration link copied to clipboard!');
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      This link will expire in 7 days
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowInvitationModal(false);
                        setSelectedShop(null);
                        setInvitationEmail('');
                        setRegistrationUrl(null);
                        setEmailError(null);
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRegistrationUrl(null);
                        setEmailError(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendInvitation} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={invitationEmail}
                      onChange={(e) => setInvitationEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      placeholder="user@example.com"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      The recipient will receive an email with a registration link
                    </p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs text-gray-700">
                      <strong>Note:</strong> The invitation link will expire in 7 days. If email sending is not configured, a registration URL will be generated that you can share manually.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={sendingInvitation}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingInvitation ? 'Sending...' : 'Send Invitation'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInvitationModal(false);
                        setSelectedShop(null);
                        setInvitationEmail('');
                        setRegistrationUrl(null);
                        setEmailError(null);
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}


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
  });
  const [userForm, setUserForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'cashier',
    full_name: '',
    phone: '',
  });

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    try {
      setLoading(true);
      const response = await api.get('/superadmin/shops');
      setShops(response.data.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch shops');
    } finally {
      setLoading(false);
    }
  };

  const fetchShopUsers = async (shopId: number) => {
    try {
      const response = await api.get(`/superadmin/shops/${shopId}/users`);
      setShopUsers(response.data.data);
    } catch (error: any) {
      toast.error('Failed to fetch shop users');
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/superadmin/shops', shopForm);
      toast.success('Shop created successfully');
      
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
      });
      fetchShops();
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
      });
      fetchShops();
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

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShop || !invitationEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setSendingInvitation(true);
    try {
      const response = await api.post(`/superadmin/shops/${selectedShop.id}/send-invitation`, {
        email: invitationEmail,
      });
      
      if (response.data.warning) {
        toast.success('Token generated successfully', {
          duration: 5000,
        });
        toast(response.data.warning, {
          icon: '⚠️',
          duration: 8000,
        });
        // Show registration URL if email failed
        if (response.data.data?.registration_url) {
          console.log('Registration URL:', response.data.data.registration_url);
        }
      } else {
        toast.success('Registration invitation sent successfully!');
      }
      
      setShowInvitationModal(false);
      setInvitationEmail('');
      setSelectedShop(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send invitation');
    } finally {
      setSendingInvitation(false);
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
    });
    setShowShopModal(true);
  };

  const openViewUsers = async (shop: any) => {
    setSelectedShop(shop);
    await fetchShopUsers(shop.id);
    setShowUserModal(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Super Admin - Shop Management</h1>
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
              });
              setShowShopModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + Create New Shop
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Products</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bills</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {shops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{shop.shop_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shop.owner_name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shop.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{shop.phone || '-'}</td>
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
                          className="text-green-600 hover:text-green-700"
                        >
                          Users
                        </button>
                      </td>
                    </tr>
                  ))}
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
                      onChange={(e) => setShopForm({ ...shopForm, gstin: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
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
                {!editingShop && (
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Admin Username *</label>
                      <input
                        type="text"
                        required={!editingShop}
                        value={shopForm.username}
                        onChange={(e) => setShopForm({ ...shopForm, username: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password *</label>
                      <PasswordInput
                        required={!editingShop}
                        value={shopForm.password}
                        onChange={(e) => setShopForm({ ...shopForm, password: e.target.value })}
                        placeholder="Enter admin password"
                      />
                    </div>
                  </div>
                )}
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
                      A registration link will be sent to the shop owner's email address
                    </p>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {shopUsers.map((user) => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
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
      </div>
    </Layout>
  );
}


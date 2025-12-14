'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { getStoredUser, isSuperAdmin, isCashier } from '@/lib/auth';
import { formatCurrency, formatQuantity, formatPercentage } from '@/lib/format';

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    supplier_name: '',
    supplier_phone: '',
    supplier_email: '',
    supplier_address: '',
    payment_mode: 'cash' as 'cash' | 'upi' | 'card' | 'credit',
    discount_percent: 0,
    discount_amount: 0,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isCashier()) {
      router.push('/pos');
    }
  }, [router]);

  if (isCashier()) {
    return null;
  }

  useEffect(() => {
    if (isSuperAdmin()) {
      fetchShops();
    } else {
      fetchPurchases();
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin() || selectedShopId) {
      fetchPurchases();
    }
  }, [startDate, endDate, selectedShopId]);

  useEffect(() => {
    if (searchTerm.length > 2) {
      searchProducts();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const fetchShops = async () => {
    try {
      const response = await api.get('/superadmin/shops');
      setShops(response.data.data || []);
      if (response.data.data && response.data.data.length > 0) {
        setSelectedShopId(response.data.data[0].id);
      }
    } catch (error: any) {
      if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch shops. Please try again.');
      }
      setShops([]);
    }
  };

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params: any = { start_date: startDate, end_date: endDate, limit: 100 };
      if (isSuperAdmin() && selectedShopId) {
        params.shop_id = selectedShopId;
      }
      const response = await api.get('/purchases', { params });
      setPurchases(response.data.data || []);
    } catch (error: any) {
      if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch purchases. Please try again.');
      }
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const searchProducts = async () => {
    try {
      const params: any = { limit: 20 };
      if (searchTerm) {
        params.search = searchTerm;
      }
      const response = await api.get('/products', { params });
      setSearchResults(response.data.data || []);
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        unit: product.unit,
        unit_price: product.cost_price || 0,
        gst_rate: product.gst_rate || 0,
        discount_amount: 0,
      }]);
    }
    setSearchTerm('');
    setSearchResults([]);
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const updateCartItem = (productId: number, field: string, value: any) => {
    setCart(cart.map(item =>
      item.product_id === productId ? { ...item, [field]: value } : item
    ));
  };

  const calculateTotals = () => {
    let subtotal = 0;
    cart.forEach(item => {
      const itemTotal = (item.unit_price || 0) * (item.quantity || 0);
      subtotal += itemTotal - (item.discount_amount || 0);
    });
    const discount = formData.discount_amount || (subtotal * (formData.discount_percent || 0) / 100);
    const afterDiscount = subtotal - discount;
    let gst = 0;
    cart.forEach(item => {
      const itemTotal = (item.unit_price || 0) * (item.quantity || 0) - (item.discount_amount || 0);
      gst += (itemTotal * (item.gst_rate || 0)) / 100;
    });
    return {
      subtotal,
      discount,
      gst,
      total: afterDiscount + gst
    };
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error('Please add at least one item to the purchase');
      return;
    }

    try {
      setSubmitting(true);
      const totals = calculateTotals();
      const items = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount || 0,
      }));

      await api.post('/purchases', {
        supplier_name: formData.supplier_name,
        supplier_phone: formData.supplier_phone,
        supplier_email: formData.supplier_email,
        supplier_address: formData.supplier_address,
        items,
        discount_amount: formData.discount_amount,
        discount_percent: formData.discount_percent,
        payment_mode: formData.payment_mode,
        notes: formData.notes,
        include_gst: true,
        status: 'completed',
      });

      toast.success('Purchase created successfully!');
      setShowCreateModal(false);
      setCart([]);
      setFormData({
        supplier_name: '',
        supplier_phone: '',
        supplier_email: '',
        supplier_address: '',
        payment_mode: 'cash',
        discount_percent: 0,
        discount_amount: 0,
        notes: '',
      });
      fetchPurchases();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create purchase');
    } finally {
      setSubmitting(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">Purchases</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + New Purchase
          </button>
        </div>

        {isSuperAdmin() && shops.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Shop
            </label>
            <select
              value={selectedShopId || ''}
              onChange={(e) => setSelectedShopId(parseInt(e.target.value))}
              className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg bg-white"
            >
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.shop_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No purchases found</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Purchase #</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Supplier</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {purchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-4 py-3 text-sm">{purchase.purchase_number}</td>
                    <td className="px-4 py-3 text-sm">{purchase.supplier_name || '-'}</td>
                    <td className="px-4 py-3 text-sm">{format(new Date(purchase.created_at), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3 text-sm font-medium">{formatCurrency(purchase.total_amount)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        purchase.status === 'completed' ? 'bg-green-100 text-green-800' :
                        purchase.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {purchase.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => router.push(`/purchases/${purchase.id}`)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Purchase Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">New Purchase</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700">
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier Name</label>
                  <input
                    type="text"
                    value={formData.supplier_name}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier Phone</label>
                  <input
                    type="text"
                    value={formData.supplier_phone}
                    onChange={(e) => setFormData({ ...formData, supplier_phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Supplier Email</label>
                  <input
                    type="email"
                    value={formData.supplier_email}
                    onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Payment Mode</label>
                  <select
                    value={formData.payment_mode}
                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Search Products</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products by name or SKU..."
                  className="w-full px-3 py-2 border rounded"
                />
                {searchResults.length > 0 && (
                  <div className="mt-2 border rounded max-h-40 overflow-y-auto">
                    {searchResults.map((product) => (
                      <div
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                      >
                        {product.name} ({product.sku}) - {formatCurrency(product.cost_price)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Cart Items</h3>
                  <div className="border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-1 text-left">Product</th>
                          <th className="px-2 py-1 text-left">Qty</th>
                          <th className="px-2 py-1 text-left">Rate</th>
                          <th className="px-2 py-1 text-left">Disc</th>
                          <th className="px-2 py-1 text-left">Total</th>
                          <th className="px-2 py-1 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item) => (
                          <tr key={item.product_id}>
                            <td className="px-2 py-1">{item.name}</td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateCartItem(item.product_id, 'quantity', parseFloat(e.target.value))}
                                className="w-16 px-1 border rounded"
                                min="0.001"
                                step="0.001"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                value={item.unit_price}
                                onChange={(e) => updateCartItem(item.product_id, 'unit_price', parseFloat(e.target.value))}
                                className="w-20 px-1 border rounded"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-2 py-1">
                              <input
                                type="number"
                                value={item.discount_amount || 0}
                                onChange={(e) => updateCartItem(item.product_id, 'discount_amount', parseFloat(e.target.value))}
                                className="w-20 px-1 border rounded"
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td className="px-2 py-1">
                              {formatCurrency((item.unit_price || 0) * (item.quantity || 0) - (item.discount_amount || 0))}
                            </td>
                            <td className="px-2 py-1">
                              <button
                                onClick={() => removeFromCart(item.product_id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Discount %</label>
                  <input
                    type="number"
                    value={formData.discount_percent}
                    onChange={(e) => setFormData({ ...formData, discount_percent: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Discount Amount</label>
                  <input
                    type="number"
                    value={formData.discount_amount}
                    onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded"
                    min="0"
                  />
                </div>
              </div>

              <div className="mb-4 border-t pt-4">
                <div className="flex justify-between mb-1">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Discount:</span>
                  <span>-{formatCurrency(totals.discount)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>GST:</span>
                  <span>{formatCurrency(totals.gst)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-1">
                  <span>Total:</span>
                  <span>{formatCurrency(totals.total)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || cart.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Purchase'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}


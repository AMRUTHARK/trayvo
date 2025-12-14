'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getStoredUser, isSuperAdmin, isCashier } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function InventoryPage() {
  const router = useRouter();
  
  // Route guard: Cashiers cannot access inventory
  useEffect(() => {
    if (isCashier()) {
      router.push('/pos');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show nothing while redirecting
  if (isCashier()) {
    return null;
  }
  const [ledger, setLedger] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ledger' | 'lowstock' | 'adjust'>('ledger');
  const [adjustForm, setAdjustForm] = useState({
    product_id: '',
    quantity_change: '',
    notes: '',
  });

  useEffect(() => {
    if (isSuperAdmin()) {
      fetchShops();
    } else {
      fetchData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isSuperAdmin() || selectedShopId) {
      fetchData();
      if (activeTab === 'adjust') {
        fetchProducts();
      }
    }
  }, [activeTab, selectedShopId]);

  const fetchShops = async () => {
    try {
      const response = await api.get('/superadmin/shops');
      setShops(response.data.data || []);
      if (response.data.data && response.data.data.length > 0) {
        setSelectedShopId(response.data.data[0].id);
      }
    } catch (error: any) {
      // Only show error for actual failures (network/server errors)
      if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch shops. Please try again.');
      }
      setShops([]);
    }
  };

  const fetchProducts = async () => {
    try {
      const params: any = { limit: 1000 };
      if (isSuperAdmin() && selectedShopId) {
        params.shop_id = selectedShopId;
      }
      const response = await api.get('/products', { params });
      setProducts(response.data.data || []);
    } catch (error: any) {
      // Only show error for actual failures (network/server errors)
      if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch products. Please try again.');
      }
      setProducts([]);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (isSuperAdmin() && selectedShopId) {
        params.shop_id = selectedShopId;
      }
      
      if (activeTab === 'ledger') {
        const response = await api.get('/inventory/ledger', { params: { ...params, limit: 100 } });
        setLedger(response.data.data || []);
      } else if (activeTab === 'lowstock') {
        const response = await api.get('/inventory/low-stock', { params });
        setLowStock(response.data.data || []);
      }
    } catch (error: any) {
      // Only show error for actual failures (network/server errors)
      if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch data. Please try again.');
      }
      // Set empty arrays on error so UI shows empty state
      if (activeTab === 'ledger') {
        setLedger([]);
      } else if (activeTab === 'lowstock') {
        setLowStock([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/adjust', {
        product_id: parseInt(adjustForm.product_id),
        quantity_change: parseFloat(adjustForm.quantity_change),
        notes: adjustForm.notes,
      });
      toast.success('Stock adjusted successfully');
      setAdjustForm({ product_id: '', quantity_change: '', notes: '' });
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Adjustment failed');
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>

        {/* Shop Selector for Super Admin */}
        {isSuperAdmin() && shops.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Shop
            </label>
            <select
              value={selectedShopId || ''}
              onChange={(e) => setSelectedShopId(parseInt(e.target.value))}
              className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
            >
              <option value="">Select a shop...</option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.shop_name} (ID: {shop.id})
                </option>
              ))}
            </select>
            {!selectedShopId && (
              <p className="text-sm text-gray-600 mt-2">
                Please select a shop to view inventory
              </p>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="flex border-b border-gray-200">
            {[
              { id: 'ledger', label: 'Stock Ledger' },
              { id: 'lowstock', label: 'Low Stock Alerts' },
              { id: 'adjust', label: 'Adjust Stock' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 font-medium ${
                  activeTab === tab.id
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'ledger' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Change</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Before</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">After</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          Loading...
                        </td>
                      </tr>
                    ) : ledger.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          No ledger entries
                        </td>
                      </tr>
                    ) : (
                      ledger.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(entry.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div className="font-medium text-gray-900">{entry.product_name}</div>
                            <div className="text-gray-500 text-xs">{entry.sku}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {entry.transaction_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span
                              className={
                                entry.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                              }
                            >
                              {entry.quantity_change > 0 ? '+' : ''}
                              {entry.quantity_change}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.quantity_before}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {entry.quantity_after}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{entry.notes}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'lowstock' && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Level</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                          Loading...
                        </td>
                      </tr>
                    ) : lowStock.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                          No low stock items
                        </td>
                      </tr>
                    ) : (
                      lowStock.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                            <div className="font-medium text-gray-900">{product.name}</div>
                            <div className="text-gray-500 text-xs">{product.sku}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {product.category_name || 'Uncategorized'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                            {product.stock_quantity} {product.unit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {product.min_stock_level} {product.unit}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">
                              Low Stock
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'adjust' && (
              <form onSubmit={handleAdjust} className="max-w-md space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                  <select
                    required
                    value={adjustForm.product_id}
                    onChange={(e) => setAdjustForm({ ...adjustForm, product_id: e.target.value, quantity_change: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} (SKU: {product.sku}) - Stock: {product.stock_quantity} {product.unit}
                      </option>
                    ))}
                  </select>
                  {products.length === 0 && (
                    <p className="text-xs text-gray-500 mt-1">Loading products...</p>
                  )}
                </div>
                
                {(() => {
                  const selectedProduct = products.find(p => p.id.toString() === adjustForm.product_id);
                  const unit = selectedProduct?.unit || '';
                  const currentStock = selectedProduct ? parseFloat(selectedProduct.stock_quantity || 0) : 0;
                  // Determine step based on unit type
                  const step = ['kg', 'g', 'l', 'ml', 'm', 'cm'].includes(unit) ? '0.001' : '1';
                  
                  return (
                    <>
                      {selectedProduct && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="text-sm text-gray-700">
                            <span className="font-medium">Current Stock:</span> {currentStock} {unit}
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity Change {unit && `(${unit})`}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step={step}
                            required
                            value={adjustForm.quantity_change}
                            onChange={(e) => setAdjustForm({ ...adjustForm, quantity_change: e.target.value })}
                            className="w-full px-3 py-2 pr-16 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder={unit ? `Enter quantity in ${unit}` : "Enter quantity"}
                          />
                          {unit && (
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">
                              {unit}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Use positive value to add stock, negative to subtract (e.g., +10 or -5)
                        </p>
                        {selectedProduct && adjustForm.quantity_change && (
                          <div className="mt-2 text-sm">
                            <span className="text-gray-600">New stock will be: </span>
                            <span className="font-semibold text-blue-600">
                              {currentStock + parseFloat(adjustForm.quantity_change || '0')} {unit}
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={adjustForm.notes}
                    onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    rows={3}
                    placeholder="Reason for adjustment"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Adjust Stock
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}


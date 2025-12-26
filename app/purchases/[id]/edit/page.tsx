'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatQuantity } from '@/lib/format';
import { format } from 'date-fns';
import { isAdmin, getStoredUser } from '@/lib/auth';

interface Product {
  id: number;
  name: string;
  sku: string;
  unit: string;
  cost_price: number;
  gst_rate: number;
  stock_quantity: number;
}

interface PurchaseItem {
  id?: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: number;
  unit: string;
  unit_price: number;
  gst_rate: number;
  discount_amount?: number;
}

export default function EditPurchasePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const currentUser = getStoredUser();
  const isAdminUser = isAdmin();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purchase, setPurchase] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [formData, setFormData] = useState({
    supplier_name: '',
    supplier_phone: '',
    supplier_email: '',
    supplier_address: '',
    discount_amount: 0,
    discount_percent: 0,
    payment_mode: 'cash',
    notes: '',
    status: 'completed',
    edit_reason: ''
  });

  useEffect(() => {
    if (!isAdminUser) {
      toast.error('Only admins can edit purchases');
      router.push(`/purchases/${id}`);
      return;
    }
    fetchPurchaseData();
    fetchProducts();
  }, [id]);

  const fetchPurchaseData = async () => {
    try {
      const response = await api.get(`/purchases/${id}/edit-preview`);
      const purchaseData = response.data.data;
      
      if (!purchaseData.canEdit) {
        toast.error(purchaseData.restrictions?.reason || 'This purchase cannot be edited');
        router.push(`/purchases/${id}`);
        return;
      }

      setPurchase(purchaseData);
      setFormData({
        supplier_name: purchaseData.supplier_name || '',
        supplier_phone: purchaseData.supplier_phone || '',
        supplier_email: purchaseData.supplier_email || '',
        supplier_address: purchaseData.supplier_address || '',
        discount_amount: parseFloat(purchaseData.discount_amount || 0),
        discount_percent: parseFloat(purchaseData.discount_percent || 0),
        payment_mode: purchaseData.payment_mode || 'cash',
        notes: purchaseData.notes || '',
        status: purchaseData.status || 'completed',
        edit_reason: ''
      });

      // Convert purchase items to editable format
      const editableItems: PurchaseItem[] = purchaseData.items.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.sku,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unit_price: parseFloat(item.unit_price),
        gst_rate: parseFloat(item.gst_rate || 0),
        discount_amount: parseFloat(item.discount_amount || 0)
      }));
      setItems(editableItems);
    } catch (error: any) {
      console.error('Error fetching purchase:', error);
      toast.error(error.response?.data?.message || 'Failed to load purchase');
      router.push(`/purchases/${id}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleAddItem = () => {
    if (products.length === 0) return;
    const firstProduct = products[0];
    setItems([...items, {
      product_id: firstProduct.id,
      product_name: firstProduct.name,
      sku: firstProduct.sku,
      quantity: 1,
      unit: firstProduct.unit,
      unit_price: firstProduct.cost_price,
      gst_rate: firstProduct.gst_rate || 0,
      discount_amount: 0
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    if (field === 'product_id') {
      const product = products.find(p => p.id === parseInt(value));
      if (product) {
        newItems[index] = {
          ...newItems[index],
          product_id: product.id,
          product_name: product.name,
          sku: product.sku,
          unit: product.unit,
          unit_price: product.cost_price,
          gst_rate: product.gst_rate || 0
        };
      }
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: field === 'quantity' || field === 'unit_price' || field === 'gst_rate' || field === 'discount_amount'
          ? parseFloat(value) || 0
          : value
      };
    }
    setItems(newItems);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    let totalGst = 0;

    items.forEach(item => {
      const itemSubtotal = item.unit_price * item.quantity;
      const itemDiscount = item.discount_amount || 0;
      const itemTotalAfterDiscount = itemSubtotal - itemDiscount;
      const itemGst = (itemTotalAfterDiscount * item.gst_rate) / 100;

      subtotal += itemSubtotal;
      totalGst += itemGst;
    });

    const billDiscount = formData.discount_amount || (subtotal * (formData.discount_percent || 0) / 100);
    const finalSubtotal = subtotal - billDiscount;
    const totalAmount = finalSubtotal + totalGst;

    return { subtotal, discount: billDiscount, gst: totalGst, total: totalAmount };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.edit_reason.trim()) {
      toast.error('Please provide a reason for editing this purchase');
      return;
    }

    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setSaving(true);

    try {
      const requestData = {
        ...formData,
        items: items.map(item => ({
          product_id: item.product_id,
          unit_price: item.unit_price,
          quantity: item.quantity,
          gst_rate: item.gst_rate,
          discount_amount: item.discount_amount || 0
        }))
      };

      await api.put(`/purchases/${id}`, requestData);
      toast.success('Purchase updated successfully');
      router.push(`/purchases/${id}`);
    } catch (error: any) {
      console.error('Error updating purchase:', error);
      toast.error(error.response?.data?.message || 'Failed to update purchase');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">Loading purchase data...</div>
        </div>
      </Layout>
    );
  }

  if (!purchase) {
    return null;
  }

  const totals = calculateTotals();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Purchase</h1>
            <p className="text-gray-600 mt-1">Purchase Number: {purchase.purchase_number}</p>
          </div>
          <button
            onClick={() => router.push(`/purchases/${id}`)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        {purchase.restrictions?.hasReturns && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              ⚠️ This purchase has returns associated. Some restrictions may apply when editing.
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-lg shadow p-8 space-y-6">
          {/* Supplier Information */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-xl font-semibold mb-4">Supplier Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier Name</label>
                <input
                  type="text"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.supplier_phone}
                  onChange={(e) => setFormData({ ...formData, supplier_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.supplier_email}
                  onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.supplier_address}
                  onChange={(e) => setFormData({ ...formData, supplier_address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Items</h2>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + Add Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                      <select
                        value={item.product_id}
                        onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <span className="text-xs text-gray-500">{item.unit}</span>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rate</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">GST %</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.gst_rate}
                        onChange={(e) => handleItemChange(index, 'gst_rate', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.discount_amount || 0}
                        onChange={(e) => handleItemChange(index, 'discount_amount', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="w-full px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Discount & Payment */}
          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-xl font-semibold mb-4">Discount & Payment</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: parseFloat(e.target.value) || 0, discount_percent: 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.discount_percent}
                  onChange={(e) => setFormData({ ...formData, discount_percent: parseFloat(e.target.value) || 0, discount_amount: 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
                <select
                  value={formData.payment_mode}
                  onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Edit Reason */}
          <div className="border-t border-gray-200 pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Edit <span className="text-red-600">*</span>
            </label>
            <textarea
              value={formData.edit_reason}
              onChange={(e) => setFormData({ ...formData, edit_reason: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Please provide a reason for editing this purchase..."
              required
            />
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 pt-6">
            <div className="space-y-2 text-right">
              <div className="flex justify-between">
                <span>Sub Total:</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between">
                  <span>(-) Discount:</span>
                  <span className="font-medium">-{formatCurrency(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST:</span>
                <span className="font-medium">{formatCurrency(totals.gst)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t border-gray-200 pt-2">
                <span>TOTAL:</span>
                <span>{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.push(`/purchases/${id}`)}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}


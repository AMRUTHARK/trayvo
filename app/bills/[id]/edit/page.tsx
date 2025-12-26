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
  hsn_code?: string;
  unit: string;
  selling_price: number;
  gst_rate: number;
  stock_quantity: number;
}

interface BillItem {
  id?: number;
  product_id: number;
  product_name: string;
  sku: string;
  hsn_code?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  gst_rate: number;
  discount_amount?: number;
}

export default function EditBillPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const currentUser = getStoredUser();
  const isAdminUser = isAdmin();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bill, setBill] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<BillItem[]>([]);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    customer_gstin: '',
    customer_address: '',
    shipping_address: '',
    discount_amount: 0,
    discount_percent: 0,
    payment_mode: 'cash',
    notes: '',
    edit_reason: ''
  });

  useEffect(() => {
    if (!isAdminUser) {
      toast.error('Only admins can edit bills');
      router.push(`/bills/${id}`);
      return;
    }
    fetchBillData();
    fetchProducts();
  }, [id]);

  const fetchBillData = async () => {
    try {
      const response = await api.get(`/bills/${id}/edit-preview`);
      const billData = response.data.data;
      
      if (!billData.canEdit) {
        toast.error(billData.restrictions?.reason || 'This bill cannot be edited');
        router.push(`/bills/${id}`);
        return;
      }

      setBill(billData);
      setFormData({
        customer_name: billData.customer_name || '',
        customer_phone: billData.customer_phone || '',
        customer_email: billData.customer_email || '',
        customer_gstin: billData.customer_gstin || '',
        customer_address: billData.customer_address || '',
        shipping_address: billData.shipping_address || '',
        discount_amount: parseFloat(billData.discount_amount || 0),
        discount_percent: parseFloat(billData.discount_percent || 0),
        payment_mode: billData.payment_mode || 'cash',
        notes: billData.notes || '',
        edit_reason: ''
      });

      // Convert bill items to editable format
      const editableItems: BillItem[] = billData.items.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.sku,
        hsn_code: item.hsn_code,
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        unit_price: parseFloat(item.unit_price),
        gst_rate: parseFloat(item.gst_rate || 0),
        discount_amount: parseFloat(item.discount_amount || 0)
      }));
      setItems(editableItems);
    } catch (error: any) {
      console.error('Error fetching bill:', error);
      toast.error(error.response?.data?.message || 'Failed to load bill');
      router.push(`/bills/${id}`);
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
      hsn_code: firstProduct.hsn_code,
      quantity: 1,
      unit: firstProduct.unit,
      unit_price: firstProduct.selling_price,
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
          hsn_code: product.hsn_code,
          unit: product.unit,
          unit_price: product.selling_price,
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
    const totalBeforeRound = finalSubtotal + totalGst;
    const roundedTotal = Math.round(totalBeforeRound);
    const roundOff = roundedTotal - totalBeforeRound;

    return { subtotal, discount: billDiscount, gst: totalGst, total: roundedTotal, roundOff };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.edit_reason.trim()) {
      toast.error('Please provide a reason for editing this bill');
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
          discount_amount: item.discount_amount || 0,
          hsn_code: item.hsn_code || null
        })),
        include_gst: true
      };

      await api.put(`/bills/${id}`, requestData);
      toast.success('Bill updated successfully');
      router.push(`/bills/${id}`);
    } catch (error: any) {
      console.error('Error updating bill:', error);
      toast.error(error.response?.data?.message || 'Failed to update bill');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">Loading bill data...</div>
        </div>
      </Layout>
    );
  }

  if (!bill) {
    return null;
  }

  const totals = calculateTotals();

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Bill</h1>
            <p className="text-gray-600 mt-1">Bill Number: {bill.bill_number}</p>
          </div>
          <button
            onClick={() => router.push(`/bills/${id}`)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        {bill.restrictions?.hasReturns && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              ⚠️ This bill has returns associated. Some restrictions may apply when editing.
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-lg shadow p-8 space-y-6">
          {/* Customer Information */}
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-xl font-semibold mb-4">Customer Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                <input
                  type="text"
                  value={formData.customer_gstin}
                  onChange={(e) => setFormData({ ...formData, customer_gstin: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Address</label>
                <textarea
                  value={formData.customer_address}
                  onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
                <textarea
                  value={formData.shipping_address}
                  onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
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
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div>
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
              placeholder="Please provide a reason for editing this bill..."
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
              {Math.abs(totals.roundOff) > 0.01 && (
                <div className="flex justify-between">
                  <span>Round Off:</span>
                  <span className="font-medium">{totals.roundOff > 0 ? '+' : ''}{formatCurrency(totals.roundOff)}</span>
                </div>
              )}
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
              onClick={() => router.push(`/bills/${id}`)}
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


'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface CartItem {
  product_id: number;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  unit_price: number;
  gst_rate: number;
  discount_amount: number;
  total_amount: number;
}

export default function POSPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card' | 'mixed'>('cash');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [includeGst, setIncludeGst] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [holdBills, setHoldBills] = useState<any[]>([]);
  const [showHoldBills, setShowHoldBills] = useState(false);

  useEffect(() => {
    if (searchTerm.length > 2) {
      const timer = setTimeout(() => {
        searchProducts();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setProducts([]);
    }
  }, [searchTerm]);

  const fetchHoldBills = async () => {
    try {
      const response = await api.get('/hold-bills');
      setHoldBills(response.data.data);
    } catch (error) {
      console.error('Failed to fetch hold bills:', error);
      toast.error('Failed to load held bills');
    }
  };

  const handleHoldBill = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    try {
      const billData = {
        cart,
        customerName,
        customerPhone,
        paymentMode,
        discountPercent,
        discountAmount,
        includeGst,
      };

      await api.post('/hold-bills', { bill_data: billData });
      toast.success('Bill held successfully');
      
      // Clear cart after holding
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountPercent(0);
      setDiscountAmount(0);
      setPaymentMode('cash');
      setIncludeGst(true);
      
      // Refresh hold bills list
      fetchHoldBills();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to hold bill');
    }
  };

  const handleRecallBill = (holdBill: any) => {
    try {
      // bill_data might already be an object (from MySQL JSON column) or a string
      const billData = typeof holdBill.bill_data === 'string' 
        ? JSON.parse(holdBill.bill_data) 
        : holdBill.bill_data;
      setCart(billData.cart || []);
      setCustomerName(billData.customerName || '');
      setCustomerPhone(billData.customerPhone || '');
      setPaymentMode(billData.paymentMode || 'cash');
      setDiscountPercent(billData.discountPercent || 0);
      setDiscountAmount(billData.discountAmount || 0);
      setIncludeGst(billData.includeGst !== undefined ? billData.includeGst : true);
      setShowHoldBills(false);
      toast.success('Bill recalled successfully');
    } catch (error) {
      toast.error('Failed to recall bill');
    }
  };

  const handleDeleteHoldBill = async (id: number) => {
    if (!confirm('Are you sure you want to delete this held bill?')) {
      return;
    }

    try {
      await api.delete(`/hold-bills/${id}`);
      toast.success('Held bill deleted');
      fetchHoldBills();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete held bill');
    }
  };

  const searchProducts = async () => {
    try {
      setSearchLoading(true);
      const response = await api.get(`/products?search=${searchTerm}&limit=10`);
      setProducts(response.data.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const addToCart = (product: any) => {
    const existingItem = cart.find((item) => item.product_id === product.id);
    
    if (existingItem) {
      // Recalculate totals when incrementing quantity
      setCart(
        cart.map((item) => {
          if (item.product_id === product.id) {
            const updated = { ...item, quantity: item.quantity + 1 };
            const itemTotal = updated.unit_price * updated.quantity - updated.discount_amount;
            const itemGst = includeGst ? (itemTotal * updated.gst_rate) / 100 : 0;
            updated.total_amount = itemTotal + itemGst;
            return updated;
          }
          return item;
        })
      );
    } else {
      const gstRate = parseFloat(product.gst_rate) || 0;
      const unitPrice = parseFloat(product.selling_price);
      const quantity = 1;
      const itemTotal = unitPrice * quantity;
      const itemGst = includeGst ? (itemTotal * gstRate) / 100 : 0;
      const totalAmount = itemTotal + itemGst;

      setCart([
        ...cart,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          quantity: 1,
          unit: product.unit,
          unit_price: unitPrice,
          gst_rate: gstRate,
          discount_amount: 0,
          total_amount: totalAmount,
        },
      ]);
    }
    setSearchTerm('');
    setProducts([]);
  };

  const updateCartItem = (productId: number, field: string, value: any) => {
    setCart(
      cart.map((item) => {
        if (item.product_id === productId) {
          const updated = { ...item, [field]: value };
          
          // Recalculate totals
          if (field === 'quantity' || field === 'discount_amount') {
            const itemTotal = updated.unit_price * updated.quantity - updated.discount_amount;
            const itemGst = includeGst ? (itemTotal * updated.gst_rate) / 100 : 0;
            updated.total_amount = itemTotal + itemGst;
          }
          
          return updated;
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const totalDiscount = cart.reduce((sum, item) => sum + item.discount_amount, 0);
    const billDiscount = discountAmount || (subtotal * discountPercent) / 100;
    const finalSubtotal = subtotal - totalDiscount - billDiscount;
    const totalGst = includeGst ? cart.reduce((sum, item) => {
      const itemTotal = item.unit_price * item.quantity - item.discount_amount;
      return sum + (itemTotal * item.gst_rate) / 100;
    }, 0) : 0;
    const total = finalSubtotal + totalGst;

    return { subtotal, totalDiscount, billDiscount, totalGst, total };
  };

  // Recalculate all cart items when GST toggle changes
  useEffect(() => {
    if (cart.length > 0) {
      setCart(
        cart.map((item) => {
          const itemTotal = item.unit_price * item.quantity - item.discount_amount;
          const itemGst = includeGst ? (itemTotal * item.gst_rate) / 100 : 0;
          return { ...item, total_amount: itemTotal + itemGst };
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeGst]);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    setLoading(true);
    try {
      const { subtotal, billDiscount, totalGst, total } = calculateTotals();

      const response = await api.post('/bills', {
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
        items: cart.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          discount_amount: item.discount_amount,
        })),
        discount_amount: billDiscount,
        discount_percent: discountPercent,
        payment_mode: paymentMode,
        include_gst: includeGst,
        notes: null,
      });

      if (response.data.success) {
        toast.success('Bill created successfully!');
        // Reset form
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setDiscountPercent(0);
        setDiscountAmount(0);
        setPaymentMode('cash');
        // Optionally redirect to bill details
        router.push(`/bills/${response.data.data.id}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create bill');
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, totalDiscount, billDiscount, totalGst, total } = calculateTotals();

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Product Search & Cart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Product Search */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Search Products</h2>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, SKU, or barcode..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            />
            
            {searchLoading && <div className="mt-2 text-sm text-gray-500">Searching...</div>}
            
            {products.length > 0 && (
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {products.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="p-3 border border-gray-200 rounded-lg hover:bg-blue-50 cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium text-gray-800">{product.name}</div>
                      <div className="text-sm text-gray-600">SKU: {product.sku} | Stock: {product.stock_quantity}</div>
                      <div className="text-sm font-semibold text-blue-600">₹{product.selling_price}</div>
                    </div>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Cart Items</h2>
            {cart.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Cart is empty</div>
            ) : (
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item.product_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-medium text-gray-800">{item.name}</div>
                        <div className="text-sm text-gray-600">SKU: {item.sku}</div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Qty</label>
                        <input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={item.quantity}
                          onChange={(e) => updateCartItem(item.product_id, 'quantity', parseFloat(e.target.value))}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Price</label>
                        <div className="px-2 py-1 text-sm font-medium text-gray-900 bg-gray-50 rounded border border-gray-200">
                          ₹{item.unit_price.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Total</label>
                        <div className="px-2 py-1 text-sm font-semibold text-blue-600 bg-blue-50 rounded border border-blue-200">
                          ₹{item.total_amount.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    {item.gst_rate > 0 && (
                      <div className="text-xs text-gray-500 mt-1">GST {item.gst_rate}%</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Checkout */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Checkout</h2>
            
            {/* Customer Info */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Phone</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* GST Toggle */}
            <div className="mb-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeGst}
                  onChange={(e) => setIncludeGst(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Include GST</span>
              </label>
            </div>

            {/* Totals */}
            <div className="border-t border-gray-200 pt-4 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Item Discount</span>
                <span className="font-medium">₹{totalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Bill Discount</span>
                <span className="font-medium">₹{billDiscount.toFixed(2)}</span>
              </div>
              {includeGst && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST</span>
                  <span className="font-medium">₹{totalGst.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Discount */}
            <div className="space-y-2 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => {
                    setDiscountPercent(parseFloat(e.target.value) || 0);
                    setDiscountAmount(0);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount Amount</label>
                <input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => {
                    setDiscountAmount(parseFloat(e.target.value) || 0);
                    setDiscountPercent(0);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                />
              </div>
            </div>

            {/* Payment Mode */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {['cash', 'upi', 'card', 'mixed'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPaymentMode(mode as any)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      paymentMode === mode
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Hold and Recall Buttons */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button
                onClick={handleHoldBill}
                disabled={cart.length === 0}
                className="bg-yellow-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Hold Bill
              </button>
              <button
                onClick={() => {
                  fetchHoldBills();
                  setShowHoldBills(true);
                }}
                className="bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
              >
                Recall Bill
              </button>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={loading || cart.length === 0}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </div>
      </div>

      {/* Hold Bills Modal */}
      {showHoldBills && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Held Bills</h2>
              <button
                onClick={() => setShowHoldBills(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            {holdBills.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No held bills</div>
            ) : (
              <div className="space-y-3">
                {holdBills.map((holdBill) => {
                  // bill_data might already be an object (from MySQL JSON column) or a string
                  const billData = typeof holdBill.bill_data === 'string' 
                    ? JSON.parse(holdBill.bill_data) 
                    : holdBill.bill_data;
                  const itemCount = billData.cart?.length || 0;
                  const total = billData.cart?.reduce((sum: number, item: any) => sum + (item.total_amount || 0), 0) || 0;
                  
                  return (
                    <div
                      key={holdBill.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium text-gray-800">
                            {billData.customerName || 'Walk-in Customer'}
                          </div>
                          <div className="text-sm text-gray-600">
                            {itemCount} item{itemCount !== 1 ? 's' : ''} • ₹{total.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(holdBill.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleRecallBill(holdBill)}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            Recall
                          </button>
                          <button
                            onClick={() => handleDeleteHoldBill(holdBill.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}


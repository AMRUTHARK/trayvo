'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [purchase, setPurchase] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPurchase();
  }, [params.id]);

  const fetchPurchase = async () => {
    try {
      const response = await api.get(`/purchases/${params.id}`);
      setPurchase(response.data.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        toast.error('Purchase not found');
        router.push('/purchases');
      } else {
        toast.error('Failed to fetch purchase');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="text-center text-gray-500">Loading...</div>
      </Layout>
    );
  }

  if (!purchase) {
    return null;
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Purchase Details</h1>
          <button
            onClick={() => router.push('/purchases')}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Back to Purchases
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <div className="border-b border-gray-200 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{purchase.purchase_number}</h2>
                <p className="text-gray-600 mt-1">
                  {format(new Date(purchase.created_at), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Created By</div>
                <div className="font-medium">{purchase.user_name}</div>
              </div>
            </div>
          </div>

          {purchase.supplier_name && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Supplier Details</h3>
              <div className="text-gray-600">
                <div>Name: {purchase.supplier_name}</div>
                {purchase.supplier_phone && <div>Phone: {purchase.supplier_phone}</div>}
                {purchase.supplier_email && <div>Email: {purchase.supplier_email}</div>}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Item</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Qty</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Rate</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">GST%</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {purchase.items?.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-sm text-gray-500">{item.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-3 text-sm">₹{parseFloat(item.unit_price || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">{parseFloat(item.gst_rate || 0) > 0 ? `${item.gst_rate}%` : '0%'}</td>
                      <td className="px-4 py-3 text-sm font-medium">₹{parseFloat(item.total_amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="space-y-2 text-right">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">₹{parseFloat(purchase.subtotal || 0).toFixed(2)}</span>
              </div>
              {parseFloat(purchase.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Discount</span>
                  <span className="font-medium">-₹{parseFloat(purchase.discount_amount || 0).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">GST</span>
                <span className="font-medium">₹{parseFloat(purchase.gst_amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t border-gray-200 pt-2">
                <span>Total</span>
                <span>₹{parseFloat(purchase.total_amount || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-600">Payment Mode</div>
                <div className="font-medium text-lg">{purchase.payment_mode?.toUpperCase()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Status</div>
                <div className={`font-medium text-lg ${
                  purchase.status === 'completed' ? 'text-green-600' :
                  purchase.status === 'cancelled' ? 'text-red-600' :
                  'text-yellow-600'
                }`}>
                  {purchase.status?.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}


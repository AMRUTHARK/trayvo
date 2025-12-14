'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { isSuperAdmin, isCashier } from '@/lib/auth';

export default function SalesReturnsPage() {
  const router = useRouter();
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (isCashier()) {
      router.push('/pos');
    }
  }, [router]);

  if (isCashier()) {
    return null;
  }

  useEffect(() => {
    fetchReturns();
  }, [startDate, endDate]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const response = await api.get('/sales-returns', {
        params: { start_date: startDate, end_date: endDate, limit: 100 }
      });
      setReturns(response.data.data || []);
    } catch (error: any) {
      if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch sales returns. Please try again.');
      }
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">Sales Returns</h1>
        </div>

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
        ) : returns.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No sales returns found</div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Return #</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Bill #</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Customer</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Total</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {returns.map((returnItem) => (
                  <tr key={returnItem.id}>
                    <td className="px-4 py-3 text-sm">{returnItem.sales_return_number}</td>
                    <td className="px-4 py-3 text-sm">{returnItem.bill_number}</td>
                    <td className="px-4 py-3 text-sm">{returnItem.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-sm">{format(new Date(returnItem.created_at), 'dd MMM yyyy')}</td>
                    <td className="px-4 py-3 text-sm font-medium">₹{parseFloat(returnItem.total_amount || 0).toFixed(2)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        returnItem.status === 'completed' ? 'bg-green-100 text-green-800' :
                        returnItem.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {returnItem.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => router.push(`/sales-returns/${returnItem.id}`)}
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
      </div>
    </Layout>
  );
}


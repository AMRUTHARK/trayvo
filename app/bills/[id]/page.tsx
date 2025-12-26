'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import ThermalPrint from '@/components/ThermalPrint';
import InvoicePrintA4 from '@/components/InvoicePrintA4';
import { formatCurrency, formatQuantity, formatPercentage } from '@/lib/format';

export default function BillDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBill();
  }, [params.id]);

  const fetchBill = async () => {
    try {
      const response = await api.get(`/bills/${params.id}`);
      setBill(response.data.data);
    } catch (error: any) {
      // Bill detail page - if bill not found, redirect is appropriate
      if (error.response?.status === 404) {
        toast.error('Bill not found');
        router.push('/bills');
      } else if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch bill. Please try again.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to fetch bill');
        router.push('/bills');
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

  if (!bill) {
    return null;
  }

  // Calculate GST breakdown by rate
  const calculateGSTBreakdown = () => {
    const gstMap: { [key: number]: { cgst: number; sgst: number; taxable: number } } = {};
    
    bill.items.forEach((item: any) => {
      const gstRate = parseFloat(item.gst_rate || 0);
      const itemTotal = parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 0);
      const discount = parseFloat(item.discount_amount || 0);
      const taxable = itemTotal - discount;
      
      if (gstRate > 0) {
        const cgstRate = gstRate / 2;
        const sgstRate = gstRate / 2;
        const cgst = (taxable * cgstRate) / 100;
        const sgst = (taxable * sgstRate) / 100;

        if (!gstMap[gstRate]) {
          gstMap[gstRate] = { cgst: 0, sgst: 0, taxable: 0 };
        }
        gstMap[gstRate].cgst += cgst;
        gstMap[gstRate].sgst += sgst;
        gstMap[gstRate].taxable += taxable;
      } else {
        if (!gstMap[0]) {
          gstMap[0] = { cgst: 0, sgst: 0, taxable: 0 };
        }
        gstMap[0].taxable += taxable;
      }
    });

    return gstMap;
  };

  const gstBreakdown = calculateGSTBreakdown();
  const gstRates = Object.keys(gstBreakdown).sort((a, b) => parseFloat(b) - parseFloat(a));
  const totalQty = bill.items.reduce((sum: number, item: any) => sum + parseFloat(item.quantity || 0), 0);
  const numItems = bill.items.length;
  const subtotal = parseFloat(bill.subtotal || 0);
  const discount = parseFloat(bill.discount_amount || 0);
  const gstAmount = parseFloat(bill.gst_amount || 0);
  const total = parseFloat(bill.total_amount || 0);
  const roundOff = parseFloat(bill.round_off || 0);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Bill Details</h1>
          <div className="flex gap-3">
            {bill.status === 'completed' && (
              <button
                onClick={() => router.push(`/bills/${id}/edit`)}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                ✏️ Edit Bill
              </button>
            )}
            <ThermalPrint bill={bill} />
            <InvoicePrintA4 bill={bill} />
            <button
              onClick={() => router.push('/bills')}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Back to Bills
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          {/* Bill Header */}
          <div className="border-b border-gray-200 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{bill.bill_number}</h2>
                <p className="text-gray-600 mt-1">
                  {format(new Date(bill.created_at), 'dd MMM yyyy, HH:mm')}
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Cashier</div>
                <div className="font-medium">{bill.cashier_name}</div>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          {(bill.customer_name || bill.customer_phone) && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Customer Details</h3>
              <div className="text-gray-600">
                {bill.customer_name && <div>Name: {bill.customer_name}</div>}
                {bill.customer_phone && <div>Phone: {bill.customer_phone}</div>}
              </div>
            </div>
          )}

          {/* Bill Items */}
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
                  {bill.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-sm text-gray-500">{item.sku}</div>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatQuantity(item.quantity)} {item.unit}</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-3 text-sm">
                        {formatPercentage(item.gst_rate)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{formatCurrency(item.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bill Totals */}
          <div className="border-t border-gray-200 pt-6">
            <div className="space-y-3">
              {/* Summary Stats */}
              <div className="flex justify-between text-sm text-gray-600 mb-4">
                <div>
                  <span>Number of Items: <strong className="text-gray-900">{numItems}</strong></span>
                </div>
                <div>
                  <span>Total Quantity: <strong className="text-gray-900">{formatQuantity(totalQty)}</strong></span>
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="space-y-2 text-right">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Sub Total</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">(-) Discount</span>
                    <span className="font-medium">-{formatCurrency(discount)}</span>
                  </div>
                )}
                
                {/* GST Breakdown by Rate */}
                {gstRates.map((rate) => {
                  const rateNum = parseFloat(rate);
                  const { cgst, sgst, taxable } = gstBreakdown[rateNum];
                  if (rateNum > 0 && taxable > 0) {
                    return (
                      <div key={`gst-${rate}`} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">CGST {formatPercentage(rateNum)} (Taxable {formatCurrency(taxable)})</span>
                          <span className="font-medium">{formatCurrency(cgst)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">SGST {formatPercentage(rateNum)} (Taxable {formatCurrency(taxable)})</span>
                          <span className="font-medium">{formatCurrency(sgst)}</span>
                        </div>
                      </div>
                    );
                  } else if (rateNum === 0 && taxable > 0) {
                    return (
                      <div key={`gst-0`} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">CGST 0% (Taxable {formatCurrency(taxable)})</span>
                          <span className="font-medium">{formatCurrency(0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">SGST 0% (Taxable {formatCurrency(taxable)})</span>
                          <span className="font-medium">{formatCurrency(0)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}

                {/* Round Off */}
                {Math.abs(roundOff) > 0.01 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Round Off</span>
                    <span className="font-medium">{roundOff > 0 ? '+' : ''}{formatCurrency(roundOff)}</span>
                  </div>
                )}

                <div className="flex justify-between text-xl font-bold border-t border-gray-200 pt-2 mt-2">
                  <span>TOTAL</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-600">Payment Mode</div>
                <div className="font-medium text-lg">{bill.payment_mode.toUpperCase()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Status</div>
                <div
                  className={`font-medium text-lg ${
                    bill.status === 'completed' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {bill.status.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}


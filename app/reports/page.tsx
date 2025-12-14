'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { format, subDays } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getStoredUser, isSuperAdmin } from '@/lib/auth';

export default function ReportsPage() {
  const [reportType, setReportType] = useState<'sales' | 'gst' | 'profit' | 'category' | 'payment'>('sales');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isSuperAdmin()) {
      fetchShops();
    } else {
      fetchReport();
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin() || selectedShopId) {
      fetchReport();
    }
  }, [reportType, startDate, endDate, selectedShopId]);

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

  const fetchReport = async () => {
    try {
      setLoading(true);
      const params: any = { start_date: startDate, end_date: endDate };
      if (isSuperAdmin() && selectedShopId) {
        params.shop_id = selectedShopId;
      }
      const response = await api.get(`/reports/${reportType}`, { params });
      setData(response.data.data || []);
    } catch (error: any) {
      // Only show error for actual failures (network/server errors)
      if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch report. Please try again.');
      }
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`${reportType.toUpperCase()} Report`, 14, 20);
    doc.text(`Period: ${startDate} to ${endDate}`, 14, 30);

    const tableData = data.map((row: any) => Object.values(row));
    const headers = Object.keys(data[0] || {}).map((key) =>
      key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
    );

    (doc as any).autoTable({
      head: [headers],
      body: tableData,
      startY: 40,
    });

    doc.save(`${reportType}-report-${startDate}-${endDate}.pdf`);
    toast.success('PDF exported successfully');
  };

  const exportCSV = () => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map((row) => headers.map((header) => row[header]).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-report-${startDate}-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
          <div className="flex gap-3">
            <button
              onClick={exportPDF}
              disabled={data.length === 0}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              Export PDF
            </button>
            <button
              onClick={exportCSV}
              disabled={data.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Shop Selector for Super Admin */}
        {isSuperAdmin() && shops.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
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
                Please select a shop to view reports
              </p>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 flex gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
            >
              <option value="sales">Sales Report</option>
              <option value="gst">GST Report</option>
              <option value="profit">Profit/Loss Report</option>
              <option value="category">Category Sales</option>
              <option value="payment">Payment Mode Report</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
            />
          </div>
        </div>

        {/* Report Data */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : data.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No data available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(data[0]).map((key) => (
                      <th
                        key={key}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                      >
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {Object.values(row).map((value: any, i: number) => (
                        <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}


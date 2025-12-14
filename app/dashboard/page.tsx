'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { getStoredUser, isSuperAdmin, isCashier } from '@/lib/auth';
import { useRouter } from 'next/navigation';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function DashboardPage() {
  const router = useRouter();
  
  // Route guard: Cashiers cannot access dashboard
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
  const [stats, setStats] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [categoryData, setCategoryData] = useState<any>(null);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [period, setPeriod] = useState('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isSuperAdmin()) {
      fetchShops();
    } else {
      fetchDashboardData();
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin() || selectedShopId) {
      fetchDashboardData();
    }
  }, [period, selectedShopId]);

  const fetchShops = async () => {
    try {
      const response = await api.get('/superadmin/shops');
      setShops(response.data.data || []);
      if (response.data.data && response.data.data.length > 0) {
        setSelectedShopId(response.data.data[0].id);
      }
    } catch (error: any) {
      // Only log actual failures (network/server errors)
      if (error.response?.status >= 500 || error.request) {
        console.error('Failed to fetch shops:', error);
      }
      setShops([]);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params: any = { period };
      if (isSuperAdmin() && selectedShopId) {
        params.shop_id = selectedShopId;
      }
      const [statsRes, revenueRes, categoryRes] = await Promise.all([
        api.get(`/dashboard/stats`, { params }),
        api.get(`/dashboard/revenue-chart`, { params }),
        api.get(`/dashboard/category-chart`, { params }),
      ]);

      setStats(statsRes.data.data);
      setRevenueData(revenueRes.data.data || []);
      setCategoryData(categoryRes.data.data || []);
    } catch (error: any) {
      // Only log actual failures (network/server errors)
      if (error.response?.status >= 500 || error.request) {
        console.error('Failed to fetch dashboard data:', error);
      }
      // Set empty data on error so UI shows empty state
      setStats(null);
      setRevenueData([]);
      setCategoryData([]);
    } finally {
      setLoading(false);
    }
  };

  const revenueChartData = {
    labels: revenueData?.map((d: any) => d.period) || [],
    datasets: [
      {
        label: 'Revenue',
        data: revenueData?.map((d: any) => d.revenue) || [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Profit',
        data: revenueData?.map((d: any) => d.profit) || [],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const categoryChartData = {
    labels: categoryData?.map((d: any) => d.category_name) || [],
    datasets: [
      {
        data: categoryData?.map((d: any) => d.revenue) || [],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(168, 85, 247, 0.8)',
        ],
      },
    ],
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <div className="flex gap-4">
            {/* Shop Selector for Super Admin */}
            {isSuperAdmin() && shops.length > 0 && (
              <select
                value={selectedShopId || ''}
                onChange={(e) => setSelectedShopId(parseInt(e.target.value))}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
              >
                <option value="">Select a shop...</option>
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.shop_name} (ID: {shop.id})
                  </option>
                ))}
              </select>
            )}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
            >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Revenue"
            value={`₹${stats?.revenue?.toLocaleString('en-IN') || '0'}`}
            icon="💰"
            color="blue"
          />
          <StatCard
            title="Profit"
            value={`₹${stats?.profit?.toLocaleString('en-IN') || '0'}`}
            icon="📈"
            color="green"
          />
          <StatCard
            title="Margin"
            value={`${stats?.margin || '0'}%`}
            icon="📊"
            color="purple"
          />
          <StatCard
            title="Items Sold"
            value={stats?.items_sold?.toLocaleString('en-IN') || '0'}
            icon="🛒"
            color="orange"
          />
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">Total Bills</div>
            <div className="text-2xl font-bold text-gray-800">{stats?.total_bills || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">Low Stock Items</div>
            <div className="text-2xl font-bold text-red-600">{stats?.low_stock_count || 0}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-2">Total GST</div>
            <div className="text-2xl font-bold text-gray-800">
              ₹{stats?.total_gst?.toLocaleString('en-IN') || '0'}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Revenue & Profit Trend</h2>
            {revenueData && revenueData.length > 0 ? (
              <div className="h-64">
                <Line 
                  data={revenueChartData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: true,
                        position: 'top' as const,
                      },
                    },
                  }} 
                />
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">No data available</div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Category Sales</h2>
            {categoryData && categoryData.length > 0 ? (
              <div className="h-64">
                <Doughnut 
                  data={categoryChartData} 
                  options={{ 
                    responsive: true, 
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: true,
                        position: 'right' as const,
                      },
                    },
                  }} 
                />
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">No data available</div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  const colorClasses: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-600 mb-2">{title}</div>
          <div className="text-2xl font-bold text-gray-800">{value}</div>
        </div>
        <div className={`text-4xl ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
}


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
import { formatCurrency, formatNumber } from '@/lib/format';

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
            value={formatCurrency(stats?.revenue)}
            icon="💰"
            color="blue"
            info="Total sales amount (subtotal) before discounts and GST for the selected period."
          />
          <StatCard
            title="Profit"
            value={formatCurrency(stats?.profit)}
            icon="📈"
            color="green"
            info="Revenue minus cost of goods sold. This is your actual profit after accounting for product costs."
          />
          <StatCard
            title="Margin"
            value={`${stats?.margin || '0'}%`}
            icon="📊"
            color="purple"
            info="Profit margin percentage calculated as (Profit / Revenue) × 100. Higher margin indicates better profitability."
          />
          <StatCard
            title="Items Sold"
            value={formatNumber(stats?.items_sold, 0)}
            icon="🛒"
            color="orange"
            info="Total quantity of products sold across all completed bills for the selected period."
          />
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InfoCard
            title="Total Bills"
            value={stats?.total_bills || 0}
            info="Total number of completed transactions (bills) for the selected period."
          />
          <InfoCard
            title="Low Stock Items"
            value={stats?.low_stock_count || 0}
            valueColor="text-red-600"
            info="Number of products where current stock is at or below the minimum stock level. Consider restocking these items."
          />
          <InfoCard
            title="Total GST"
            value={formatCurrency(stats?.total_gst)}
            info="Total GST (Goods and Services Tax) collected on all sales for the selected period."
          />
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

function StatCard({ title, value, icon, color, info }: { 
  title: string; 
  value: string; 
  icon: string; 
  color: string;
  info?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const colorClasses: any = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 relative">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <span>{title}</span>
            {info && (
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </button>
                {showTooltip && (
                  <div className="absolute z-10 w-64 p-3 text-xs text-white bg-gray-900 rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2">
                    {info}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="text-2xl font-bold text-gray-800">{value}</div>
        </div>
        <div className={`text-4xl ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
}

function InfoCard({ 
  title, 
  value, 
  valueColor = "text-gray-800",
  info 
}: { 
  title: string; 
  value: string | number; 
  valueColor?: string;
  info?: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow p-6 relative">
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
        <span>{title}</span>
        {info && (
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </button>
            {showTooltip && (
              <div className="absolute z-10 w-64 p-3 text-xs text-white bg-gray-900 rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2">
                {info}
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                  <div className="border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
    </div>
  );
}


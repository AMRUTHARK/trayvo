'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { isSuperAdmin } from '@/lib/auth';
import { useRouter } from 'next/navigation';

export default function ErrorLogsPage() {
  const router = useRouter();
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<any | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    error_type: '',
    error_level: '',
    resolved: '',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    if (!isSuperAdmin()) {
      router.push('/dashboard');
      return;
    }
    fetchErrorLogs();
    fetchStats();
  }, [filters]);

  const fetchErrorLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });

      const response = await api.get(`/error-logs?${params.toString()}`);
      setErrorLogs(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch error logs:', error);
      if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch error logs. Please try again.');
      }
      setErrorLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await api.get(`/error-logs/stats/summary?${params.toString()}`);
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to fetch error stats:', error);
    }
  };

  const handleResolve = async (id: number, resolve: boolean) => {
    try {
      const endpoint = resolve ? `/error-logs/${id}/resolve` : `/error-logs/${id}/unresolve`;
      await api.patch(endpoint, resolve ? { notes: 'Resolved by superadmin' } : {});
      toast.success(`Error log ${resolve ? 'resolved' : 'unresolved'} successfully`);
      fetchErrorLogs();
      fetchStats();
      if (selectedError?.id === id) {
        setSelectedError({ ...selectedError, resolved: resolve });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update error log');
    }
  };

  const viewDetails = async (id: number) => {
    try {
      const response = await api.get(`/error-logs/${id}`);
      setSelectedError(response.data.data);
      setShowDetails(true);
    } catch (error: any) {
      toast.error('Failed to fetch error details');
    }
  };

  const getErrorLevelBadge = (level: string) => {
    const colors: { [key: string]: string } = {
      critical: 'bg-red-600',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium text-white ${colors[level] || 'bg-gray-500'}`}>
        {level?.toUpperCase()}
      </span>
    );
  };

  const getErrorTypeBadge = (type: string) => {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-800">
        {type}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!isSuperAdmin()) {
    return null;
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Error Logs</h1>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Total Errors</div>
              <div className="text-2xl font-bold text-gray-800">{stats.summary?.total_errors || 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Unresolved</div>
              <div className="text-2xl font-bold text-red-600">{stats.summary?.unresolved_errors || 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Critical</div>
              <div className="text-2xl font-bold text-red-800">{stats.summary?.critical_errors || 0}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-600">Auth Errors</div>
              <div className="text-2xl font-bold text-orange-600">{stats.summary?.auth_errors || 0}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <select
              value={filters.error_type}
              onChange={(e) => setFilters({ ...filters, error_type: e.target.value, page: 1 })}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Types</option>
              <option value="authentication">Authentication</option>
              <option value="database">Database</option>
              <option value="validation">Validation</option>
              <option value="application">Application</option>
            </select>
            <select
              value={filters.error_level}
              onChange={(e) => setFilters({ ...filters, error_level: e.target.value, page: 1 })}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Levels</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <select
              value={filters.resolved}
              onChange={(e) => setFilters({ ...filters, resolved: e.target.value, page: 1 })}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All</option>
              <option value="false">Unresolved</option>
              <option value="true">Resolved</option>
            </select>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value, page: 1 })}
              className="px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Start Date"
            />
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value, page: 1 })}
              className="px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="End Date"
            />
          </div>
        </div>

        {/* Error Logs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">Loading...</div>
          ) : errorLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No error logs found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Path</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {errorLogs.map((error) => (
                    <tr key={error.id} className={error.resolved ? 'bg-gray-50' : ''}>
                      <td className="px-4 py-3 text-sm text-gray-900">{formatDate(error.created_at)}</td>
                      <td className="px-4 py-3 text-sm">{getErrorTypeBadge(error.error_type)}</td>
                      <td className="px-4 py-3 text-sm">{getErrorLevelBadge(error.error_level)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate" title={error.error_message}>
                        {error.error_message}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{error.request_path || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        {error.resolved ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Resolved</span>
                        ) : (
                          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">Unresolved</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{error.user_username || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => viewDetails(error.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            View
                          </button>
                          {!error.resolved ? (
                            <button
                              onClick={() => handleResolve(error.id, true)}
                              className="text-green-600 hover:text-green-800"
                            >
                              Resolve
                            </button>
                          ) : (
                            <button
                              onClick={() => handleResolve(error.id, false)}
                              className="text-orange-600 hover:text-orange-800"
                            >
                              Unresolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Error Details Modal */}
        {showDetails && selectedError && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Error Details</h2>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="font-semibold text-gray-700">Error Message:</label>
                  <div className="mt-1 p-3 bg-red-50 rounded border border-red-200 text-red-900">
                    {selectedError.error_message}
                  </div>
                </div>

                {selectedError.error_stack && (
                  <div>
                    <label className="font-semibold text-gray-700">Stack Trace:</label>
                    <pre className="mt-1 p-3 bg-gray-50 rounded border border-gray-200 text-xs overflow-x-auto">
                      {selectedError.error_stack}
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold text-gray-700">Type:</label>
                    <div className="mt-1">{getErrorTypeBadge(selectedError.error_type)}</div>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700">Level:</label>
                    <div className="mt-1">{getErrorLevelBadge(selectedError.error_level)}</div>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700">Request Path:</label>
                    <div className="mt-1 text-gray-600">{selectedError.request_path || '-'}</div>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700">Request Method:</label>
                    <div className="mt-1 text-gray-600">{selectedError.request_method || '-'}</div>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700">Status Code:</label>
                    <div className="mt-1 text-gray-600">{selectedError.status_code || '-'}</div>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700">IP Address:</label>
                    <div className="mt-1 text-gray-600">{selectedError.ip_address || '-'}</div>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700">User:</label>
                    <div className="mt-1 text-gray-600">{selectedError.user_username || '-'}</div>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700">Shop:</label>
                    <div className="mt-1 text-gray-600">{selectedError.shop_name || '-'}</div>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700">Created At:</label>
                    <div className="mt-1 text-gray-600">{formatDate(selectedError.created_at)}</div>
                  </div>
                  <div>
                    <label className="font-semibold text-gray-700">Resolved:</label>
                    <div className="mt-1">
                      {selectedError.resolved ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">Yes</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">No</span>
                      )}
                    </div>
                  </div>
                </div>

                {selectedError.request_body && (
                  <div>
                    <label className="font-semibold text-gray-700">Request Body:</label>
                    <pre className="mt-1 p-3 bg-gray-50 rounded border border-gray-200 text-xs overflow-x-auto">
                      {typeof selectedError.request_body === 'string' 
                        ? selectedError.request_body 
                        : JSON.stringify(selectedError.request_body, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedError.notes && (
                  <div>
                    <label className="font-semibold text-gray-700">Notes:</label>
                    <div className="mt-1 p-3 bg-blue-50 rounded border border-blue-200">
                      {selectedError.notes}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  {!selectedError.resolved ? (
                    <button
                      onClick={() => {
                        handleResolve(selectedError.id, true);
                        setShowDetails(false);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Mark as Resolved
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        handleResolve(selectedError.id, false);
                        setShowDetails(false);
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                    >
                      Mark as Unresolved
                    </button>
                  )}
                  <button
                    onClick={() => setShowDetails(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}


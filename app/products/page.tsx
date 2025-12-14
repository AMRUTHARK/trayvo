'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import ExcelJS from 'exceljs';
import { getStoredUser, isSuperAdmin } from '@/lib/auth';
import { formatCurrency, formatQuantity } from '@/lib/format';

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    category_id: '',
    unit: 'pcs',
    cost_price: '',
    selling_price: '',
    gst_rate: '0',
    min_stock_level: '0',
    description: '',
  });
  const [shopGstRates, setShopGstRates] = useState<string[] | null>(null); // null means all rates available

  useEffect(() => {
    if (isSuperAdmin()) {
      fetchShops();
    } else {
      fetchProducts();
      fetchCategories();
      fetchShopGstRates();
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin() && selectedShopId) {
      fetchShopGstRates();
    }
  }, [selectedShopId]);

  const fetchShopGstRates = async () => {
    try {
      if (isSuperAdmin()) {
        // For superadmin, fetch from selected shop
        if (selectedShopId) {
          const response = await api.get(`/superadmin/shops/${selectedShopId}`);
          const gstRates = response.data.data?.gst_rates;
          setShopGstRates(gstRates && Array.isArray(gstRates) && gstRates.length > 0 ? gstRates : null);
        }
      } else {
        // For non-superadmin, fetch from /shops endpoint
        const response = await api.get('/shops');
        const gstRates = response.data.data?.gst_rates;
        setShopGstRates(gstRates && Array.isArray(gstRates) && gstRates.length > 0 ? gstRates : null);
      }
    } catch (error) {
      console.error('Failed to fetch shop GST rates:', error);
      // Default to null (all rates) if fetch fails
      setShopGstRates(null);
    }
  };

  useEffect(() => {
    if (!isSuperAdmin() || selectedShopId) {
      fetchProducts();
      fetchCategories();
    }
  }, [searchTerm, selectedCategory, selectedShopId]);

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

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, limit: 100 };
      if (searchTerm) params.search = searchTerm;
      if (selectedCategory) params.category_id = selectedCategory;
      if (isSuperAdmin() && selectedShopId) {
        params.shop_id = selectedShopId;
      }
      
      const response = await api.get('/products', { params });
      setProducts(response.data.data || []);
    } catch (error: any) {
      // Only show error for actual failures (network/server errors)
      if (error.response?.status >= 500 || error.request) {
        toast.error('Failed to fetch products. Please try again.');
      }
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const params: any = {};
      if (isSuperAdmin() && selectedShopId) {
        params.shop_id = selectedShopId;
      }
      const response = await api.get('/categories', { params });
      setCategories(response.data.data || []);
    } catch (error: any) {
      // Only show error for actual failures (network/server errors)
      if (error.response?.status >= 500 || error.request) {
        console.error('Failed to fetch categories:', error);
      }
      setCategories([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        category_id: formData.category_id || null,
        cost_price: parseFloat(formData.cost_price),
        selling_price: parseFloat(formData.selling_price),
        gst_rate: parseFloat(formData.gst_rate),
        stock_quantity: 0, // Always set to 0 - stock must be added via Purchase module
        min_stock_level: parseFloat(formData.min_stock_level),
      };

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
        toast.success('Product updated successfully');
      } else {
        await api.post('/products', payload);
        toast.success('Product created successfully');
      }

      setShowModal(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || '',
      category_id: product.category_id || '',
      unit: product.unit,
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      gst_rate: product.gst_rate,
      min_stock_level: product.min_stock_level,
      description: product.description || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await api.delete(`/products/${id}`);
      toast.success('Product deleted successfully');
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Delete failed');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      barcode: '',
      category_id: '',
      unit: 'pcs',
      cost_price: '',
      selling_price: '',
      gst_rate: '0',
      min_stock_level: '0',
      description: '',
    });
  };

  const downloadSampleCSV = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const productsSheet = workbook.addWorksheet('Products');

      // Define headers
      const headers = [
        'name',
        'sku',
        'barcode',
        'category_name',
        'unit',
        'cost_price',
        'selling_price',
        'gst_rate',
        'stock_quantity',
        'min_stock_level',
        'description'
      ];

      // Add headers to Products sheet
      productsSheet.addRow(headers);

      // Style header row
      const headerRow = productsSheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Get category names for dropdown
      const categoryNames = categories.length > 0 
        ? categories.map(cat => cat.name)
        : ['Electronics', 'Groceries', 'Clothing'];

      // Create a separate sheet for Categories (used for data validation)
      const categoriesSheet = workbook.addWorksheet('Categories');
      // Note: Sheet is kept visible as some Excel versions require visible sheets for data validation references
      // Users can hide it manually if needed after opening the file
      
      // Add header to categories sheet
      categoriesSheet.getCell('A1').value = 'name';
      categoriesSheet.getCell('A1').font = { bold: true };
      categoriesSheet.getCell('A1').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // Add all category names to column A of Categories sheet (starting from row 2)
      categoryNames.forEach((name, index) => {
        categoriesSheet.getCell(`A${index + 2}`).value = name;
      });
      
      // Set column width for categories sheet
      categoriesSheet.getColumn('A').width = 25;
      
      // Add a note explaining the purpose of this sheet
      categoriesSheet.getCell('B1').value = '(Used for dropdown validation in Products sheet)';
      categoriesSheet.getCell('B1').font = { italic: true, color: { argb: 'FF666666' } };

      // Add sample data rows to Products sheet
      const firstCategory = categoryNames[0] || 'Electronics';
      const secondCategory = categoryNames[1] || 'Groceries';
      const thirdCategory = categoryNames[2] || 'Clothing';

      // Note: stock_quantity in sample data is set to 0 - it will be ignored during import
      // Stock must be added via Purchase module after product creation
      const sampleData = [
        ['Product 1', 'SKU001', '1234567890123', firstCategory, 'pcs', 100, 150, 18, 0, 10, 'Product description 1'],
        ['Product 2', 'SKU002', '1234567890124', secondCategory, 'kg', 50, 75, 5, 0, 20, 'Product description 2'],
        ['Product 3', 'SKU003', '1234567890125', thirdCategory, 'pcs', 200, 300, 12, 0, 5, 'Product description 3']
      ];

      sampleData.forEach(row => {
        productsSheet.addRow(row);
      });

      // Set column widths for Products sheet
      productsSheet.columns = [
        { width: 20 }, // name
        { width: 15 }, // sku
        { width: 15 }, // barcode
        { width: 20 }, // category_name
        { width: 10 }, // unit
        { width: 12 }, // cost_price
        { width: 12 }, // selling_price
        { width: 10 }, // gst_rate
        { width: 12 }, // stock_quantity
        { width: 12 }, // min_stock_level
        { width: 30 }  // description
      ];

      // Create data validation for category_name column (Column D)
      // Reference the Categories sheet which contains all category names from database
      const categoryRangeEnd = categoryNames.length + 1;
      const categoryRangeRef = `Categories!$A$2:$A$${categoryRangeEnd}`;
      
      // Create a named range for better Excel compatibility
      workbook.definedNames.add('CategoryList', categoryRangeRef);

      // Apply data validation dropdown to entire column D
      // ExcelJS requires applying to individual cells for proper dropdown functionality
      // The dropdown arrow will appear when you click on any cell in column D
      // Apply to all rows (existing and future, up to row 10000)
      for (let rowNum = 2; rowNum <= 10000; rowNum++) {
        const cell = productsSheet.getCell(rowNum, 4); // Column D (category_name)
        
        // Set data validation with list type - this creates the dropdown
        // In Excel, clicking the cell will show a dropdown arrow on the right side
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [categoryRangeRef], // Reference to Categories sheet: Categories!$A$2:$A$N
          showErrorMessage: true,
          errorTitle: 'Invalid Category',
          error: 'Please select a valid category from the dropdown list. Categories are sourced from the database.',
          showInputMessage: true,
          promptTitle: 'Select Category',
          prompt: 'Click this cell to see the dropdown arrow, then select a category.'
        };
      }
      
      // Also set the column to show dropdown indicator
      // This ensures Excel displays the dropdown arrow
      const categoryColumn = productsSheet.getColumn(4);
      categoryColumn.header = 'category_name';

      // Freeze header row in Products sheet
      productsSheet.views = [{ state: 'frozen', ySplit: 1 }];

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'products_sample.xlsx';
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Excel template downloaded with category dropdowns!');
    } catch (error) {
      console.error('Error generating Excel file:', error);
      toast.error('Failed to generate Excel file. Please try again.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const exportProducts = async (format: 'excel' | 'csv') => {
    if (products.length === 0) {
      toast.error('No products to export');
      return;
    }

    try {
      if (format === 'excel') {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Products');

        // Define headers
        const headers = [
          'Name',
          'SKU',
          'Barcode',
          'Category',
          'Unit',
          'Cost Price',
          'Selling Price',
          'GST Rate %',
          'Stock Quantity',
          'Min Stock Level',
          'Description',
        ];

        // Add headers
        worksheet.addRow(headers);
        
        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' },
        };

        // Add data rows
        products.forEach((product) => {
          worksheet.addRow([
            product.name || '',
            product.sku || '',
            product.barcode || '',
            product.category_name || 'Uncategorized',
            product.unit || 'pcs',
            product.cost_price || 0,
            product.selling_price || 0,
            product.gst_rate || 0,
            product.stock_quantity || 0,
            product.min_stock_level || 0,
            product.description || '',
          ]);
        });

        // Auto-fit columns
        worksheet.columns.forEach((column) => {
          column.width = 15;
        });

        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const shopName = isSuperAdmin() && selectedShopId
          ? shops.find(s => s.id === selectedShopId)?.shop_name || 'all-shops'
          : 'products';
        link.download = `products-${shopName}-${new Date().toISOString().split('T')[0]}.xlsx`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success('Products exported to Excel successfully');
      } else {
        // CSV export
        const headers = [
          'Name',
          'SKU',
          'Barcode',
          'Category',
          'Unit',
          'Cost Price',
          'Selling Price',
          'GST Rate %',
          'Stock Quantity',
          'Min Stock Level',
          'Description',
        ];

        const csvRows = [
          headers.join(','),
          ...products.map((product) =>
            [
              `"${(product.name || '').replace(/"/g, '""')}"`,
              `"${(product.sku || '').replace(/"/g, '""')}"`,
              `"${(product.barcode || '').replace(/"/g, '""')}"`,
              `"${(product.category_name || 'Uncategorized').replace(/"/g, '""')}"`,
              `"${(product.unit || 'pcs').replace(/"/g, '""')}"`,
              product.cost_price || 0,
              product.selling_price || 0,
              product.gst_rate || 0,
              product.stock_quantity || 0,
              product.min_stock_level || 0,
              `"${(product.description || '').replace(/"/g, '""')}"`,
            ].join(',')
          ),
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const shopName = isSuperAdmin() && selectedShopId
          ? shops.find(s => s.id === selectedShopId)?.shop_name || 'all-shops'
          : 'products';
        link.download = `products-${shopName}-${new Date().toISOString().split('T')[0]}.csv`;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success('Products exported to CSV successfully');
      }
    } catch (error) {
      console.error('Error exporting products:', error);
      toast.error('Failed to export products. Please try again.');
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Please select a CSV file');
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const response = await api.post('/products/bulk-import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        toast.success(response.data.message);
        setShowImportModal(false);
        setImportFile(null);
        fetchProducts();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">Products</h1>
          <div className="flex gap-2">
            <button
              onClick={() => exportProducts('excel')}
              disabled={products.length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📊 Export Excel
            </button>
            <button
              onClick={() => exportProducts('csv')}
              disabled={products.length === 0}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📄 Export CSV
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              📥 Import CSV
            </button>
            <button
              onClick={() => {
                setEditingProduct(null);
                resetForm();
                setShowModal(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + Add Product
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
                Please select a shop to view products
              </p>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 flex gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        <p className="mb-2">No products found</p>
                        <button
                          onClick={() => setShowModal(true)}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Add your first product
                        </button>
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{product.name}</div>
                          {(() => {
                            const stockQty = parseFloat(product.stock_quantity) || 0;
                            const minStock = parseFloat(product.min_stock_level);
                            // Only show low stock if min_stock_level is set (not null/undefined/0/NaN) and stock is below it
                            if (isNaN(minStock) || minStock <= 0) return false;
                            return stockQty < minStock;
                          })() && (
                            <span className="text-xs text-red-600">Low Stock</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{product.sku}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {product.category_name || 'Uncategorized'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {formatQuantity(product.stock_quantity)} {product.unit}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {formatCurrency(product.selling_price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-blue-600 hover:text-blue-700 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                    <input
                      type="text"
                      required
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    {categories.length === 0 ? (
                      <div className="w-full px-4 py-3 border-2 border-dashed border-yellow-300 rounded-lg bg-yellow-50">
                        <div className="flex items-start space-x-2">
                          <span className="text-yellow-600 text-lg">⚠️</span>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-yellow-800 mb-1">No categories available</p>
                            <p className="text-xs text-yellow-700 mb-2">
                              Please create a category first before adding products for better organization.
                            </p>
                            <a
                              href="/categories"
                              className="inline-flex items-center text-xs font-medium text-yellow-700 hover:text-yellow-800 underline"
                            >
                              Go to Categories →
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <select
                        value={formData.category_id}
                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                      >
                        <option value="">Select Category (Optional)</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    >
                      <option value="pcs">Pieces</option>
                      <option value="kg">Kilogram</option>
                      <option value="g">Gram</option>
                      <option value="l">Liter</option>
                      <option value="ml">Milliliter</option>
                      <option value="m">Meter</option>
                      <option value="cm">Centimeter</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.cost_price}
                      onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.selling_price}
                      onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate %</label>
                    <select
                      value={formData.gst_rate}
                      onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    >
                      {(() => {
                        // All available GST rates
                        const allRates = [
                          { value: '0', label: '0% (Nil)' },
                          { value: '0.25', label: '0.25% (Rough Diamonds)' },
                          { value: '3', label: '3% (Gold, Silver, etc.)' },
                          { value: '5', label: '5% (Essential Goods)' },
                          { value: '12', label: '12% (Standard Rate)' },
                          { value: '18', label: '18% (Standard Rate)' },
                          { value: '28', label: '28% (Luxury Goods)' },
                        ];
                        
                        // Filter rates based on shop selection
                        // If shopGstRates is null, show all rates (backward compatibility)
                        // Otherwise, show only selected rates (0% is always included)
                        const allowedRates = shopGstRates === null 
                          ? allRates 
                          : allRates.filter(rate => {
                              // Always include 0%
                              if (rate.value === '0') return true;
                              // Include if in shop's selected rates
                              return shopGstRates.includes(rate.value);
                            });
                        
                        return allowedRates.map(rate => (
                          <option key={rate.value} value={rate.value}>
                            {rate.label}
                          </option>
                        ));
                      })()}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Level</label>
                    <input
                      type="number"
                      step="0.001"
                      value={formData.min_stock_level}
                      onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingProduct(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingProduct ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h2 className="text-2xl font-bold mb-4 text-gray-900">Import Products from CSV</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Upload a CSV or Excel file with product data. Download the sample Excel template with category dropdowns.
                  </p>
                  <button
                    onClick={downloadSampleCSV}
                    className="text-blue-600 hover:text-blue-700 text-sm underline mb-4"
                  >
                    📥 Download Sample Excel Template
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select CSV File</label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                  />
                  {importFile && (
                    <p className="text-sm text-gray-600 mt-1">Selected: {importFile.name}</p>
                  )}
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                  <p className="font-semibold mb-1">CSV Format (Columns):</p>
                  <p><strong>Required:</strong> name, sku, cost_price, selling_price</p>
                  <p><strong>Optional:</strong> barcode, <strong>category_name</strong>, unit, gst_rate, min_stock_level, description</p>
                  <p className="mt-2 text-xs">
                    <strong>Note:</strong> The category_name column should contain the exact category name from the dropdown below. 
                    Use the dropdown to copy the correct category name.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-red-700">
                    ⚠️ Stock quantity is not set during import. All products are created with stock_quantity = 0. 
                    Use the Purchase module to add stock with proper supplier tracking.
                  </p>
                </div>
                {categories.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-sm font-semibold text-blue-800 mb-2">
                      Available Categories (for category_name column):
                    </p>
                    <div>
                      <select
                        className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-gray-900 text-sm font-medium"
                        onChange={(e) => {
                          if (e.target.value) {
                            navigator.clipboard.writeText(e.target.value);
                            toast.success(`Category "${e.target.value}" copied to clipboard!`);
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">📋 Select a category to copy its name</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-blue-700 mt-2">
                        💡 Tip: Select a category above to copy its exact name for use in the category_name column of your CSV file
                      </p>
                      <div className="mt-2 text-xs text-blue-600">
                        <strong>All available categories:</strong>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {categories.map((cat) => (
                            <span
                              key={cat.id}
                              className="px-2 py-1 bg-white border border-blue-200 rounded cursor-pointer hover:bg-blue-100"
                              onClick={() => {
                                navigator.clipboard.writeText(cat.name);
                                toast.success(`Category "${cat.name}" copied!`);
                              }}
                              title={`Click to copy: ${cat.name}`}
                            >
                              {cat.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportFile(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!importFile || importing}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {importing ? 'Importing...' : 'Import'}
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


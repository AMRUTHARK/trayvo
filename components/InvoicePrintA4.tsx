'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { formatCurrency, formatQuantity } from '@/lib/format';

interface InvoicePrintA4Props {
  bill: any;
  templateConfig?: any;
}

export default function InvoicePrintA4({ bill, templateConfig }: InvoicePrintA4Props) {
  const [printing, setPrinting] = useState(false);
  const [shop, setShop] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);

  useEffect(() => {
    fetchShopAndTemplate();
  }, []);

  const fetchShopAndTemplate = async () => {
    try {
      const [shopRes, templateRes] = await Promise.all([
        api.get('/shops'),
        api.get('/invoice-templates/default/a4').catch(() => ({ data: { data: null } }))
      ]);
      setShop(shopRes.data.data);
      setTemplate(templateRes.data.data || templateConfig || getDefaultA4Template());
    } catch (error: any) {
      console.error('Failed to fetch shop/template:', error);
      toast.error('Failed to load invoice data');
    }
  };

  const getDefaultA4Template = () => ({
    version: '1.0',
    pageSize: 'a4',
    sections: {
      header: { enabled: true, showLogo: true, logoPosition: 'right', fields: ['name', 'address', 'phone', 'email', 'gstin', 'state'] },
      billing: { enabled: true, title: 'Bill To', fields: ['name', 'address', 'phone', 'gstin', 'state'] },
      shipping: { enabled: true, title: 'Shipping To', defaultToBilling: true },
      items: { columns: ['sl_no', 'items', 'hsn', 'unit_price', 'quantity', 'amount'] },
      totals: { showTaxBreakdown: true, showCGST: true, showSGST: true },
      bankDetails: { enabled: true, position: 'bottom_left' },
      footer: { showQueryContact: true, showSignature: true }
    }
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const calculateGSTBreakdown = (items: any[]) => {
    const gstMap: { [key: number]: { cgst: number; sgst: number; taxable: number } } = {};
    
    items.forEach((item: any) => {
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

  const printInvoice = async () => {
    setPrinting(true);
    
    try {
      if (!shop || !template) {
        toast.error('Please wait for data to load');
        setPrinting(false);
        return;
      }

      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        toast.error('Please allow popups to print');
        setPrinting(false);
        return;
      }

      window.focus();

      const gstBreakdown = calculateGSTBreakdown(bill.items);
      const subtotal = parseFloat(bill.subtotal || 0);
      const discount = parseFloat(bill.discount_amount || 0);
      const totalGst = parseFloat(bill.gst_amount || 0);
      const total = parseFloat(bill.total_amount || 0);
      const roundOff = parseFloat(bill.round_off || 0);
      
      // Calculate total taxable amount for GST calculation
      const totalTaxable = subtotal - discount;
      
      // Get CGST and SGST from breakdown (assuming single GST rate for simplicity, or sum all)
      let totalCGST = 0;
      let totalSGST = 0;
      Object.keys(gstBreakdown).forEach(rate => {
        totalCGST += gstBreakdown[parseFloat(rate)].cgst;
        totalSGST += gstBreakdown[parseFloat(rate)].sgst;
      });

      // Determine GST rate (take the highest non-zero rate if multiple)
      const gstRates = Object.keys(gstBreakdown).filter(r => parseFloat(r) > 0).map(r => parseFloat(r));
      const displayGstRate = gstRates.length > 0 ? Math.max(...gstRates) : 0;
      const cgstRate = displayGstRate / 2;
      const sgstRate = displayGstRate / 2;

      printWindow.document.open();
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice ${bill.bill_number}</title>
            <style>
              @media print {
                @page { size: A4; margin: 15mm; }
                body { margin: 0; padding: 0; }
              }
              body {
                font-family: Arial, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: #000;
                margin: 0;
                padding: 20px;
                width: 210mm;
                min-height: 297mm;
                box-sizing: border-box;
              }
              .invoice-container {
                width: 100%;
                max-width: 100%;
              }
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 20px;
                border-bottom: 2px solid #000;
                padding-bottom: 15px;
              }
              .shop-info {
                flex: 1;
              }
              .shop-info h1 {
                font-size: 18px;
                font-weight: bold;
                margin: 0 0 10px 0;
                text-transform: uppercase;
              }
              .shop-info p {
                margin: 3px 0;
                font-size: 11px;
              }
              .logo-container {
                width: 100px;
                height: 100px;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 1px solid #ddd;
                border-radius: 50%;
                overflow: hidden;
                background: #fff;
              }
              .logo-container img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
              }
              .invoice-title {
                text-align: center;
                font-size: 24px;
                font-weight: bold;
                margin: 20px 0;
                text-transform: uppercase;
              }
              .invoice-details {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
              }
              .billing-section, .shipping-section {
                flex: 1;
                margin-right: 20px;
              }
              .billing-section h3, .shipping-section h3 {
                font-size: 14px;
                font-weight: bold;
                margin: 0 0 10px 0;
                text-transform: uppercase;
              }
              .billing-section p, .shipping-section p {
                margin: 3px 0;
                font-size: 11px;
              }
              .invoice-info {
                text-align: right;
              }
              .invoice-info p {
                margin: 5px 0;
                font-size: 11px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
              }
              table thead {
                background-color: #f0f0f0;
              }
              table th {
                padding: 10px 5px;
                text-align: left;
                font-weight: bold;
                font-size: 11px;
                border: 1px solid #000;
                text-transform: uppercase;
              }
              table td {
                padding: 8px 5px;
                font-size: 11px;
                border: 1px solid #000;
              }
              table td.text-right {
                text-align: right;
              }
              table td.text-center {
                text-align: center;
              }
              .totals-section {
                display: flex;
                justify-content: flex-end;
                margin-top: 20px;
              }
              .totals-table {
                width: 300px;
              }
              .totals-table td {
                padding: 5px 10px;
              }
              .totals-table td:first-child {
                text-align: right;
                font-weight: bold;
              }
              .totals-table td:last-child {
                text-align: right;
              }
              .grand-total {
                font-weight: bold;
                font-size: 14px;
                border-top: 2px solid #000;
                border-bottom: 2px solid #000;
              }
              .footer {
                margin-top: 40px;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
              }
              .bank-details {
                width: 300px;
              }
              .bank-details h3 {
                font-size: 12px;
                font-weight: bold;
                margin: 0 0 10px 0;
                text-transform: uppercase;
              }
              .bank-details p {
                margin: 3px 0;
                font-size: 11px;
              }
              .signature-section {
                text-align: right;
                width: 200px;
              }
              .signature-section p {
                margin: 30px 0 5px 0;
                font-size: 11px;
              }
              .signature-line {
                border-top: 1px solid #000;
                margin-top: 50px;
                padding-top: 5px;
              }
              .query-contact {
                margin-top: 20px;
                font-size: 11px;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="invoice-container">
              <!-- Header -->
              <div class="header">
                <div class="shop-info">
                  <h1>${(shop.shop_name || '').toUpperCase()}</h1>
                  ${shop.address ? `<p>${shop.address}</p>` : ''}
                  ${shop.phone ? `<p>Phone No.: ${shop.phone}</p>` : ''}
                  ${shop.email ? `<p>Email ID: ${shop.email}</p>` : ''}
                  ${shop.gstin ? `<p>GSTIN: ${shop.gstin}</p>` : ''}
                  ${shop.state ? `<p>State: ${shop.state.toUpperCase()}</p>` : ''}
                </div>
                ${shop.logo_url && template?.sections?.header?.showLogo ? `
                  <div class="logo-container">
                    <img src="${shop.logo_url}" alt="Logo" />
                  </div>
                ` : ''}
              </div>

              <!-- Invoice Title -->
              <div class="invoice-title">TAX Invoice</div>

              <!-- Billing and Shipping Info -->
              <div class="invoice-details">
                <div class="billing-section">
                  <h3>Bill To:</h3>
                  ${bill.customer_name ? `<p>${bill.customer_name}</p>` : ''}
                  ${bill.customer_address ? `<p>${bill.customer_address}</p>` : ''}
                  ${bill.customer_phone ? `<p>Contact No.: ${bill.customer_phone}</p>` : ''}
                  ${bill.customer_gstin ? `<p>GSTIN No.: ${bill.customer_gstin}</p>` : ''}
                  ${shop.state ? `<p>${shop.state.toUpperCase()}</p>` : ''}
                </div>
                <div class="shipping-section">
                  <h3>Shipping To:</h3>
                  ${bill.shipping_address || bill.customer_address ? `
                    <p>${bill.shipping_address || bill.customer_address}</p>
                  ` : ''}
                </div>
                <div class="invoice-info">
                  <p><strong>Invoice No.:</strong> ${bill.bill_number}</p>
                  <p><strong>Date:</strong> ${formatDate(bill.created_at)}</p>
                </div>
              </div>

              <!-- Items Table -->
              <table>
                <thead>
                  <tr>
                    <th>SL NO</th>
                    <th>ITEMS</th>
                    ${template?.sections?.items?.columns?.includes('hsn') ? '<th>HSN</th>' : ''}
                    <th class="text-right">UNIT PRICE</th>
                    <th class="text-center">QUANTITY</th>
                    <th class="text-right">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  ${bill.items.map((item: any, index: number) => `
                    <tr>
                      <td class="text-center">${index + 1}</td>
                      <td>${item.product_name}</td>
                      ${template?.sections?.items?.columns?.includes('hsn') ? `
                        <td class="text-center">${item.hsn_code || '-'}</td>
                      ` : ''}
                      <td class="text-right">${formatCurrency(item.unit_price)}</td>
                      <td class="text-center">${formatQuantity(item.quantity)}</td>
                      <td class="text-right">${formatCurrency(item.total_amount)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <!-- Totals Section -->
              <div class="totals-section">
                <table class="totals-table">
                  <tr>
                    <td>TOTAL:</td>
                    <td>${formatCurrency(totalTaxable)}</td>
                  </tr>
                  ${template?.sections?.totals?.showSGST && totalSGST > 0 ? `
                    <tr>
                      <td>SGST ${cgstRate.toFixed(1)}%:</td>
                      <td>${formatCurrency(totalSGST)}</td>
                    </tr>
                  ` : ''}
                  ${template?.sections?.totals?.showCGST && totalCGST > 0 ? `
                    <tr>
                      <td>CGST ${sgstRate.toFixed(1)}%:</td>
                      <td>${formatCurrency(totalCGST)}</td>
                    </tr>
                  ` : ''}
                  <tr class="grand-total">
                    <td>GRAND TOTAL:</td>
                    <td>${formatCurrency(total)}</td>
                  </tr>
                </table>
              </div>

              <!-- Footer -->
              <div class="footer">
                ${template?.sections?.bankDetails?.enabled && (shop.bank_name || shop.account_number) ? `
                  <div class="bank-details">
                    <h3>BANK DETAILS:</h3>
                    ${shop.bank_name ? `<p>${shop.bank_name.toUpperCase()}</p>` : ''}
                    ${shop.bank_branch ? `<p>${shop.bank_branch}</p>` : ''}
                    ${shop.account_number ? `<p>ACCOUNT NO: ${shop.account_number}</p>` : ''}
                    ${shop.ifsc_code ? `<p>IFSC CODE: ${shop.ifsc_code}</p>` : ''}
                  </div>
                ` : '<div></div>'}
                ${template?.sections?.footer?.showSignature ? `
                  <div class="signature-section">
                    <div class="signature-line"></div>
                    <p>Signature</p>
                  </div>
                ` : ''}
              </div>

              ${template?.sections?.footer?.showQueryContact && shop.email ? `
                <div class="query-contact">
                  In the case of any queries write us to ${shop.email}
                </div>
              ` : ''}
            </div>
          </body>
        </html>
      `);
      
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        setTimeout(() => {
          window.focus();
        }, 100);
      }, 250);
      
      setPrinting(false);
    } catch (error: any) {
      console.error('Print error:', error);
      toast.error('Failed to print invoice');
      setPrinting(false);
      
      // Log print error to console (frontend errors are logged client-side)
      console.error('A4 invoice print failed:', {
        error: error.message,
        billId: bill.id,
        billNumber: bill.bill_number,
        stack: error.stack
      });
    }
  };

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        printInvoice();
      }}
      disabled={printing || !shop}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      type="button"
    >
      {printing ? 'Printing...' : '📄 Print Invoice (A4)'}
    </button>
  );
}


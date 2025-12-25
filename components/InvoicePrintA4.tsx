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
      header: { enabled: true, showLogo: true, logoPosition: 'right' },
      billing: { enabled: true },
      shipping: { enabled: true },
      items: { columns: ['sl_no', 'items', 'hsn', 'unit_price', 'quantity', 'amount'] },
      totals: { showTaxBreakdown: true },
      bankDetails: { enabled: true },
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
      const itemSubtotal = parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 0);
      const discount = parseFloat(item.discount_amount || 0);
      const taxable = itemSubtotal - discount;
      
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
      const totalTaxable = subtotal - discount;
      
      // Calculate total CGST and SGST from breakdown
      let totalCGST = 0;
      let totalSGST = 0;
      let gstRate = 0;
      
      Object.keys(gstBreakdown).forEach(rate => {
        const rateNum = parseFloat(rate);
        if (rateNum > 0) {
          totalCGST += gstBreakdown[rateNum].cgst;
          totalSGST += gstBreakdown[rateNum].sgst;
          gstRate = rateNum; // Take the first non-zero rate (assuming single rate for simplicity)
        }
      });

      // If no GST rate found, use the calculated total GST amount to determine rate
      if (gstRate === 0 && totalTaxable > 0) {
        const totalGstAmount = parseFloat(bill.gst_amount || 0);
        if (totalGstAmount > 0) {
          gstRate = (totalGstAmount / totalTaxable) * 100;
        }
      }

      const cgstRate = gstRate / 2;
      const sgstRate = gstRate / 2;
      const grandTotal = parseFloat(bill.total_amount || 0);

      printWindow.document.open();
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Invoice ${bill.bill_number}</title>
            <style>
              @media print {
                @page { 
                  size: A4; 
                  margin: 10mm; 
                }
                body { 
                  margin: 0; 
                  padding: 0; 
                }
              }
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: Arial, sans-serif;
                font-size: 12px;
                line-height: 1.5;
                color: #000;
                margin: 0;
                padding: 15mm;
                width: 210mm;
                min-height: 297mm;
              }
              .invoice-container {
                width: 100%;
              }
              
              /* Header Section */
              .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 2px solid #000;
              }
              .shop-info {
                flex: 1;
              }
              .shop-info h1 {
                font-size: 16px;
                font-weight: bold;
                margin: 0 0 8px 0;
                text-transform: uppercase;
              }
              .shop-info p {
                margin: 2px 0;
                font-size: 11px;
                line-height: 1.4;
              }
              .logo-container {
                width: 80px;
                height: 80px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                overflow: hidden;
                background: #fff;
                flex-shrink: 0;
              }
              .logo-container img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
              }
              
              /* Invoice Title */
              .invoice-title {
                text-align: center;
                font-size: 22px;
                font-weight: bold;
                margin: 15px 0;
                text-transform: uppercase;
              }
              
              /* Billing Details Section */
              .details-section {
                display: flex;
                justify-content: space-between;
                margin-bottom: 15px;
              }
              .billing-box {
                flex: 1;
                margin-right: 15px;
              }
              .shipping-box {
                flex: 1;
                margin-right: 15px;
              }
              .invoice-info-box {
                flex: 0 0 200px;
                text-align: right;
              }
              .section-heading {
                font-size: 12px;
                font-weight: bold;
                margin: 0 0 5px 0;
                text-transform: uppercase;
              }
              .section-content p {
                margin: 2px 0;
                font-size: 11px;
                line-height: 1.4;
              }
              
              /* Items Table */
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
              }
              table thead th {
                background-color: #f5f5f5;
                padding: 8px 5px;
                text-align: left;
                font-weight: bold;
                font-size: 11px;
                border: 1px solid #000;
                text-transform: uppercase;
              }
              table thead th.text-right {
                text-align: right;
              }
              table thead th.text-center {
                text-align: center;
              }
              table tbody td {
                padding: 6px 5px;
                font-size: 11px;
                border: 1px solid #000;
              }
              table tbody td.text-right {
                text-align: right;
              }
              table tbody td.text-center {
                text-align: center;
              }
              
              /* Totals Section */
              .totals-section {
                display: flex;
                justify-content: flex-end;
                margin-top: 15px;
              }
              .totals-table {
                width: 280px;
                border-collapse: collapse;
              }
              .totals-table td {
                padding: 6px 10px;
                font-size: 11px;
                border: none;
              }
              .totals-table td:first-child {
                text-align: right;
                font-weight: bold;
                padding-right: 15px;
              }
              .totals-table td:last-child {
                text-align: right;
                font-weight: normal;
              }
              .totals-table tr.grand-total td {
                font-weight: bold;
                font-size: 12px;
                border-top: 2px solid #000;
                border-bottom: 2px solid #000;
                padding: 8px 10px;
              }
              .totals-table tr.grand-total td:first-child {
                padding-right: 15px;
              }
              
              /* Footer Section */
              .footer-section {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-top: 30px;
              }
              .bank-details {
                flex: 1;
              }
              .bank-details h3 {
                font-size: 12px;
                font-weight: bold;
                margin: 0 0 8px 0;
                text-transform: uppercase;
              }
              .bank-details p {
                margin: 2px 0;
                font-size: 11px;
                line-height: 1.4;
              }
              .signature-section {
                flex: 0 0 180px;
                text-align: right;
              }
              .signature-line {
                border-top: 1px solid #000;
                margin-top: 50px;
                padding-top: 5px;
                width: 100%;
              }
              .signature-section p {
                font-size: 11px;
                margin: 0;
              }
              
              /* Query Contact */
              .query-contact {
                margin-top: 20px;
                text-align: center;
                font-size: 11px;
                font-style: italic;
              }
            </style>
          </head>
          <body>
            <div class="invoice-container">
              <!-- Header: Shop Info and Logo -->
              <div class="header">
                <div class="shop-info">
                  <h1>${(shop.shop_name || '').toUpperCase()}</h1>
                  ${shop.address ? `<p>${shop.address}</p>` : ''}
                  ${shop.phone ? `<p>Phone No.: ${shop.phone}</p>` : ''}
                  ${shop.email ? `<p>Email ID: ${shop.email}</p>` : ''}
                  ${shop.gstin ? `<p>GSTIN: ${shop.gstin}</p>` : ''}
                  ${shop.state ? `<p>State: ${shop.state.toUpperCase()}</p>` : ''}
                </div>
                ${shop.logo_url ? `
                  <div class="logo-container">
                    <img src="${shop.logo_url}" alt="Logo" />
                  </div>
                ` : ''}
              </div>

              <!-- Invoice Title -->
              <div class="invoice-title">TAX Invoice</div>

              <!-- Billing, Shipping, and Invoice Details -->
              <div class="details-section">
                <div class="billing-box">
                  <div class="section-heading">Bill To:</div>
                  <div class="section-content">
                    ${bill.customer_name ? `<p>${bill.customer_name}</p>` : ''}
                    ${bill.customer_address ? `<p>${bill.customer_address}</p>` : ''}
                    ${bill.customer_phone ? `<p>Contact No.: ${bill.customer_phone}</p>` : '<p>Contact No.: </p>'}
                    ${bill.customer_gstin ? `<p>GSTIN No.: ${bill.customer_gstin}</p>` : '<p>GSTIN No.: </p>'}
                    ${shop.state ? `<p>${shop.state.toUpperCase()}</p>` : ''}
                  </div>
                </div>
                <div class="shipping-box">
                  <div class="section-heading">Shipping To:</div>
                  <div class="section-content">
                    ${bill.shipping_address || bill.customer_address ? `
                      <p>${bill.shipping_address || bill.customer_address}</p>
                    ` : ''}
                  </div>
                </div>
                <div class="invoice-info-box">
                  <div class="section-content">
                    <p><strong>Invoice No.:</strong> ${bill.bill_number}</p>
                    <p><strong>Date:</strong> ${formatDate(bill.created_at)}</p>
                  </div>
                </div>
              </div>

              <!-- Items Table -->
              <table>
                <thead>
                  <tr>
                    <th>SL NO</th>
                    <th>ITEMS</th>
                    <th>HSN</th>
                    <th class="text-right">UNIT PRICE</th>
                    <th class="text-center">QUANTITY</th>
                    <th class="text-right">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  ${bill.items.map((item: any, index: number) => {
                    const itemAmount = parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 0);
                    return `
                      <tr>
                        <td class="text-center">${index + 1}</td>
                        <td>${item.product_name}</td>
                        <td class="text-center">${item.hsn_code || '-'}</td>
                        <td class="text-right">${formatCurrency(item.unit_price)}</td>
                        <td class="text-center">${formatQuantity(item.quantity)}</td>
                        <td class="text-right">${formatCurrency(itemAmount)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>

              <!-- Totals Section -->
              <div class="totals-section">
                <table class="totals-table">
                  <tr>
                    <td>TOTAL:</td>
                    <td>${formatCurrency(totalTaxable)}</td>
                  </tr>
                  ${totalSGST > 0 ? `
                    <tr>
                      <td>SGST ${sgstRate.toFixed(1)}%:</td>
                      <td>${formatCurrency(totalSGST)}</td>
                    </tr>
                  ` : ''}
                  ${totalCGST > 0 ? `
                    <tr>
                      <td>CGST ${cgstRate.toFixed(1)}%:</td>
                      <td>${formatCurrency(totalCGST)}</td>
                    </tr>
                  ` : ''}
                  <tr class="grand-total">
                    <td>GRAND TOTAL:</td>
                    <td>${formatCurrency(grandTotal)}</td>
                  </tr>
                </table>
              </div>

              <!-- Footer: Bank Details and Signature -->
              <div class="footer-section">
                ${(shop.bank_name || shop.account_number) ? `
                  <div class="bank-details">
                    <h3>BANK DETAILS</h3>
                    ${shop.bank_name ? `<p>${shop.bank_name.toUpperCase()}</p>` : ''}
                    ${shop.bank_branch ? `<p>${shop.bank_branch.toUpperCase()}</p>` : ''}
                    ${shop.account_number ? `<p>ACCOUNT NO: ${shop.account_number}</p>` : ''}
                    ${shop.ifsc_code ? `<p>IFSC CODE: ${shop.ifsc_code}</p>` : ''}
                  </div>
                ` : '<div></div>'}
                <div class="signature-section">
                  <div class="signature-line"></div>
                  <p>Signature</p>
                </div>
              </div>

              <!-- Query Contact Footer -->
              ${shop.email ? `
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

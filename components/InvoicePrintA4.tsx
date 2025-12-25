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
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Tax Invoice</title>
            <style>
              @page {
                size: A4;
                margin: 12mm;
              }
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                font-family: Arial, Helvetica, sans-serif;
                font-size: 12px;
                color: #000;
              }
              .invoice {
                border: 2px solid #000;
                padding: 10px;
              }
              .header {
                display: flex;
                justify-content: space-between;
                border-bottom: 2px solid #000;
                padding-bottom: 10px;
              }
              .company-details {
                width: 70%;
                line-height: 1.5;
              }
              .company-details strong {
                font-weight: bold;
              }
              .logo-box {
                width: 25%;
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .logo-box img {
                max-width: 100%;
                height: auto;
                max-height: 100px;
              }
              .title {
                text-align: center;
                font-size: 18px;
                font-weight: bold;
                margin: 10px 0;
                border-bottom: 2px solid #000;
                padding-bottom: 5px;
              }
              .billing {
                display: flex;
                border-bottom: 2px solid #000;
              }
              .billing div {
                width: 50%;
                padding: 8px;
                border-right: 1px solid #000;
              }
              .billing div:last-child {
                border-right: none;
              }
              .billing div strong {
                font-weight: bold;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
              }
              table th, table td {
                border: 1px solid #000;
                padding: 6px;
                text-align: center;
              }
              table th {
                background: #f2f2f2;
                font-weight: bold;
              }
              .text-left {
                text-align: left;
              }
              .text-right {
                text-align: right;
              }
              .totals {
                width: 40%;
                float: right;
                margin-top: 10px;
              }
              .totals table {
                margin-top: 0;
              }
              .totals table td {
                border: 1px solid #000;
              }
              .totals table th {
                background: #f2f2f2;
              }
              .bank {
                margin-top: 60px;
                border-top: 2px solid #000;
                padding-top: 8px;
                clear: both;
              }
              .bank strong {
                font-weight: bold;
              }
              .footer {
                margin-top: 40px;
                display: flex;
                justify-content: space-between;
              }
              .signature {
                text-align: right;
                margin-top: 40px;
              }
            </style>
          </head>
          <body>
            <div class="invoice">
              <!-- Header -->
              <div class="header">
                <div class="company-details">
                  <strong>${(shop.shop_name || '').toUpperCase()}</strong><br>
                  ${shop.address ? (typeof shop.address === 'string' ? shop.address.replace(/\\n/g, '<br>') : shop.address) + '<br>' : ''}
                  ${shop.phone ? `Phone: ${shop.phone}<br>` : ''}
                  ${shop.email ? `Email: ${shop.email}<br>` : ''}
                  ${shop.gstin ? `GSTIN: ${shop.gstin}<br>` : ''}
                  ${shop.state ? `State: ${shop.state}` : ''}
                </div>
                ${shop.logo_url ? `
                  <div class="logo-box">
                    <img src="${shop.logo_url}" alt="Company Logo">
                  </div>
                ` : '<div class="logo-box"></div>'}
              </div>

              <!-- Title -->
              <div class="title">TAX INVOICE</div>

              <!-- Billing -->
              <div class="billing">
                <div>
                  <strong>Bill To:</strong><br>
                  ${bill.customer_name || ''}<br>
                  ${bill.customer_address ? (typeof bill.customer_address === 'string' ? bill.customer_address.replace(/\\n/g, '<br>') : bill.customer_address) + '<br>' : ''}
                  ${bill.customer_phone ? `Contact: ${bill.customer_phone}<br>` : ''}
                  ${bill.customer_gstin ? `GSTIN: ${bill.customer_gstin}<br>` : 'GSTIN:<br>'}
                  ${shop.state ? `State: ${shop.state}` : 'State:'}
                </div>
                <div>
                  <strong>Invoice No:</strong> ${bill.bill_number}<br>
                  <strong>Date:</strong> ${formatDate(bill.created_at)}<br><br>
                  <strong>Shipping To:</strong><br>
                  ${bill.shipping_address || bill.customer_address ? (typeof (bill.shipping_address || bill.customer_address) === 'string' ? (bill.shipping_address || bill.customer_address).replace(/\\n/g, '<br>') : (bill.shipping_address || bill.customer_address)) + '<br>' : ''}
                </div>
              </div>

              <!-- Items Table -->
              <table>
                <thead>
                  <tr>
                    <th>SL NO</th>
                    <th class="text-left">ITEMS</th>
                    <th>HSN</th>
                    <th>UNIT PRICE</th>
                    <th>QTY</th>
                    <th>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  ${bill.items.map((item: any, index: number) => {
                    const itemAmount = parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 0);
                    return `
                      <tr>
                        <td>${index + 1}</td>
                        <td class="text-left">${item.product_name}</td>
                        <td>${item.hsn_code || '-'}</td>
                        <td class="text-right">${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                        <td>${parseFloat(item.quantity || 0).toFixed(0)}</td>
                        <td class="text-right">${itemAmount.toFixed(2)}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>

              <!-- Totals -->
              <div class="totals">
                <table>
                  <tr>
                    <td>Total</td>
                    <td class="text-right">${totalTaxable.toFixed(2)}</td>
                  </tr>
                  ${totalSGST > 0 ? `
                    <tr>
                      <td>SGST (${sgstRate.toFixed(1)}%)</td>
                      <td class="text-right">${totalSGST.toFixed(2)}</td>
                    </tr>
                  ` : ''}
                  ${totalCGST > 0 ? `
                    <tr>
                      <td>CGST (${cgstRate.toFixed(1)}%)</td>
                      <td class="text-right">${totalCGST.toFixed(2)}</td>
                    </tr>
                  ` : ''}
                  <tr>
                    <th>Grand Total</th>
                    <th class="text-right">${grandTotal.toFixed(2)}</th>
                  </tr>
                </table>
              </div>

              <!-- Bank -->
              ${(shop.bank_name || shop.account_number) ? `
                <div class="bank">
                  <strong>Bank Details</strong><br>
                  ${shop.bank_name ? `Bank Name: ${shop.bank_name}<br>` : ''}
                  ${shop.account_number ? `Account No: ${shop.account_number}<br>` : ''}
                  ${shop.ifsc_code ? `IFSC: ${shop.ifsc_code}` : ''}
                </div>
              ` : ''}

              <!-- Footer -->
              <div class="footer">
                <div>
                  ${shop.email ? `In case of any queries write to ${shop.email}` : ''}
                </div>
                <div class="signature">
                  Authorized Signature
                </div>
              </div>
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

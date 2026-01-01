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

      const printWindow = window.open('', '_blank', 'width=900,height=700');
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
      
      // Format shop address for display
      const formatAddress = (address: string) => {
        if (!address) return '';
        return address.replace(/\n/g, '<br>');
      };

      printWindow.document.open();
      printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <title>Tax Invoice</title>
            <style>
              body {
                font-family: Arial, Helvetica, sans-serif;
                background: #f5f5f5;
              }
              .invoice {
                width: 800px;
                margin: 20px auto;
                background: #fff;
                padding: 20px;
                border: 2px solid #000;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 14px;
              }
              td, th {
                border: 1px solid #000;
                padding: 6px;
                vertical-align: top;
              }
              .no-border td {
                border: none;
              }
              .header td {
                border: 1px solid #000;
              }
              .logo {
                text-align: center;
              }
              .logo img {
                width: 120px;
              }
              .title {
                text-align: center;
                font-size: 26px;
                font-weight: bold;
                padding: 10px 0;
              }
              .yellow {
                background: #fff176;
                font-weight: bold;
                text-align: center;
              }
              .right {
                text-align: right;
              }
              .center {
                text-align: center;
              }
              .bold {
                font-weight: bold;
              }
              .totals td {
                font-weight: bold;
              }
              .footer {
                margin-top: 30px;
                font-size: 13px;
              }
              .signature {
                text-align: right;
                margin-top: 40px;
              }
              @media print {
                body {
                  background: none;
                }
                .invoice {
                  margin: 0;
                  border: 2px solid #000;
                }
              }
            </style>
          </head>
          <body>
            <div class="invoice">
              <!-- TOP HEADER -->
              <table class="header">
                <tr>
                  <td width="70%">
                    <b>Company/Seller Name:</b> ${(shop.shop_name || '').toUpperCase()}<br>
                    ${shop.address ? `<b>Address:</b> ${formatAddress(shop.address)}<br>` : ''}
                    ${shop.phone ? `<b>Phone No.:</b> ${shop.phone}<br>` : ''}
                    ${shop.email ? `<b>Email ID:</b> ${shop.email}<br>` : ''}
                    ${shop.gstin ? `<b>GSTIN:</b> ${shop.gstin}<br>` : ''}
                    ${shop.state ? `<b>State:</b> ${(shop.state || '').toUpperCase()}` : ''}
                  </td>
                  <td class="logo">
                    ${shop.logo_url ? `<img src="${shop.logo_url}" alt="Company Logo">` : ''}
                  </td>
                </tr>
              </table>

              <!-- TITLE -->
              <div class="title">TAX Invoice</div>

              <!-- BILL / SHIP DETAILS -->
              <table>
                <tr>
                  <td width="50%">
                    <b>Bill To:</b><br>
                    ${bill.customer_name || ''}<br>
                    ${bill.customer_address ? formatAddress(bill.customer_address) + '<br>' : ''}
                    ${bill.customer_phone ? `<b>Contact No.:</b> ${bill.customer_phone}<br>` : '<b>Contact No.:</b><br>'}
                    ${bill.customer_gstin ? `<b>GSTIN No.:</b> ${bill.customer_gstin}<br>` : '<b>GSTIN No.:</b><br>'}
                    ${shop.state ? (shop.state || '').toUpperCase() : ''}
                  </td>
                  <td width="50%">
                    <b>Shipping To:</b><br>
                    ${bill.shipping_address || bill.customer_address ? formatAddress(bill.shipping_address || bill.customer_address) + '<br><br>' : '<br><br>'}
                    <b>Invoice No.:</b> ${bill.bill_number}<br>
                    <b>Date:</b> ${formatDate(bill.created_at)}
                  </td>
                </tr>
              </table>

              <!-- ITEMS TABLE -->
              <table>
                <tr class="yellow">
                  <td>SL NO</td>
                  <td>ITEMS</td>
                  <td>HSN</td>
                  <td>UNIT PRICE</td>
                  <td>QUANTITY</td>
                  <td>AMOUNT</td>
                </tr>
                ${bill.items.map((item: any, index: number) => {
                  const itemAmount = parseFloat(item.unit_price || 0) * parseFloat(item.quantity || 0);
                  return `
                    <tr>
                      <td class="center">${index + 1}</td>
                      <td>${item.product_name}</td>
                      <td>${item.hsn_code || ''}</td>
                      <td class="right">${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                      <td class="center">${parseFloat(item.quantity || 0).toFixed(0)}</td>
                      <td class="right">${itemAmount.toFixed(2)}</td>
                    </tr>
                  `;
                }).join('')}
                <!-- EMPTY ROWS FOR SPACE -->
                <tr><td colspan="6" style="height:140px;"></td></tr>
              </table>

              <!-- TOTALS & BANK -->
              <table>
                <tr>
                  <td width="50%">
                    ${(shop.bank_name || shop.account_number) ? `
                      <b>BANK DETAILS</b><br>
                      ${shop.bank_name ? `${(shop.bank_name || '').toUpperCase()}${shop.bank_branch ? ' ' + (shop.bank_branch || '').toUpperCase() + ' BRANCH' : ''}<br>` : ''}
                      ${shop.account_number ? `<b>ACCOUNT NO:</b> ${shop.account_number}<br>` : ''}
                      ${shop.ifsc_code ? `<b>IFSC CODE:</b> ${shop.ifsc_code}` : ''}
                    ` : ''}
                  </td>
                  <td width="50%">
                    <table>
                      <tr>
                        <td>TOTAL</td>
                        <td class="right">${totalTaxable.toFixed(2)}</td>
                      </tr>
                      ${totalSGST > 0 ? `
                        <tr>
                          <td>SGST ${sgstRate.toFixed(1)}%</td>
                          <td class="right">${totalSGST.toFixed(2)}</td>
                        </tr>
                      ` : ''}
                      ${totalCGST > 0 ? `
                        <tr>
                          <td>CGST ${cgstRate.toFixed(1)}%</td>
                          <td class="right">${totalCGST.toFixed(2)}</td>
                        </tr>
                      ` : ''}
                      ${Math.abs(parseFloat(bill.round_off || 0)) > 0.01 ? `
                        <tr>
                          <td>Round Off</td>
                          <td class="right">${parseFloat(bill.round_off || 0) > 0 ? '+' : ''}${Math.abs(parseFloat(bill.round_off || 0)).toFixed(2)}</td>
                        </tr>
                      ` : ''}
                      <tr class="totals">
                        <td>GRAND TOTAL</td>
                        <td class="right">${grandTotal.toFixed(2)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- FOOTER -->
              <div class="footer">
                ${shop.email ? `In the case of any queries write us to ${shop.email}` : ''}
              </div>

              <div class="signature">
                _______________________<br>
                Signature
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

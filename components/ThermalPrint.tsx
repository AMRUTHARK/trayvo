'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { formatCurrency, formatQuantity, formatNumber } from '@/lib/format';

interface ThermalPrintProps {
  bill: any;
}

export default function ThermalPrint({ bill }: ThermalPrintProps) {
  const [printing, setPrinting] = useState(false);
  const [shop, setShop] = useState<any>(null);

  useEffect(() => {
    fetchShopSettings();
  }, []);

  const fetchShopSettings = async () => {
    try {
      const response = await api.get('/shops');
      setShop(response.data.data);
    } catch (error) {
      console.error('Failed to fetch shop settings:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${day}/${month}/${year}, ${displayHours}:${minutes} ${ampm}`;
  };

  const formatPaymentMode = (mode: string) => {
    // Convert payment mode to proper display format
    const modeLower = mode.toLowerCase();
    if (modeLower === 'upi') {
      return 'UPI';
    }
    return mode.charAt(0).toUpperCase() + mode.slice(1);
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
        // Track 0% GST items separately
        if (!gstMap[0]) {
          gstMap[0] = { cgst: 0, sgst: 0, taxable: 0 };
        }
        gstMap[0].taxable += taxable;
      }
    });

    return gstMap;
  };

  const printBill = async () => {
    setPrinting(true);
    
    // Check if Web Serial API is available
    const hasSerialSupport = 'serial' in navigator;
    
    if (!hasSerialSupport) {
      // No serial support, use browser print directly
      printUsingBrowser();
      setPrinting(false);
      return;
    }

    try {
      // ESC/POS commands for thermal printer
      const ESC = '\x1B';
      const GS = '\x1D';
      const shopName = shop?.shop_name || 'TRAYVO';
      const shopAddress = shop?.address || '';
      const shopPhone = shop?.phone || '';
      const shopGstin = shop?.gstin || '';

      let printContent = '';

      // Initialize printer
      printContent += ESC + '@'; // Reset printer

      // Center align and set font
      printContent += ESC + 'a' + '\x01'; // Center align
      printContent += ESC + '!' + '\x10'; // Double height, double width

      // Shop name (centered, bold, uppercase)
      printContent += shopName.toUpperCase() + '\n';
      printContent += ESC + '!' + '\x00'; // Normal size
      
      // Shop address (centered, one line)
      if (shopAddress) {
        printContent += shopAddress.toUpperCase() + '\n';
      }
      
      // Phone number (centered, with PHONE: prefix)
      if (shopPhone) {
        printContent += 'PHONE: ' + shopPhone + '\n';
      }
      
      // GSTIN (centered, with GSTIN: prefix)
      if (shopGstin) {
        printContent += 'GSTIN: ' + shopGstin + '\n';
      }
      
      printContent += ESC + '!' + '\x10'; // Double size
      printContent += 'Retail Invoice\n';
      printContent += ESC + '!' + '\x00'; // Normal size
      printContent += '--------------------------------\n';

      // Invoice details
      printContent += ESC + 'a' + '\x00'; // Left align
      printContent += `Date: ${formatDate(bill.created_at)}\n`;
      if (bill.customer_name) {
        printContent += `Customer Name: ${bill.customer_name}\n`;
      }
      printContent += `Bill No: ${bill.bill_number}\n`;
      printContent += `Payment Mode: ${formatPaymentMode(bill.payment_mode)}\n`;
      printContent += `DR Ref: ${bill.id}\n`;
      printContent += '--------------------------------\n';

      // Items table header
      printContent += 'Item                    Qty    Rate    Amt\n';
      printContent += '--------------------------------\n';

      // Items
      bill.items.forEach((item: any) => {
        const name = item.product_name || '';
        const qty = parseFloat(item.quantity || 0);
        const rate = parseFloat(item.unit_price || 0);
        const amt = parseFloat(item.total_amount || 0);
        const gstRate = parseFloat(item.gst_rate || 0);
        // Format: Item name (truncated to fit), Qty, Rate, Amt
        const namePart = name.substring(0, 18).padEnd(18);
        // Format quantities and amounts with locale (compact for thermal printer)
        const qtyFormatted = formatQuantity(qty, 3).replace(/,/g, '');
        const rateFormatted = formatNumber(rate, 2).replace(/,/g, '');
        const amtFormatted = formatNumber(amt, 2).replace(/,/g, '');
        const qtyPart = qtyFormatted.padStart(5);
        const ratePart = ('₹' + rateFormatted).padStart(6);
        const amtPart = ('₹' + amtFormatted).padStart(8);
        printContent += `${namePart} ${qtyPart} ${ratePart} ${amtPart}\n`;
        // Show GST% if applicable
        if (gstRate > 0) {
          const gstRateFormatted = formatNumber(gstRate, 2).replace(/,/g, '');
          printContent += `  GST ${gstRateFormatted}%\n`;
        }
      });

      printContent += '--------------------------------\n';

      // Summary section
      const totalQty = bill.items.reduce((sum: number, item: any) => sum + parseFloat(item.quantity || 0), 0);
      const numItems = bill.items.length;
      const subtotal = parseFloat(bill.subtotal || 0);
      const discount = parseFloat(bill.discount_amount || 0);
      const gstBreakdown = calculateGSTBreakdown(bill.items);
      const gstAmount = parseFloat(bill.gst_amount || 0);
      const total = parseFloat(bill.total_amount || 0);
      const roundOff = parseFloat(bill.round_off || 0);

      // Format amounts with locale (remove commas for thermal printer compactness)
      const subtotalFormatted = formatNumber(subtotal, 2).replace(/,/g, '');
      const discountFormatted = formatNumber(discount, 2).replace(/,/g, '');
      const totalFormatted = formatNumber(total, 2).replace(/,/g, '');
      const roundOffFormatted = formatNumber(Math.abs(roundOff), 2).replace(/,/g, '');
      const totalQtyFormatted = formatQuantity(totalQty, 3).replace(/,/g, '');

      printContent += `Sub Total: ₹${subtotalFormatted}\n`;
      
      if (discount > 0) {
        printContent += `(-) Discount: ₹${discountFormatted}\n`;
      }

      // GST breakdown by rate (improved format with taxable amounts)
      const gstRates = Object.keys(gstBreakdown).sort((a, b) => parseFloat(b) - parseFloat(a));
      gstRates.forEach((rate) => {
        const rateNum = parseFloat(rate);
        const { cgst, sgst, taxable } = gstBreakdown[rateNum];
        if (rateNum > 0 && taxable > 0) {
          const taxableFormatted = formatNumber(taxable, 2).replace(/,/g, '');
          const cgstFormatted = formatNumber(cgst, 2).replace(/,/g, '');
          const sgstFormatted = formatNumber(sgst, 2).replace(/,/g, '');
          const rateFormatted = formatNumber(rateNum, 2).replace(/,/g, '');
          printContent += `CGST ${rateFormatted}%: Taxable ₹${taxableFormatted}, Tax ₹${cgstFormatted}\n`;
          printContent += `SGST ${rateFormatted}%: Taxable ₹${taxableFormatted}, Tax ₹${sgstFormatted}\n`;
        }
      });

      // Show 0% GST items if any
      if (gstBreakdown[0] && gstBreakdown[0].taxable > 0) {
        const taxableFormatted = formatNumber(gstBreakdown[0].taxable, 2).replace(/,/g, '');
        printContent += `CGST 0%: Taxable ₹${taxableFormatted}, Tax ₹0.00\n`;
        printContent += `SGST 0%: Taxable ₹${taxableFormatted}, Tax ₹0.00\n`;
      }

      if (Math.abs(roundOff) > 0.01) {
        printContent += `Round Off: ₹${roundOff > 0 ? '+' : ''}${roundOffFormatted}\n`;
      }

      printContent += '--------------------------------\n';

      // Final totals with number of items and total quantity
      printContent += ESC + 'a' + '\x00'; // Left align
      printContent += `Number of Items: ${numItems}\n`;
      printContent += `Total Quantity: ${totalQtyFormatted}\n`;
      printContent += ESC + 'a' + '\x02'; // Right align
      printContent += ESC + '!' + '\x10'; // Double size
      printContent += `TOTAL: ₹${totalFormatted}\n`;
      printContent += ESC + '!' + '\x00'; // Normal size
      
      const paymentMode = formatPaymentMode(bill.payment_mode);
      printContent += `${paymentMode}: ₹${totalFormatted}\n`;
      if (bill.payment_mode === 'cash') {
        printContent += `Cash tendered: ₹${totalFormatted}\n`;
      }

      printContent += '--------------------------------\n';
      printContent += ESC + 'a' + '\x01'; // Center align
      if (shop?.email) {
        printContent += `Email: ${shop.email}\n`;
      }
      printContent += 'Thank You! Do Visit Again!\n';
      printContent += 'E & O.E\n';
      printContent += '\n\n\n';

      // Feed paper and cut
      printContent += GS + 'V' + '\x41' + '\x03'; // Cut paper

      // Try to print using browser print API or ESC/POS
      // Type assertion for Web Serial API (not in standard TypeScript types)
      if ('serial' in navigator && (navigator as any).serial) {
        // Web Serial API (Chrome/Edge)
        try {
          const port = await (navigator as any).serial.requestPort();
          await port.open({ baudRate: 9600 });
          const writer = port.writable?.getWriter();
          if (writer) {
            const encoder = new TextEncoder();
            await writer.write(encoder.encode(printContent));
            writer.releaseLock();
            await port.close();
            toast.success('Bill printed successfully!');
            return; // Success, exit early
          }
        } catch (error: any) {
          // User cancelled, no device found, or other error
          // Automatically fall back to browser print without showing error
          console.log('Serial print not available, using browser print');
          // Small delay to ensure serial dialog is closed
          setTimeout(() => {
            printUsingBrowser();
          }, 100);
        }
      } else {
        // Web Serial API not supported, use browser print
        printUsingBrowser();
      }
    } catch (error: any) {
      console.error('Print error:', error);
      // Always fall back to browser print on any error
      printUsingBrowser();
    } finally {
      setPrinting(false);
    }
  };

  const printUsingBrowser = () => {
    // Create a printable HTML version
    // Use a unique name to avoid focus issues
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Please allow popups to print');
      return;
    }
    
    // Ensure parent window remains interactive
    window.focus();

    const shopName = shop?.shop_name || 'TRAYVO';
    const shopAddress = shop?.address || '';
    const shopPhone = shop?.phone || '';
    const shopGstin = shop?.gstin || '';
    const shopEmail = shop?.email || '';
    const totalQty = bill.items.reduce((sum: number, item: any) => sum + parseFloat(item.quantity || 0), 0);
    const numItems = bill.items.length;
    const subtotal = parseFloat(bill.subtotal || 0);
    const discount = parseFloat(bill.discount_amount || 0);
    const gstAmount = parseFloat(bill.gst_amount || 0);
    const totalBeforeRound = subtotal - discount + gstAmount;
    const total = parseFloat(bill.total_amount || 0);
    const roundOff = total - totalBeforeRound;
    const gstBreakdown = calculateGSTBreakdown(bill.items);
    const gstRates = Object.keys(gstBreakdown).sort((a, b) => parseFloat(b) - parseFloat(a));

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill ${bill.bill_number}</title>
          <style>
            @media print {
              @page { size: 80mm auto; margin: 0; }
              body { width: 80mm; margin: 0; padding: 10px; font-family: monospace; font-size: 11px; }
            }
            body { width: 80mm; margin: 0; padding: 10px; font-family: monospace; font-size: 11px; }
            .header { text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 5px; }
            .shop-info { text-align: center; font-size: 10px; margin-bottom: 5px; }
            .doc-title { text-align: center; font-weight: bold; font-size: 16px; margin: 5px 0; }
            .divider { border-top: 1px dotted #000; margin: 8px 0; }
            .item-row { display: flex; justify-content: space-between; margin: 3px 0; }
            .item-name { flex: 1; }
            .item-qty { width: 50px; text-align: center; }
            .item-amt { width: 70px; text-align: right; }
            .summary { margin: 5px 0; }
            .summary-row { display: flex; justify-content: space-between; margin: 2px 0; }
            .total-row { font-weight: bold; font-size: 14px; margin-top: 5px; }
            .footer { text-align: center; margin-top: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { text-align: left; padding: 3px 0; }
            td { padding: 2px 0; }
            .right { text-align: right; }
            .center { text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">${shopName.toUpperCase()}</div>
          ${shopAddress ? `<div class="shop-info">${shopAddress.toUpperCase()}</div>` : ''}
          ${shopPhone ? `<div class="shop-info">PHONE: ${shopPhone}</div>` : ''}
          ${shopGstin ? `<div class="shop-info">GSTIN: ${shopGstin}</div>` : ''}
          <div class="doc-title">Retail Invoice</div>
          <div class="divider"></div>
          <div>Date: ${formatDate(bill.created_at)}</div>
          ${bill.customer_name ? `<div>Customer Name: ${bill.customer_name}</div>` : ''}
          <div>Bill No: ${bill.bill_number}</div>
          <div>Payment Mode: ${formatPaymentMode(bill.payment_mode)}</div>
          <div>DR Ref: ${bill.id}</div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="center">Qty</th>
                <th class="right">Rate</th>
                <th class="right">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${bill.items.map((item: any) => {
                const gstRate = parseFloat(item.gst_rate || 0);
                const quantity = formatQuantity(item.quantity);
                const unitPrice = formatCurrency(item.unit_price);
                const totalAmount = formatCurrency(item.total_amount);
                const gstRateFormatted = formatPercentage(gstRate);
                return `
                <tr>
                  <td>${item.product_name}${gstRate > 0 ? ` <small>(GST ${gstRateFormatted})</small>` : ''}</td>
                  <td class="center">${quantity}</td>
                  <td class="right">${unitPrice}</td>
                  <td class="right">${totalAmount}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="summary">
            <div class="summary-row"><span><strong>Sub Total:</strong></span><span>₹${subtotal.toFixed(2)}</span></div>
            ${discount > 0 ? `<div class="summary-row"><span>(-) Discount:</span><span>₹${discount.toFixed(2)}</span></div>` : ''}
            ${gstRates.map((rate) => {
              const rateNum = parseFloat(rate);
              const { cgst, sgst, taxable } = gstBreakdown[rateNum];
              if (rateNum > 0 && taxable > 0) {
                return `
                  <div class="summary-row"><span>CGST ${rateNum.toFixed(2)}% (Taxable ₹${taxable.toFixed(2)}):</span><span>₹${cgst.toFixed(2)}</span></div>
                  <div class="summary-row"><span>SGST ${rateNum.toFixed(2)}% (Taxable ₹${taxable.toFixed(2)}):</span><span>₹${sgst.toFixed(2)}</span></div>
                `;
              } else if (rateNum === 0 && taxable > 0) {
                return `
                  <div class="summary-row"><span>CGST 0% (Taxable ₹${taxable.toFixed(2)}):</span><span>₹0.00</span></div>
                  <div class="summary-row"><span>SGST 0% (Taxable ₹${taxable.toFixed(2)}):</span><span>₹0.00</span></div>
                `;
              }
              return '';
            }).join('')}
            ${Math.abs(roundOff) > 0.01 ? `<div class="summary-row"><span>Round Off:</span><span>₹${roundOff > 0 ? '+' : ''}${roundOff.toFixed(2)}</span></div>` : ''}
          </div>
          <div class="divider"></div>
          <div style="margin: 5px 0; font-size: 10px;">
            <div>Number of Items: ${numItems}</div>
            <div>Total Quantity: ${totalQty.toFixed(3)}</div>
          </div>
          <div class="divider"></div>
          <div class="total-row right">
            <div>TOTAL: ₹${total.toFixed(2)}</div>
            <div>${formatPaymentMode(bill.payment_mode)}: ₹${total.toFixed(2)}</div>
            ${bill.payment_mode === 'cash' ? `<div>Cash tendered: ₹${total.toFixed(2)}</div>` : ''}
          </div>
          <div class="divider"></div>
          <div class="footer">
            ${shopEmail ? `<div>Email: ${shopEmail}</div>` : ''}
            <div>Thank You! Do Visit Again!</div>
            <div>E & O.E</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    
    // Use setTimeout to ensure the window is fully loaded before printing
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      // Return focus to parent window after print dialog
      setTimeout(() => {
        window.focus();
      }, 100);
    }, 250);
  };

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        printBill();
      }}
      disabled={printing}
      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
      type="button"
    >
      {printing ? 'Printing...' : '🖨️ Print Bill'}
    </button>
  );
}


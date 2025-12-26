# Multi-Shop Billing System - Features & Functionality Guide

This document provides a comprehensive overview of all features available in the Multi-Shop Billing System, written for shop owners, administrators, and users.

---

## Table of Contents

1. [Core Features](#core-features)
2. [Sales & Billing](#sales--billing)
3. [Purchase Management](#purchase-management)
4. [Inventory Management](#inventory-management)
5. [Reports & Analytics](#reports--analytics)
6. [User Management](#user-management)
7. [Settings & Configuration](#settings--configuration)
8. [Printing & Invoicing](#printing--invoicing)

---

## Core Features

### Multi-Shop Support
- Each shop has completely isolated data and users
- No data sharing between shops
- Independent settings and configurations per shop

### Role-Based Access Control
- **Super Admin**: Manages all shops and system-wide settings
- **Shop Admin**: Full control over their shop (users, products, settings)
- **Cashier**: Can create bills and view limited reports

### Security Features
- Secure login with password protection
- Session timeout for inactive users
- Login history tracking
- Activity logging

---

## Sales & Billing

### Point of Sale (POS) Billing
- Fast and intuitive billing interface
- Quick product search and selection
- Real-time stock availability checking
- Multiple payment modes: Cash, UPI, Card, Mixed

### Bill Management

#### Creating Bills
- Add multiple products to a single bill
- Apply item-level discounts
- Apply bill-level discounts (amount or percentage)
- Automatic GST calculation
- Round-off for convenient payment amounts
- Customer details capture (name, phone, email, GSTIN, address)

#### Editing Bills ✨ NEW FEATURE
You can now edit completed bills to correct mistakes or make changes. This feature includes:

**What Can Be Edited:**
- Customer information (name, phone, email, GSTIN, address, shipping address)
- Products (add, remove, change quantities, update prices)
- HSN codes per item
- Item-level and bill-level discounts
- Payment mode
- Notes
- Invoice date (with restrictions)

**Safety Features:**
- **Automatic Stock Management**: Stock is automatically reversed and re-applied when editing
- **Validation Checks**: System prevents editing in certain scenarios:
  - Bills with returns cannot be edited (or have restrictions)
  - Bills locked after GST filing period cannot be edited
  - Bills marked as cancelled cannot be edited
- **Edit History**: Every edit is tracked with who edited, when, and what changed
- **Permission Control**: Only Admins can edit (Cashiers have time-restricted access)

**How to Edit a Bill:**
1. Go to Bills page
2. Select the bill you want to edit
3. Click "Edit Bill" button
4. Make your changes
5. Review the changes in the preview
6. Save the changes

**Edit Restrictions:**
- Bills older than 30 days may be locked (configurable)
- Bills with sales returns have restrictions on editing returned items
- Only one user can edit a bill at a time

#### Cancelling Bills
- Cancel incorrect bills
- Automatic stock restoration
- Bill marked as cancelled (cannot be edited after cancellation)

#### Hold/Resume Bills
- Save incomplete bills for later
- Resume and complete held bills
- Useful for customers who need time to decide

### Invoice Printing
- **Thermal Receipts**: Quick receipts for thermal printers (58mm/80mm)
- **A4 Professional Invoices**: Full tax invoices with company logo, bank details, and complete itemization
- Print directly from browser
- Support for thermal and A4 printers

---

## Purchase Management

### Purchase Orders

#### Creating Purchases
- Record purchases from suppliers
- Add multiple products in one purchase order
- Track supplier information
- Automatic stock increase upon purchase
- GST calculation for purchases
- Support for credit purchases

#### Editing Purchases ✨ NEW FEATURE
Similar to bill editing, you can now edit purchase orders:

**What Can Be Edited:**
- Supplier information (name, phone, email, address)
- Products (add, remove, change quantities, update prices)
- Discounts (item-level and purchase-level)
- Payment mode
- Notes

**Safety Features:**
- Stock is automatically adjusted when editing purchases
- Validation prevents editing purchases with returns
- Edit history tracking
- Permission-based access control

#### Purchase Returns
- Create returns for purchased items
- Automatic stock adjustment
- Supplier information maintained
- Return reasons tracking

#### Cancelling Purchases
- Cancel incorrect purchase orders
- Automatic stock reversal
- Purchase marked as cancelled

---

## Inventory Management

### Stock Tracking
- Real-time stock levels for all products
- Automatic stock updates on sales and purchases
- Stock ledger for complete transaction history

### Stock Adjustments
- Manual stock corrections
- Stock adjustments with reasons
- Track who made adjustments and when

### Low Stock Alerts
- Automatic alerts when stock falls below minimum levels
- Configurable minimum stock levels per product
- Dashboard notifications

### Stock Ledger
- Complete history of all stock movements
- Filter by product, transaction type, date range
- View all purchases, sales, returns, and adjustments

---

## Reports & Analytics

### Dashboard Analytics
- Today's sales summary
- Revenue trends (charts)
- Top-selling products
- Low stock alerts
- Recent activity overview

### Sales Reports
- Date range filtering
- Payment mode breakdown
- Customer-wise sales
- Product-wise sales
- Export to PDF/CSV

### GST Reports
- GST collected on sales
- GST paid on purchases
- Tax period summaries
- Export for GST filing

### Profit & Loss Reports
- Revenue vs expenses
- Category-wise profitability
- Margin analysis
- Export capabilities

### Category Reports
- Sales by category
- Performance metrics per category
- Date range filtering

---

## User Management

### User Roles
- **Admin**: Full access to all features
- **Cashier**: Can create bills and view basic reports
- User permissions based on role

### User Management (Admin Only)
- Create new users
- Update user information
- Deactivate users
- Password management

### Login History
- Track all user logins
- View login times and locations
- Security monitoring

---

## Settings & Configuration

### Shop Information
- Shop name and details
- Owner information
- Contact details (phone, email, address)
- GSTIN and state information
- Bank details (for invoices)

### Invoice Configuration
- Custom invoice number patterns
- Default invoice templates
- Template selection (Thermal/A4)
- Logo upload

### GST Settings
- Configure available GST rates
- Set default rates for products
- GST rate selection per product

### System Settings
- Printer configuration
- Display preferences
- Edit restrictions (lock period, permissions)

---

## Printing & Invoicing

### Invoice Templates

#### Thermal Receipt Template
- Quick receipt format
- Compact design for thermal printers
- Essential information only
- Fast printing

#### A4 Professional Invoice Template
- Complete tax invoice format
- Company logo support
- Detailed itemization with HSN codes
- Bank details section
- Signature area
- Professional layout matching standard tax invoice format

### Invoice Customization
- Select default template per print type
- Template preview
- Future: Custom template builder (coming soon)

---

## Data Management

### Export Features
- Export reports to PDF
- Export reports to CSV/Excel
- Data backup capabilities

### Data Security
- Regular data backups recommended
- Secure data storage
- Access logging and audit trails

---

## Best Practices

### For Shop Owners
1. **Regular Backups**: Export important reports regularly
2. **User Management**: Assign appropriate roles to staff
3. **Stock Monitoring**: Set minimum stock levels and monitor alerts
4. **Edit Bills Carefully**: Use edit feature only when necessary, as it affects stock and accounting
5. **Lock Periods**: Lock bills after GST filing to prevent unauthorized changes

### For Cashiers
1. **Double-Check Bills**: Verify customer details and items before finalizing
2. **Use Hold Feature**: Save incomplete bills instead of creating temporary ones
3. **Stock Awareness**: Check stock availability before selling
4. **Professional Service**: Always ask for customer details for better tracking

### For Admins
1. **Monitor Edit History**: Regularly review edited bills/purchases
2. **Set Edit Restrictions**: Configure appropriate lock periods based on your GST filing schedule
3. **User Permissions**: Only grant edit access to trusted staff
4. **Regular Audits**: Review stock ledger and edit history for accuracy

---

## Support & Help

For technical support or questions about features, please contact your system administrator or refer to the technical documentation.

---

**Last Updated**: This document is updated as new features are added to the system.


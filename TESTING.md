# Testing Instructions

This document provides instructions for testing the Multi-Shop Billing System.

## Prerequisites

1. Application is running (see README.md for setup)
2. Database is set up and schema is imported
3. Browser with developer tools enabled

## Test Scenarios

### 1. Registration & Authentication

#### Test 1.1: Register New Shop
1. Navigate to `/register`
2. Fill in all required fields:
   - Shop Name: "Test Shop"
   - Owner Name: "Test Owner"
   - Email: "test@example.com"
   - Username: "testadmin"
   - Password: "test123456"
3. Click "Register Shop"
4. **Expected**: Success message, redirect to login

#### Test 1.2: Login
1. Navigate to `/login`
2. Enter username: "testadmin"
3. Enter password: "test123456"
4. Click "Sign In"
5. **Expected**: Redirect to dashboard, user info displayed

#### Test 1.3: Invalid Login
1. Try logging in with wrong password
2. **Expected**: Error message displayed

### 2. Product Management

#### Test 2.1: Create Category
1. Navigate to Products page
2. Create a category (if categories endpoint exists in UI, or use API)
3. **Expected**: Category created successfully

#### Test 2.2: Create Product
1. Navigate to `/products`
2. Click "Add Product"
3. Fill in:
   - Name: "Test Product"
   - SKU: "TEST001"
   - Cost Price: 100
   - Selling Price: 150
   - Stock Quantity: 50
   - Min Stock Level: 10
4. Click "Create"
5. **Expected**: Product appears in list

#### Test 2.3: Search Products
1. In Products page, use search box
2. Type "Test"
3. **Expected**: Only matching products shown

#### Test 2.4: Edit Product
1. Click "Edit" on a product
2. Change selling price to 160
3. Click "Update"
4. **Expected**: Product updated, new price shown

#### Test 2.5: Delete Product
1. Click "Delete" on a product
2. Confirm deletion
3. **Expected**: Product removed from list

### 3. POS Billing

#### Test 3.1: Search and Add Product
1. Navigate to `/pos`
2. Search for a product
3. Click "Add" on a product
4. **Expected**: Product added to cart

#### Test 3.2: Modify Cart Item
1. In cart, change quantity of an item
2. **Expected**: Total recalculated

#### Test 3.3: Apply Discount
1. Add items to cart
2. Enter discount percentage or amount
3. **Expected**: Total updated with discount

#### Test 3.4: Complete Sale
1. Fill customer details (optional)
2. Select payment mode
3. Click "Complete Sale"
4. **Expected**: Bill created, cart cleared, redirect to bill details

#### Test 3.5: Stock Deduction
1. Note stock quantity of a product
2. Create a bill with that product
3. Check product stock again
4. **Expected**: Stock reduced by quantity sold

### 4. Inventory Management

#### Test 4.1: View Stock Ledger
1. Navigate to `/inventory`
2. Click "Stock Ledger" tab
3. **Expected**: All stock transactions displayed

#### Test 4.2: View Low Stock
1. Click "Low Stock Alerts" tab
2. **Expected**: Products with stock <= min level shown

#### Test 4.3: Adjust Stock
1. Click "Adjust Stock" tab
2. Enter product ID
3. Enter quantity change (e.g., +10 or -5)
4. Add notes
5. Click "Adjust Stock"
6. **Expected**: Stock updated, entry in ledger

### 5. Bills Management

#### Test 5.1: View Bills
1. Navigate to `/bills`
2. **Expected**: List of all bills displayed

#### Test 5.2: Filter Bills
1. Set date range
2. **Expected**: Only bills in date range shown

#### Test 5.3: View Bill Details
1. Click "View" on a bill
2. **Expected**: Complete bill details with items shown

#### Test 5.4: Print Bill
1. On bill details page, click "Print Bill"
2. **Expected**: Print dialog or thermal printer activated

### 6. Reports

#### Test 6.1: Sales Report
1. Navigate to `/reports`
2. Select "Sales Report"
3. Set date range
4. **Expected**: Sales data displayed

#### Test 6.2: GST Report
1. Select "GST Report"
2. Set date range
3. **Expected**: GST breakdown by rate shown

#### Test 6.3: Profit/Loss Report
1. Select "Profit/Loss Report"
2. Set date range
3. **Expected**: Revenue, cost, profit shown

#### Test 6.4: Export PDF
1. Generate any report
2. Click "Export PDF"
3. **Expected**: PDF file downloaded

#### Test 6.5: Export CSV
1. Generate any report
2. Click "Export CSV"
3. **Expected**: CSV file downloaded

### 7. Dashboard

#### Test 7.1: View Dashboard
1. Navigate to `/dashboard`
2. **Expected**: Stats cards and charts displayed

#### Test 7.2: Change Period
1. Select different period (Today/Week/Month/Year)
2. **Expected**: Stats and charts update

#### Test 7.3: Revenue Chart
1. Check revenue chart
2. **Expected**: Line chart showing revenue and profit trends

#### Test 7.4: Category Chart
1. Check category chart
2. **Expected**: Doughnut chart showing category sales

### 8. Settings (Admin Only)

#### Test 8.1: View Settings
1. Navigate to `/settings` (as admin)
2. **Expected**: Shop info and users list displayed

#### Test 8.2: Update Shop Info
1. Change shop name
2. Click "Save Changes"
3. **Expected**: Changes saved

#### Test 8.3: View Users
1. Check users list
2. **Expected**: All shop users displayed with roles

### 9. Security Tests

#### Test 9.1: Unauthorized Access
1. Logout
2. Try accessing `/dashboard` directly
3. **Expected**: Redirect to login

#### Test 9.2: Shop Isolation
1. Create two shops
2. Login as shop 1 admin
3. Try accessing shop 2 data via API
4. **Expected**: Access denied

#### Test 9.3: Role Permissions
1. Login as cashier
2. Try accessing `/settings`
3. **Expected**: Access denied or redirect

### 10. Error Handling

#### Test 10.1: Invalid Product
1. Try creating product with duplicate SKU
2. **Expected**: Error message displayed

#### Test 10.2: Insufficient Stock
1. Try creating bill with quantity > available stock
2. **Expected**: Error message, bill not created

#### Test 10.3: Network Error
1. Disconnect internet
2. Try any operation
3. **Expected**: Error message, graceful handling

## API Testing

Use Postman or curl to test API endpoints:

### Example: Create Product
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "sku": "TEST001",
    "cost_price": 100,
    "selling_price": 150,
    "stock_quantity": 50
  }'
```

### Example: Create Bill
```bash
curl -X POST http://localhost:5000/api/bills \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "product_id": 1,
        "quantity": 2
      }
    ],
    "payment_mode": "cash"
  }'
```

## Performance Testing

1. **Load Test**: Create 100+ products and bills
2. **Search Test**: Search with large product database
3. **Report Test**: Generate reports for large date ranges

## Browser Testing

Test on:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers

## Checklist

- [ ] Registration works
- [ ] Login works
- [ ] Products CRUD works
- [ ] POS billing works
- [ ] Stock deduction works
- [ ] Inventory management works
- [ ] Bills viewing works
- [ ] Reports generate correctly
- [ ] Dashboard displays data
- [ ] Settings accessible (admin only)
- [ ] Security measures work
- [ ] Error handling works
- [ ] Print functionality works
- [ ] Export works (PDF/CSV)
- [ ] Responsive design works

## Common Issues

### Issue: Can't login after registration
**Solution**: Check database connection, verify user was created

### Issue: Products not showing
**Solution**: Check API URL, verify authentication token

### Issue: Stock not updating
**Solution**: Check stock ledger, verify transaction was recorded

### Issue: Reports empty
**Solution**: Create some bills first, check date range

## Reporting Bugs

When reporting bugs, include:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser and version
5. Screenshots if applicable
6. Console errors if any


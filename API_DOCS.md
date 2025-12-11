# API Documentation

Base URL: `http://localhost:5000/api` (development) or `https://your-backend.onrender.com/api` (production)

All endpoints require authentication except `/auth/register` and `/auth/login`.

## Authentication

### Register Shop
```http
POST /auth/register
Content-Type: application/json

{
  "shop_name": "My Shop",
  "owner_name": "John Doe",
  "email": "owner@example.com",
  "phone": "1234567890",
  "address": "123 Main St",
  "gstin": "29ABCDE1234F1Z5",
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shop and admin user created successfully"
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123",
  "shop_id": 1  // Optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "shop_id": 1,
      "username": "admin",
      "email": "owner@example.com",
      "role": "admin",
      "full_name": "John Doe",
      "shop_name": "My Shop"
    }
  }
}
```

### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

### Change Password
```http
POST /auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "current_password": "oldpassword",
  "new_password": "newpassword123"
}
```

## Products

### Get Products
```http
GET /products?search=keyword&category_id=1&low_stock=true&page=1&limit=50
Authorization: Bearer <token>
```

### Get Single Product
```http
GET /products/:id
Authorization: Bearer <token>
```

### Create Product
```http
POST /products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Product Name",
  "sku": "SKU001",
  "barcode": "1234567890123",
  "category_id": 1,
  "unit": "pcs",
  "cost_price": 100.00,
  "selling_price": 150.00,
  "gst_rate": 18.00,
  "stock_quantity": 100.000,
  "min_stock_level": 10.000,
  "description": "Product description"
}
```

### Update Product
```http
PUT /products/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "selling_price": 160.00
}
```

### Delete Product
```http
DELETE /products/:id
Authorization: Bearer <token>
```

### Bulk Import Products
```http
POST /products/bulk-import
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <CSV file>
```

CSV Format:
```csv
name,sku,barcode,category_name,unit,cost_price,selling_price,gst_rate,stock_quantity,min_stock_level,description
Product 1,SKU001,1234567890123,Category 1,pcs,100,150,18,100,10,Description
```

## Categories

### Get Categories
```http
GET /categories
Authorization: Bearer <token>
```

### Create Category
```http
POST /categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Category Name",
  "description": "Category description"
}
```

### Update Category
```http
PUT /categories/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name"
}
```

### Delete Category
```http
DELETE /categories/:id
Authorization: Bearer <token>
```

## Bills

### Get Bills
```http
GET /bills?start_date=2024-01-01&end_date=2024-01-31&status=completed&payment_mode=cash&page=1&limit=50
Authorization: Bearer <token>
```

### Get Single Bill
```http
GET /bills/:id
Authorization: Bearer <token>
```

### Create Bill
```http
POST /bills
Authorization: Bearer <token>
Content-Type: application/json

{
  "customer_name": "Customer Name",
  "customer_phone": "1234567890",
  "customer_email": "customer@example.com",
  "items": [
    {
      "product_id": 1,
      "quantity": 2,
      "discount_amount": 0
    }
  ],
  "discount_amount": 0,
  "discount_percent": 0,
  "payment_mode": "cash",
  "payment_details": {},
  "notes": "Optional notes"
}
```

### Cancel Bill
```http
POST /bills/:id/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Customer request"
}
```

## Inventory

### Get Stock Ledger
```http
GET /inventory/ledger?product_id=1&transaction_type=sale&start_date=2024-01-01&end_date=2024-01-31&page=1&limit=100
Authorization: Bearer <token>
```

### Get Low Stock Products
```http
GET /inventory/low-stock
Authorization: Bearer <token>
```

### Adjust Stock
```http
POST /inventory/adjust
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": 1,
  "quantity_change": 10.5,
  "notes": "Stock adjustment reason"
}
```

### Bulk Stock Update
```http
POST /inventory/bulk-update
Authorization: Bearer <token>
Content-Type: application/json

{
  "updates": [
    {
      "product_id": 1,
      "quantity_change": 10
    },
    {
      "product_id": 2,
      "quantity_change": -5
    }
  ],
  "notes": "Bulk update"
}
```

## Reports

### Sales Report
```http
GET /reports/sales?start_date=2024-01-01&end_date=2024-01-31&group_by=day
Authorization: Bearer <token>
```

### GST Report
```http
GET /reports/gst?start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer <token>
```

### Profit/Loss Report
```http
GET /reports/profit-loss?start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer <token>
```

### Category Sales Report
```http
GET /reports/category-sales?start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer <token>
```

### Payment Mode Report
```http
GET /reports/payment-mode?start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer <token>
```

### Top Products
```http
GET /reports/top-products?start_date=2024-01-01&end_date=2024-01-31&limit=10
Authorization: Bearer <token>
```

## Dashboard

### Get Dashboard Stats
```http
GET /dashboard/stats?period=today
Authorization: Bearer <token>
```

Period options: `today`, `week`, `month`, `year`

### Get Revenue Chart Data
```http
GET /dashboard/revenue-chart?period=week&group_by=day
Authorization: Bearer <token>
```

### Get Category Chart Data
```http
GET /dashboard/category-chart?period=month
Authorization: Bearer <token>
```

## Shops (Admin Only)

### Get Shop Details
```http
GET /shops
Authorization: Bearer <token>
```

### Update Shop
```http
PUT /shops
Authorization: Bearer <token>
Content-Type: application/json

{
  "shop_name": "Updated Shop Name",
  "gstin": "29ABCDE1234F1Z5",
  "printer_type": "80mm"
}
```

### Get Shop Users
```http
GET /shops/users
Authorization: Bearer <token>
```

### Create User
```http
POST /shops/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "cashier1",
  "email": "cashier@example.com",
  "password": "password123",
  "role": "cashier",
  "full_name": "Cashier Name",
  "phone": "1234567890"
}
```

### Update User
```http
PUT /shops/users/:userId
Authorization: Bearer <token>
Content-Type: application/json

{
  "role": "cashier",
  "is_active": true
}
```

## Hold Bills

### Get Hold Bills
```http
GET /hold-bills
Authorization: Bearer <token>
```

### Create Hold Bill
```http
POST /hold-bills
Authorization: Bearer <token>
Content-Type: application/json

{
  "bill_data": {
    "items": [...],
    "customer_name": "...",
    ...
  }
}
```

### Update Hold Bill
```http
PUT /hold-bills/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "bill_data": {...}
}
```

### Delete Hold Bill
```http
DELETE /hold-bills/:id
Authorization: Bearer <token>
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [...]  // Optional validation errors
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Authentication

Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Tokens expire after 7 days by default (configurable via `JWT_EXPIRES_IN`).


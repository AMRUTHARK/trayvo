# Multi-Shop Billing System - Technical Design Documentation

## 1. Overview

### 1.1 Purpose
This document describes the technical design, implementation details, and technical specifications of the Multi-Shop Billing & Inventory Management System.

### 1.2 Scope
The system provides a comprehensive billing and inventory management solution for multiple shops with role-based access control, real-time inventory tracking, and comprehensive reporting.

### 1.3 Technology Stack

#### Frontend
- **Framework**: Next.js 14.2.33 (React-based)
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **State Management**: React Hooks (useState, useEffect)
- **HTTP Client**: Axios
- **Charts**: Chart.js with react-chartjs-2
- **PDF Generation**: jsPDF 3.0.4, jsPDF-AutoTable 3.8.4
- **Excel**: ExcelJS
- **Notifications**: react-hot-toast
- **Date Handling**: date-fns

#### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18.2
- **Language**: JavaScript (ES6+)
- **Database**: MySQL 8.0+ (mysql2 3.6.5)
- **Authentication**: JWT (jsonwebtoken 9.0.2)
- **Password Hashing**: bcryptjs 2.4.3
- **Validation**: express-validator 7.0.1
- **File Upload**: multer 1.4.5
- **CSV Parsing**: csv-parser 3.0.0
- **Email**: nodemailer 6.9.8
- **Security**: express-rate-limit 7.1.5
- **Environment**: dotenv 16.3.1

#### Database
- **RDBMS**: MySQL 8.0+
- **Engine**: InnoDB
- **Character Set**: utf8mb4
- **Connection**: Connection pooling via mysql2

## 2. System Architecture

### 2.1 Architecture Pattern
- **Frontend**: Client-Side Rendering (CSR) with Next.js App Router
- **Backend**: RESTful API with Express.js
- **Database**: Relational Database (MySQL)
- **Authentication**: Stateless JWT-based authentication

### 2.2 Component Structure

```
Frontend (Next.js)
├── app/                    # Next.js App Router pages
│   ├── login/
│   ├── register/
│   ├── dashboard/
│   ├── pos/
│   ├── products/
│   ├── categories/
│   ├── inventory/
│   ├── bills/
│   ├── reports/
│   ├── settings/
│   └── superadmin/
├── components/             # Reusable React components
│   ├── Layout.tsx
│   ├── PasswordInput.tsx
│   ├── SessionWarningModal.tsx
│   └── ThermalPrint.tsx
├── lib/                    # Utility libraries
│   ├── api.ts              # Axios instance
│   ├── auth.ts             # Auth utilities
│   ├── constants.ts        # Constants
│   └── useSessionTimeout.ts # Custom hooks
└── middleware.ts           # Next.js middleware

Backend (Express.js)
├── server.js               # Express app entry point
├── config/
│   ├── database.js         # MySQL connection pool
│   └── email.js            # Email service config
├── routes/                 # API route handlers
│   ├── auth.js
│   ├── superadmin.js
│   ├── shops.js
│   ├── products.js
│   ├── categories.js
│   ├── bills.js
│   ├── inventory.js
│   ├── reports.js
│   ├── dashboard.js
│   ├── holdBills.js
│   ├── registrationTokens.js
│   └── loginHistory.js
├── middleware/
│   ├── auth.js             # JWT authentication
│   └── shopIsolation.js    # Shop data isolation
└── utils/
    └── deviceInfo.js       # Device parsing utilities
```

## 3. Database Design

### 3.1 Database Schema

#### Core Tables
1. **shops** - Shop information
   - Primary Key: `id` (INT, AUTO_INCREMENT)
   - Unique: `email`
   - Indexes: `email`

2. **users** - User accounts
   - Primary Key: `id` (INT, AUTO_INCREMENT)
   - Foreign Key: `shop_id` → shops.id (NULL for super_admin)
   - Unique: `(shop_id, username)`
   - Enum: `role` ('admin', 'cashier', 'super_admin')
   - Indexes: `shop_id`, `email`

3. **categories** - Product categories
   - Primary Key: `id` (INT, AUTO_INCREMENT)
   - Foreign Key: `shop_id` → shops.id
   - Unique: `(shop_id, name)`
   - Indexes: `shop_id`

4. **products** - Product catalog
   - Primary Key: `id` (INT, AUTO_INCREMENT)
   - Foreign Key: `shop_id` → shops.id, `category_id` → categories.id
   - Unique: `(shop_id, sku)`
   - Indexes: `shop_id`, `category_id`, `sku`

5. **bills** - Sales transactions
   - Primary Key: `id` (INT, AUTO_INCREMENT)
   - Foreign Key: `shop_id` → shops.id, `user_id` → users.id
   - Indexes: `shop_id`, `user_id`, `bill_date`, `status`

6. **bill_items** - Bill line items
   - Primary Key: `id` (INT, AUTO_INCREMENT)
   - Foreign Key: `bill_id` → bills.id, `product_id` → products.id
   - Indexes: `bill_id`, `product_id`

7. **inventory_transactions** - Stock movements
   - Primary Key: `id` (INT, AUTO_INCREMENT)
   - Foreign Key: `shop_id` → shops.id, `product_id` → products.id, `user_id` → users.id
   - Enum: `transaction_type` ('purchase', 'sale', 'adjustment', 'return')
   - Indexes: `shop_id`, `product_id`, `transaction_date`

8. **registration_tokens** - Invitation tokens
   - Primary Key: `id` (INT, AUTO_INCREMENT)
   - Foreign Key: `shop_id` → shops.id
   - Unique: `token`
   - Indexes: `token`, `shop_id`, `expires_at`

9. **login_history** - Login tracking
   - Primary Key: `id` (INT, AUTO_INCREMENT)
   - Foreign Key: `user_id` → users.id, `shop_id` → shops.id
   - Enum: `login_status` ('success', 'failed')
   - Indexes: `user_id`, `shop_id`, `login_at`, `login_status`

### 3.2 Relationships
- One-to-Many: Shop → Users, Products, Categories, Bills
- One-to-Many: User → Bills, Inventory Transactions
- One-to-Many: Category → Products
- One-to-Many: Bill → Bill Items
- One-to-Many: Product → Bill Items, Inventory Transactions

### 3.3 Data Isolation
- All shop-specific tables include `shop_id` foreign key
- Middleware enforces shop isolation at API level
- Super admin can access all shops
- Regular users can only access their shop's data

## 4. Authentication & Authorization

### 4.1 Authentication Flow
1. User submits credentials (username, password, shop_id)
2. Backend validates credentials
3. Backend generates JWT token with user info
4. Frontend stores token in localStorage
5. Token included in Authorization header for subsequent requests
6. Backend validates token on each protected route

### 4.2 JWT Token Structure
```json
{
  "userId": 123,
  "shopId": 456,
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### 4.3 Role-Based Access Control

#### Super Admin
- Full system access
- Can create/manage all shops
- Can view all data across shops
- Bypasses shop isolation middleware

#### Admin (Shop Owner)
- Full access to their shop
- Can manage users, products, categories
- Can view reports and settings
- Cannot access other shops

#### Cashier
- Limited access to their shop
- Can access POS, create bills
- Can view products and inventory
- Cannot access settings or user management

### 4.4 Session Management
- Client-side inactivity timeout (30 minutes)
- Warning modal at 28 minutes
- Automatic logout at 30 minutes
- Activity tracking (mouse, keyboard, scroll, touch)

## 5. API Design

### 5.1 RESTful Conventions
- **GET**: Retrieve resources
- **POST**: Create resources
- **PUT**: Update resources
- **DELETE**: Delete resources

### 5.2 API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration (requires token)
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

#### Super Admin
- `GET /api/superadmin/shops` - List all shops
- `POST /api/superadmin/shops` - Create shop
- `GET /api/superadmin/shops/:id` - Get shop details
- `PUT /api/superadmin/shops/:id` - Update shop
- `DELETE /api/superadmin/shops/:id` - Delete shop
- `GET /api/superadmin/shops/:id/users` - List shop users
- `POST /api/superadmin/shops/:id/users` - Create shop user
- `POST /api/superadmin/shops/:id/send-invitation` - Send invitation

#### Registration Tokens
- `GET /api/registration-tokens/validate/:token` - Validate token
- `POST /api/registration-tokens/generate` - Generate token
- `POST /api/registration-tokens/send-invitation` - Send invitation email
- `GET /api/registration-tokens/shop/:shopId` - List shop tokens

#### Products
- `GET /api/products` - List products (paginated, filtered)
- `POST /api/products` - Create product
- `GET /api/products/:id` - Get product details
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `POST /api/products/bulk-import` - Bulk import products

#### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category
- `POST /api/categories/bulk-import` - Bulk import categories

#### Bills
- `GET /api/bills` - List bills (paginated, filtered)
- `POST /api/bills` - Create bill
- `GET /api/bills/:id` - Get bill details
- `PUT /api/bills/:id` - Update bill
- `DELETE /api/bills/:id` - Delete bill

#### Inventory
- `GET /api/inventory` - List inventory transactions
- `POST /api/inventory/adjust` - Adjust stock
- `GET /api/inventory/ledger` - Stock ledger

#### Reports
- `GET /api/reports/sales` - Sales report
- `GET /api/reports/gst` - GST report
- `GET /api/reports/profit-loss` - Profit/Loss report
- `GET /api/reports/top-products` - Top products

#### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/revenue-trend` - Revenue trend
- `GET /api/dashboard/category-sales` - Category sales

#### Login History
- `GET /api/login-history` - Get login history
- `GET /api/login-history/stats` - Login statistics

### 5.3 Request/Response Format

#### Standard Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

#### Standard Error Response
```json
{
  "success": false,
  "message": "Error message",
  "errors": [ ... ]
}
```

### 5.4 Pagination
- Query parameters: `page`, `limit`
- Response includes pagination metadata:
```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2
  }
}
```

## 6. Security Implementation

### 6.1 Password Security
- Passwords hashed using bcryptjs (10 rounds)
- Minimum password length: 6 characters
- Passwords never stored in plain text
- Password comparison using bcrypt.compare()

### 6.2 JWT Security
- Secret key stored in environment variable
- Token expiration: 7 days (configurable)
- Token stored in localStorage (client-side)
- Token validated on every protected route

### 6.3 Input Validation
- Server-side validation using express-validator
- SQL injection prevention via parameterized queries
- XSS prevention via input sanitization
- Type checking and format validation

### 6.4 Rate Limiting
- Express-rate-limit middleware
- Default: 100 requests per 15 minutes
- Configurable via environment variables
- Applied to all `/api/` routes

### 6.5 CORS Configuration
- Whitelist-based origin control
- Credentials enabled
- Frontend URL from environment variable

### 6.6 Shop Data Isolation
- Middleware enforces shop_id filtering
- All queries include shop_id condition
- Super admin bypasses isolation
- Foreign key constraints ensure data integrity

## 7. File Handling

### 7.1 File Upload
- Multer middleware for file uploads
- Supported formats: CSV, XLSX, XLS
- File size limits enforced
- Temporary file storage

### 7.2 CSV/Excel Import
- CSV parsing via csv-parser
- Excel parsing via ExcelJS
- Case-insensitive header matching
- Data validation and error reporting
- Bulk transaction support

### 7.3 PDF Generation
- jsPDF for PDF creation
- jsPDF-AutoTable for table formatting
- Receipt/invoice generation
- Browser print fallback

## 8. Email Service

### 8.1 Email Configuration
- SMTP-based email service
- Nodemailer for email sending
- Support for Gmail, Outlook, custom SMTP
- HTML email templates

### 8.2 Email Features
- Registration invitation emails
- Secure token-based links
- Expiration handling
- Error handling and fallback

## 9. Error Handling

### 9.1 Error Types
- Validation errors (400)
- Authentication errors (401)
- Authorization errors (403)
- Not found errors (404)
- Server errors (500)

### 9.2 Error Response Format
```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    {
      "type": "field",
      "msg": "Validation error",
      "path": "field_name",
      "location": "body"
    }
  ]
}
```

### 9.3 Error Logging
- Console logging in development
- Error stack traces in development
- Production error handling
- Database error handling

## 10. Performance Considerations

### 10.1 Database Optimization
- Indexes on foreign keys and frequently queried columns
- Connection pooling (mysql2)
- Parameterized queries
- Efficient JOIN operations

### 10.2 Frontend Optimization
- Code splitting (Next.js automatic)
- Image optimization
- Lazy loading
- Chart rendering optimization

### 10.3 Caching Strategy
- Client-side caching (localStorage)
- API response caching (future enhancement)
- Static asset caching

## 11. Testing Strategy

### 11.1 Unit Testing
- Component testing (future)
- Utility function testing
- API route testing

### 11.2 Integration Testing
- API endpoint testing
- Database integration testing
- Authentication flow testing

### 11.3 Manual Testing
- User acceptance testing
- Browser compatibility testing
- Device compatibility testing

## 12. Deployment Considerations

### 12.1 Environment Variables
- Separate development and production configs
- Secure secret management
- Database connection strings
- API URLs

### 12.2 Database Migrations
- Version-controlled migrations
- Rollback support
- Production migration procedures

### 12.3 Monitoring
- Error logging
- Performance monitoring
- User activity tracking
- Login history tracking

## 13. Future Enhancements

### 13.1 Planned Features
- Password reset functionality
- Email notifications
- Advanced reporting
- Mobile app
- Offline support
- Real-time updates (WebSocket)

### 13.2 Technical Improvements
- Unit test coverage
- API documentation (Swagger)
- GraphQL API option
- Microservices architecture
- Docker containerization
- CI/CD pipeline


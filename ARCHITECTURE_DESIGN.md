# Multi-Shop Billing System - Architectural Design Documentation

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer (Browser)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Next.js    │  │   React      │  │  Components  │     │
│  │   Frontend   │  │   Hooks      │  │   & Pages    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/REST API
                            │
┌─────────────────────────────────────────────────────────────┐
│                  Application Layer (Express)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Routes     │  │ Middleware   │  │  Services    │     │
│  │   Handlers   │  │  (Auth,      │  │  (Email,     │     │
│  │              │  │   Validation)│  │   Device)    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SQL Queries
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (MySQL)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Tables     │  │  Indexes      │  │  Constraints │     │
│  │   (Shops,    │  │  & Foreign    │  │  & Triggers  │     │
│  │   Users,     │  │  Keys        │  │              │     │
│  │   Products)  │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Architecture Patterns

#### Layered Architecture
- **Presentation Layer**: Next.js frontend with React components
- **Application Layer**: Express.js REST API
- **Business Logic Layer**: Route handlers and services
- **Data Access Layer**: MySQL database with connection pooling

#### Client-Server Architecture
- Stateless server (JWT-based authentication)
- RESTful API communication
- Client-side state management
- Server-side data validation

#### Multi-Tenant Architecture
- Shop-based data isolation
- Shared database, isolated data
- Role-based access control
- Super admin cross-tenant access

## 2. Component Architecture

### 2.1 Frontend Architecture

#### Page Structure (Next.js App Router)
```
app/
├── layout.tsx              # Root layout with session management
├── login/
│   └── page.tsx            # Login page
├── register/
│   └── page.tsx            # Registration page (token-based)
├── dashboard/
│   └── page.tsx            # Dashboard with analytics
├── pos/
│   └── page.tsx            # Point of Sale interface
├── products/
│   └── page.tsx            # Product management
├── categories/
│   └── page.tsx            # Category management
├── inventory/
│   └── page.tsx            # Inventory management
├── bills/
│   ├── page.tsx            # Bills listing
│   └── [id]/
│       └── page.tsx        # Bill details
├── reports/
│   └── page.tsx            # Reports
├── settings/
│   └── page.tsx            # Shop settings
└── superadmin/
    └── page.tsx            # Super admin dashboard
```

#### Component Hierarchy
```
Layout (Root)
├── Sidebar (Navigation)
├── Header (User Info)
├── Main Content (Page-specific)
│   ├── Dashboard
│   ├── POS
│   ├── Products
│   └── ...
└── SessionWarningModal
```

#### State Management
- **Local State**: React useState for component-level state
- **Global State**: Context API (future enhancement)
- **Server State**: Axios API calls with caching
- **Persistent State**: localStorage for auth tokens

### 2.2 Backend Architecture

#### Route Organization
```
routes/
├── auth.js                 # Authentication & registration
├── superadmin.js           # Super admin operations
├── shops.js                # Shop management
├── products.js             # Product CRUD
├── categories.js           # Category CRUD
├── bills.js                # Bill management
├── inventory.js            # Inventory operations
├── reports.js              # Report generation
├── dashboard.js            # Dashboard data
├── holdBills.js            # Hold/resume bills
├── registrationTokens.js   # Invitation management
└── loginHistory.js         # Login tracking
```

#### Middleware Stack
```
Request
  ↓
CORS Middleware
  ↓
Body Parser (JSON/URL-encoded)
  ↓
Rate Limiter
  ↓
Route Handler
  ↓
Authentication Middleware (if protected)
  ↓
Authorization Middleware (if role-based)
  ↓
Shop Isolation Middleware (if shop-specific)
  ↓
Business Logic
  ↓
Response
```

## 3. Data Flow Architecture

### 3.1 Authentication Flow

```
User Login Request
    ↓
Frontend: POST /api/auth/login
    ↓
Backend: Validate credentials
    ↓
Backend: Generate JWT token
    ↓
Backend: Log login attempt
    ↓
Frontend: Store token in localStorage
    ↓
Frontend: Redirect to dashboard
```

### 3.2 Data Retrieval Flow

```
User Action (e.g., View Products)
    ↓
Frontend: GET /api/products
    ↓
Middleware: Validate JWT token
    ↓
Middleware: Extract shop_id from token
    ↓
Middleware: Apply shop isolation
    ↓
Route Handler: Query database with shop_id filter
    ↓
Database: Return shop-specific products
    ↓
Backend: Format response
    ↓
Frontend: Update UI with data
```

### 3.3 Bill Creation Flow

```
Cashier: Add items to cart
    ↓
Frontend: Calculate totals, GST, discounts
    ↓
Cashier: Complete sale
    ↓
Frontend: POST /api/bills
    ↓
Backend: Validate data
    ↓
Backend: Create bill record
    ↓
Backend: Create bill_items records
    ↓
Backend: Update product stock (inventory_transactions)
    ↓
Backend: Return bill details
    ↓
Frontend: Generate receipt/print
```

## 4. Security Architecture

### 4.1 Authentication Architecture

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ 1. Login Request
       ↓
┌─────────────┐
│   Backend   │
│   Auth API  │
└──────┬──────┘
       │ 2. Validate Credentials
       ↓
┌─────────────┐
│  Database   │
│   (Users)   │
└──────┬──────┘
       │ 3. User Data
       ↓
┌─────────────┐
│   Backend   │
│   JWT Sign  │
└──────┬──────┘
       │ 4. JWT Token
       ↓
┌─────────────┐
│   Client    │
│ localStorage│
└─────────────┘
```

### 4.2 Authorization Architecture

```
Request with JWT Token
    ↓
Extract Token from Header
    ↓
Verify Token Signature
    ↓
Extract User Info (userId, shopId, role)
    ↓
Check Route Protection Level
    ↓
┌─────────────────┬─────────────────┐
│  Public Route   │  Protected Route │
└─────────────────┴─────────────────┘
         │                  │
         │                  ↓
         │         Check User Role
         │                  │
         │         ┌────────┴────────┐
         │         │                │
         │    Super Admin      Admin/Cashier
         │         │                │
         │    Full Access    Shop-Specific
         │         │                │
         └─────────┴────────────────┘
                    │
                    ↓
              Allow/Deny Access
```

### 4.3 Data Isolation Architecture

```
User Request (shopId: 123)
    ↓
Shop Isolation Middleware
    ↓
┌─────────────────────────────┐
│  Super Admin?               │
│  Yes → Bypass isolation     │
│  No  → Apply shop filter    │
└─────────────────────────────┘
         │
         ↓
Query: WHERE shop_id = 123
    ↓
Database returns only shop 123 data
```

## 5. Integration Architecture

### 5.1 Frontend-Backend Integration

```
┌─────────────────────────────────────┐
│         Frontend (Next.js)          │
│                                     │
│  ┌──────────────┐                  │
│  │   Components │                  │
│  └──────┬───────┘                  │
│         │                           │
│  ┌──────▼───────┐                  │
│  │  lib/api.ts  │  Axios Instance  │
│  └──────┬───────┘                  │
│         │                           │
└─────────┼───────────────────────────┘
          │ HTTP/REST
          │
┌─────────▼───────────────────────────┐
│      Backend (Express.js)           │
│                                     │
│  ┌──────────────┐                  │
│  │   Routes     │                  │
│  └──────┬───────┘                  │
│         │                           │
│  ┌──────▼───────┐                  │
│  │ Middleware   │                  │
│  └──────┬───────┘                  │
│         │                           │
│  ┌──────▼───────┐                  │
│  │  Database    │                  │
│  └──────────────┘                  │
└─────────────────────────────────────┘
```

### 5.2 External Service Integration

#### Email Service Integration
```
Registration Invitation
    ↓
Generate Token
    ↓
Create Token Record
    ↓
Send Email via SMTP
    ↓
┌─────────────┬─────────────┐
│   Success   │   Failure   │
│  (Email     │  (Return    │
│   Sent)     │   Token URL)│
└─────────────┴─────────────┘
```

#### Printer Integration
```
Print Request
    ↓
┌─────────────────────────────┐
│  Web Serial API Available?  │
└──────┬──────────────┬───────┘
       │ Yes          │ No
       ↓              ↓
  ESC/POS Print   Browser Print
  (Thermal)       (Ctrl+P)
```

## 6. Scalability Architecture

### 6.1 Horizontal Scaling Considerations

#### Frontend Scaling
- Stateless Next.js application
- Can be deployed to multiple instances
- CDN for static assets
- Load balancer for distribution

#### Backend Scaling
- Stateless Express.js API
- JWT tokens (no server-side sessions)
- Database connection pooling
- Can scale horizontally with load balancer

#### Database Scaling
- Read replicas for reporting queries
- Connection pooling
- Index optimization
- Query optimization

### 6.2 Vertical Scaling Considerations
- Increase server resources
- Database optimization
- Caching layer (future)
- Database indexing

## 7. Deployment Architecture

### 7.1 Development Environment
```
Developer Machine
├── Frontend (Next.js Dev Server) - Port 3000
├── Backend (Express Dev Server) - Port 5000
└── MySQL (Local) - Port 3306
```

### 7.2 Production Environment
```
┌─────────────────────────────────────┐
│         CDN / Vercel                │
│      (Frontend Hosting)              │
└──────────────┬──────────────────────┘
               │
               │ HTTPS
               │
┌──────────────▼──────────────────────┐
│      Load Balancer                  │
│      (Render / Railway)             │
└──────────────┬──────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────┐         ┌──────▼───┐
│ Backend│         │ Backend  │
│Instance│         │Instance  │
│   1    │         │    2     │
└───┬────┘         └──────┬───┘
    │                    │
    └──────────┬─────────┘
               │
┌──────────────▼──────────────────────┐
│      Database (PlanetScale/MySQL)    │
│      (Primary + Replicas)            │
└─────────────────────────────────────┘
```

## 8. Error Handling Architecture

### 8.1 Error Flow
```
Error Occurs
    ↓
┌─────────────────────────┐
│  Error Type?            │
└───┬───────────┬─────────┘
    │           │
Validation   Database   Server
    │           │         │
    ↓           ↓         ↓
400 Error   500 Error  500 Error
    │           │         │
    └───────────┴─────────┘
            │
            ↓
    Format Error Response
            │
            ↓
    Return to Client
            │
            ↓
    Client Error Handling
            │
            ↓
    Display User-Friendly Message
```

## 9. Monitoring & Logging Architecture

### 9.1 Logging Layers
```
Application Layer
    ↓
Console Logging (Development)
    ↓
Error Tracking (Production)
    ↓
Login History (Database)
    ↓
Analytics (Future)
```

### 9.2 Monitoring Points
- API request/response times
- Database query performance
- Error rates
- User activity
- Login attempts
- System health

## 10. Future Architecture Enhancements

### 10.1 Microservices Architecture (Future)
```
API Gateway
    ├── Auth Service
    ├── Shop Service
    ├── Product Service
    ├── Billing Service
    └── Reporting Service
```

### 10.2 Caching Architecture (Future)
```
Request
    ↓
Cache Layer (Redis)
    ├── Hit → Return Cached Data
    └── Miss → Query Database → Cache → Return
```

### 10.3 Real-time Architecture (Future)
```
WebSocket Server
    ├── Bill Updates
    ├── Inventory Alerts
    └── Notifications
```


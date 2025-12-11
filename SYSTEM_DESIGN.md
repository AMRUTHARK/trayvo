# Multi-Shop Billing System - System Design Documentation

## 1. System Overview

### 1.1 Purpose
The Multi-Shop Billing & Inventory Management System is a comprehensive web-based solution designed to manage billing, inventory, and reporting for multiple retail shops from a single platform. The system provides role-based access control, ensuring data isolation between shops while allowing centralized management.

### 1.2 System Goals
- **Multi-Tenancy**: Support multiple shops with complete data isolation
- **Role-Based Access**: Admin, Cashier, and Super Admin roles
- **Real-Time Operations**: POS billing with instant inventory updates
- **Comprehensive Reporting**: Sales, GST, profit/loss, and analytics
- **Scalability**: Support for growing number of shops and users
- **Security**: Secure authentication, authorization, and data protection
- **Usability**: Intuitive interface for daily operations

### 1.3 System Scope

#### In Scope
- Shop management and registration
- User management with role-based access
- Product and category management
- Point of Sale (POS) billing
- Inventory management and tracking
- Sales reporting and analytics
- GST reporting
- Receipt/invoice printing
- Login history tracking
- Email invitation system

#### Out of Scope (Future)
- Mobile applications
- Offline mode
- Payment gateway integration
- Advanced analytics and AI
- Multi-currency support
- Warehouse management
- Supplier management

## 2. System Requirements

### 2.1 Functional Requirements

#### FR1: User Management
- **FR1.1**: System shall support three user roles: Super Admin, Admin, Cashier
- **FR1.2**: Super Admin can create and manage all shops
- **FR1.3**: Shop Admin can manage users within their shop
- **FR1.4**: Users must authenticate with username, password, and shop ID
- **FR1.5**: Super Admin login does not require shop ID
- **FR1.6**: System shall track login history with machine details

#### FR2: Shop Management
- **FR2.1**: Super Admin can create new shops
- **FR2.2**: Each shop has isolated data (products, bills, inventory)
- **FR2.3**: Shop settings include name, address, phone, GSTIN
- **FR2.4**: System shall send registration invitations via email
- **FR2.5**: Registration requires valid invitation token

#### FR3: Product Management
- **FR3.1**: Admin can create, update, delete products
- **FR3.2**: Products include: name, SKU, category, unit, prices, GST, stock
- **FR3.3**: System shall support bulk import via CSV/Excel
- **FR3.4**: System shall validate product data on import
- **FR3.5**: Products are shop-specific

#### FR4: Category Management
- **FR4.1**: Admin can create, update, delete categories
- **FR4.2**: Categories are shop-specific
- **FR4.3**: System shall support bulk import via CSV
- **FR4.4**: Products must belong to a category

#### FR5: Point of Sale (POS)
- **FR5.1**: Cashier can search products by name or SKU
- **FR5.2**: System shall calculate prices, GST, discounts automatically
- **FR5.3**: System shall support multiple payment modes (Cash, UPI, Card)
- **FR5.4**: System shall update inventory on bill completion
- **FR5.5**: System shall support hold/resume bills
- **FR5.6**: System shall generate printable receipts

#### FR6: Inventory Management
- **FR6.1**: System shall track stock levels automatically
- **FR6.2**: Admin can manually adjust stock
- **FR6.3**: System shall maintain stock ledger with history
- **FR6.4**: System shall support different units (pcs, kg, g, l, ml, m, cm)
- **FR6.5**: System shall show low stock alerts

#### FR7: Billing & Transactions
- **FR7.1**: System shall create bills with items, prices, GST, totals
- **FR7.2**: Bills are shop and user-specific
- **FR7.3**: System shall maintain bill history
- **FR7.4**: Bills can be viewed, printed, or deleted
- **FR7.5**: System shall track payment modes

#### FR8: Reporting
- **FR8.1**: System shall generate sales reports (daily, monthly, custom)
- **FR8.2**: System shall generate GST reports
- **FR8.3**: System shall generate profit/loss reports
- **FR8.4**: System shall generate category-wise sales reports
- **FR8.5**: System shall provide dashboard with key metrics
- **FR8.6**: Reports can be filtered by date range

#### FR9: Security
- **FR9.1**: System shall hash passwords using bcrypt
- **FR9.2**: System shall use JWT for authentication
- **FR9.3**: System shall enforce session timeout (30 minutes inactivity)
- **FR9.4**: System shall log all login attempts
- **FR9.5**: System shall prevent unauthorized access
- **FR9.6**: System shall enforce shop data isolation

### 2.2 Non-Functional Requirements

#### NFR1: Performance
- **NFR1.1**: Page load time < 2 seconds
- **NFR1.2**: API response time < 500ms (95th percentile)
- **NFR1.3**: Support 100+ concurrent users
- **NFR1.4**: Database queries optimized with indexes

#### NFR2: Scalability
- **NFR2.1**: Support 1000+ shops
- **NFR2.2**: Support 10,000+ products per shop
- **NFR2.3**: Support 100,000+ bills per shop
- **NFR2.4**: Horizontal scaling capability

#### NFR3: Security
- **NFR3.1**: HTTPS in production
- **NFR3.2**: SQL injection prevention
- **NFR3.3**: XSS prevention
- **NFR3.4**: CSRF protection
- **NFR3.5**: Rate limiting (100 requests/15 min)

#### NFR4: Reliability
- **NFR4.1**: 99.9% uptime
- **NFR4.2**: Database backup daily
- **NFR4.3**: Error handling and recovery
- **NFR4.4**: Transaction rollback on errors

#### NFR5: Usability
- **NFR5.1**: Responsive design (mobile, tablet, desktop)
- **NFR5.2**: Intuitive user interface
- **NFR5.3**: Clear error messages
- **NFR5.4**: Keyboard shortcuts for POS
- **NFR5.5**: Touch-friendly interface

#### NFR6: Maintainability
- **NFR6.1**: Clean, documented code
- **NFR6.2**: Modular architecture
- **NFR6.3**: Version control
- **NFR6.4**: Comprehensive documentation

## 3. System Architecture

### 3.1 High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  Next.js Frontend (React, TypeScript, TailwindCSS)         │
│  - User Interface                                           │
│  - Client-side Validation                                  │
│  - State Management                                        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ REST API (HTTPS)
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                   Application Layer                         │
│  Express.js Backend (Node.js, JavaScript)                  │
│  - Business Logic                                          │
│  - Authentication & Authorization                          │
│  - Data Validation                                         │
│  - API Routing                                             │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ SQL Queries
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                      Data Layer                             │
│  MySQL Database                                             │
│  - Data Storage                                            │
│  - Data Integrity                                          │
│  - Transactions                                            │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Component Interaction

```
User → Frontend Component → API Call → Backend Route
                                    ↓
                            Middleware (Auth, Validation)
                                    ↓
                            Business Logic
                                    ↓
                            Database Query
                                    ↓
                            Response → Frontend → UI Update
```

## 4. Data Model

### 4.1 Entity Relationship Diagram (Conceptual)

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Shops   │────────<│  Users   │         │Categories│
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │                    │                    │
     │                    │                    │
     │              ┌─────▼─────┐             │
     │              │   Bills   │             │
     │              └─────┬─────┘             │
     │                    │                   │
     │              ┌─────▼─────┐             │
     │              │Bill Items │             │
     │              └─────┬─────┘             │
     │                    │                   │
     │              ┌─────▼─────┐             │
     │              │ Products  │<────────────┘
     │              └─────┬─────┘
     │                    │
     │              ┌─────▼──────────────┐
     │              │Inventory Transactions│
     └──────────────>└────────────────────┘
```

### 4.2 Key Entities

#### Shop Entity
- **Attributes**: id, shop_name, owner_name, email, phone, address, gstin, logo_url, printer_type
- **Relationships**: One-to-Many with Users, Products, Categories, Bills

#### User Entity
- **Attributes**: id, shop_id, username, email, password_hash, role, full_name, phone, is_active
- **Relationships**: Many-to-One with Shop, One-to-Many with Bills, Inventory Transactions

#### Product Entity
- **Attributes**: id, shop_id, category_id, name, sku, unit, cost_price, selling_price, gst_rate, stock
- **Relationships**: Many-to-One with Shop and Category, One-to-Many with Bill Items and Inventory Transactions

#### Bill Entity
- **Attributes**: id, shop_id, user_id, bill_number, bill_date, subtotal, discount_amount, gst_amount, total_amount, payment_mode, status
- **Relationships**: Many-to-One with Shop and User, One-to-Many with Bill Items

## 5. Use Cases

### 5.1 Use Case: Shop Registration

**Actor**: Super Admin

**Preconditions**: Super Admin is logged in

**Main Flow**:
1. Super Admin navigates to Super Admin dashboard
2. Clicks "Create New Shop"
3. Enters shop details (name, owner, email, etc.)
4. Enters admin user credentials
5. Optionally checks "Send invitation email"
6. Clicks "Create Shop"
7. System creates shop and admin user
8. If invitation selected, system sends email with registration link
9. System displays success message

**Postconditions**: Shop created, admin user created, invitation sent (if selected)

### 5.2 Use Case: User Registration

**Actor**: Shop Owner/Employee

**Preconditions**: User has received invitation email with token

**Main Flow**:
1. User clicks registration link in email
2. System validates token
3. System displays registration form with shop details pre-filled
4. User enters personal details (name, email, username, password, role)
5. User submits form
6. System validates email + role combination (not duplicate)
7. System creates user account
8. System marks token as used
9. System redirects to login page

**Postconditions**: User account created, token marked as used

### 5.3 Use Case: Create Bill

**Actor**: Cashier

**Preconditions**: Cashier is logged in, products exist

**Main Flow**:
1. Cashier navigates to POS page
2. Cashier searches for product by name or SKU
3. System displays matching products
4. Cashier selects product and enters quantity
5. System adds item to cart with calculated price and GST
6. Steps 2-5 repeat for additional items
7. Cashier applies discount (if any)
8. System calculates final total
9. Cashier selects payment mode
10. Cashier clicks "Complete Sale"
11. System creates bill record
12. System creates bill items
13. System updates inventory (reduces stock)
14. System generates receipt
15. Cashier prints receipt

**Postconditions**: Bill created, inventory updated, receipt generated

### 5.4 Use Case: View Reports

**Actor**: Admin

**Preconditions**: Admin is logged in, bills exist

**Main Flow**:
1. Admin navigates to Reports page
2. Admin selects report type (Sales, GST, Profit/Loss)
3. Admin selects date range
4. Admin clicks "Generate Report"
5. System queries database for report data
6. System formats and displays report
7. Admin can export report (PDF/CSV)

**Postconditions**: Report displayed, export available

## 6. System Interfaces

### 6.1 User Interfaces

#### Web Interface
- **Technology**: Next.js, React, TailwindCSS
- **Responsive**: Mobile, Tablet, Desktop
- **Browser Support**: Chrome, Firefox, Safari, Edge (latest versions)
- **Accessibility**: WCAG 2.1 Level AA (target)

#### Key Screens
- Login/Registration
- Dashboard
- POS Interface
- Product Management
- Inventory Management
- Reports
- Settings

### 6.2 External Interfaces

#### Email Service
- **Protocol**: SMTP
- **Purpose**: Send registration invitations
- **Configuration**: Environment variables

#### Printer Interface
- **Technology**: Web Serial API (ESC/POS)
- **Fallback**: Browser print dialog
- **Supported**: 58mm and 80mm thermal printers

## 7. System Constraints

### 7.1 Technical Constraints
- Browser-based (no native apps)
- Requires internet connection
- MySQL database required
- Node.js runtime required
- Modern browser with JavaScript enabled

### 7.2 Business Constraints
- One email per role per shop (email + role combination)
- Shop data isolation (cannot access other shops)
- Super admin required for shop creation
- Invitation required for user registration

### 7.3 Regulatory Constraints
- GST compliance (Indian tax system)
- Data privacy (user data protection)
- Audit trail (login history, transaction logs)

## 8. System Quality Attributes

### 8.1 Performance
- Fast page loads (< 2 seconds)
- Quick API responses (< 500ms)
- Efficient database queries
- Optimized frontend rendering

### 8.2 Security
- Encrypted passwords
- JWT token authentication
- HTTPS in production
- Input validation and sanitization
- SQL injection prevention
- XSS prevention

### 8.3 Reliability
- Error handling and recovery
- Transaction rollback
- Database backups
- Graceful degradation

### 8.4 Usability
- Intuitive interface
- Clear navigation
- Helpful error messages
- Responsive design
- Keyboard shortcuts

### 8.5 Maintainability
- Clean code structure
- Comprehensive documentation
- Modular design
- Version control

## 9. Deployment Model

### 9.1 Development Environment
- Local development servers
- Local MySQL database
- Environment variables in .env files

### 9.2 Production Environment
- **Frontend**: Vercel/Netlify (static hosting)
- **Backend**: Render/Railway (Node.js hosting)
- **Database**: PlanetScale/MySQL (cloud database)
- **Email**: SMTP service (Gmail/Outlook/custom)

### 9.3 Deployment Process
1. Code commit to repository
2. Automated build and test
3. Deploy to staging (optional)
4. Deploy to production
5. Run database migrations
6. Verify deployment

## 10. Risk Assessment

### 10.1 Technical Risks
- **Database Performance**: Mitigated by indexing and query optimization
- **Security Vulnerabilities**: Mitigated by regular updates and security practices
- **Scalability Issues**: Mitigated by horizontal scaling capability

### 10.2 Business Risks
- **Data Loss**: Mitigated by regular backups
- **Service Downtime**: Mitigated by reliable hosting and monitoring
- **User Adoption**: Mitigated by intuitive UI and training

## 11. Future Enhancements

### 11.1 Planned Features
- Mobile applications (iOS/Android)
- Offline mode support
- Payment gateway integration
- Advanced analytics and AI insights
- Multi-currency support
- Warehouse management
- Supplier management
- Barcode scanning
- Customer management
- Loyalty programs

### 11.2 Technical Improvements
- Microservices architecture
- GraphQL API
- Real-time updates (WebSocket)
- Caching layer (Redis)
- CDN for static assets
- Automated testing
- CI/CD pipeline
- Docker containerization


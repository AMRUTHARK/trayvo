# Multi-Shop Billing & Inventory System

A production-ready, full-stack web application for managing multiple shops with billing, inventory, and reporting capabilities.

## Features

- **Multi-Shop Support**: Each shop has isolated data and users
- **Role-Based Access**: Admin and Cashier roles with appropriate permissions
- **POS Billing**: Fast, intuitive point-of-sale interface
- **Inventory Management**: Real-time stock tracking with low-stock alerts
- **Dashboard & Analytics**: Revenue, profit, margin tracking with charts
- **Reports**: Sales, GST, Profit/Loss, Category-wise, and Payment mode reports
- **Thermal Printing**: ESC/POS support for 58mm and 80mm printers
- **Export**: PDF and CSV export for all reports
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, TailwindCSS, Chart.js
- **Backend**: Node.js, Express, MySQL
- **Authentication**: JWT
- **Printing**: Browser ESC/POS (Web Serial API)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd multi-shopping-billing
   ```

2. **Install dependencies**
   ```bash
   # Frontend
   npm install

   # Backend
   cd backend
   npm install
   ```

3. **Set up database**

   **Windows Users**: See [WINDOWS_SETUP.md](./WINDOWS_SETUP.md) for detailed Windows instructions.

   **Quick Method (All Platforms)**: Use the Node.js setup script:
   ```bash
   # Make sure backend/.env exists first (see step 4)
   node setup-db.js
   ```

   **Alternative - MySQL Command Line**:
   ```bash
   # Create database
   mysql -u root -p
   CREATE DATABASE multi_shop_billing;
   exit

   # Import schema
   mysql -u root -p multi_shop_billing < database/schema.sql
   ```

   **Alternative - MySQL Workbench (GUI)**:
   - Open MySQL Workbench
   - Create new schema: `multi_shop_billing`
   - Server → Data Import → Import from `database/schema.sql`

4. **Configure environment variables**
   
   Create `backend/.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=multi_shop_billing
   DB_PORT=3306
   JWT_SECRET=your_super_secret_jwt_key_change_in_production
   JWT_EXPIRES_IN=7d
   FRONTEND_URL=http://localhost:3000
   ```

   Create `.env.local` in root:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```

5. **Start the application**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## First Time Setup

1. Register your shop at http://localhost:3000/register
2. Login with your admin credentials
3. Add products and categories
4. Start billing!

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions for Vercel, Render, and PlanetScale.

## API Documentation

See [API_DOCS.md](./API_DOCS.md) for complete API documentation.

## Testing

See [TESTING.md](./TESTING.md) for testing instructions.

## Project Structure

```
multi-shopping-billing/
├── app/                    # Next.js app directory
│   ├── dashboard/         # Dashboard page
│   ├── pos/               # POS billing interface
│   ├── products/          # Product management
│   ├── inventory/         # Inventory management
│   ├── bills/             # Bills listing and details
│   ├── reports/           # Reports module
│   └── settings/          # Settings (admin only)
├── backend/               # Express backend
│   ├── routes/           # API routes
│   ├── middleware/       # Auth and validation
│   └── config/           # Database config
├── components/           # React components
├── lib/                  # Utilities and helpers
├── database/             # Database schema
└── public/              # Static assets
```

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- SQL injection prevention (parameterized queries)
- XSS protection
- CORS configuration
- Rate limiting
- Shop data isolation

## Browser Support

- Chrome/Edge (recommended for Web Serial API printing)
- Firefox
- Safari

## License

Proprietary - All rights reserved

## Support

For issues and questions, please contact the development team.


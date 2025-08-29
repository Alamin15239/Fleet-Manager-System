# Fleet & Tire Management System

A comprehensive Next.js 15 application for managing fleet maintenance and tire inventory with advanced analytics, reporting, and predictive maintenance capabilities.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL (optional, see Database Setup)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fleet-tire-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up the database**
   ```bash
   npm run db:push
   npm run db:generate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Database Setup](#database-setup)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [Available Features](#available-features)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## 🏗️ System Overview

This application provides a complete solution for:

- **Fleet Management**: Track trucks, maintenance records, and performance metrics
- **Tire Management**: Comprehensive tire inventory, distribution, and lifecycle tracking
- **Predictive Maintenance**: AI-powered alerts and maintenance predictions
- **Advanced Analytics**: Charts, reports, and performance insights
- **User Management**: Role-based access control with multiple user types
- **Real-time Updates**: WebSocket integration for live data updates

### Key Modules

1. **Dashboard**: Overview with KPIs and charts
2. **Truck Management**: Add, edit, and track fleet vehicles
3. **Tire Management**: Tire inventory and distribution system
4. **Maintenance Tracking**: Service records and scheduling
5. **Reports**: Professional PDF and Excel report generation
6. **Analytics**: Performance metrics and trends
7. **User Administration**: Manage users and permissions

## 💻 Technology Stack

### Frontend
- **Next.js 15** with App Router
- **TypeScript 5** for type safety
- **Tailwind CSS 4** for styling
- **shadcn/ui** component library
- **React Hook Form** with Zod validation
- **TanStack Query** for data fetching
- **Framer Motion** for animations
- **Recharts** for data visualization

### Backend
- **Next.js API Routes**
- **Prisma ORM** with SQLite/PostgreSQL
- **JWT Authentication**
- **bcryptjs** for password hashing
- **Zod** for input validation
- **Socket.io** for real-time communication

### Database
- **SQLite** (default, file-based)
- **PostgreSQL** (production option)
- **Prisma** as ORM

### DevOps
- **ESLint** for code quality
- **Prettier** for code formatting
- **GitHub Actions** for CI/CD
- **Docker** support

## 🗄️ Database Setup

### Option 1: SQLite (Default - Quick Start)

The application comes with SQLite configured out of the box:

1. **Initialize the database**
   ```bash
   npm run db:push
   ```

2. **Generate Prisma Client**
   ```bash
   npm run db:generate
   ```

3. **Verify setup**
   ```bash
   npx prisma studio
   # Opens Prisma Studio at http://localhost:5555
   ```

### Option 2: PostgreSQL (Production)

#### Step 1: Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS (using Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
Download and install PostgreSQL from https://www.postgresql.org/download/windows/

#### Step 2: Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database
CREATE DATABASE fleet_management;

# Create user with password
CREATE USER fleet_user WITH ENCRYPTED PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE fleet_management TO fleet_user;

# Exit psql
\q
```

#### Step 3: Configure Environment

Update your `.env` file:
```env
DATABASE_URL="postgresql://fleet_user:your_secure_password@localhost:5432/fleet_management"
```

#### Step 4: Run Migrations

```bash
# Push schema to PostgreSQL
npm run db:push

# Generate Prisma Client
npm run db:generate
```

#### Step 5: Verify Connection

```bash
# Test database connection
npx prisma db push

# View database in Prisma Studio
npx prisma studio
```

## ⚙️ Environment Configuration

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="file:./dev.db"  # SQLite default
# DATABASE_URL="postgresql://user:password@localhost:5432/fleet_management"  # PostgreSQL

# Authentication
JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret"

# Email (Resend - for notifications and authentication)
RESEND_API_KEY="your-resend-api-key"
EMAIL_FROM="Fleet Manager <noreply@yourdomain.com>"
RESEND_DOMAIN="yourdomain.com"

# External APIs (Optional)
OPENAI_API_KEY="your-openai-api-key"  # For AI features
```

## 🚀 Running the Application

### Development Commands

```bash
# Start development server
npm run dev

# Run linting
npm run lint

# Build for production
npm run build

# Start production server
npm start

# Database operations
npm run db:push        # Push schema to database
npm run db:generate     # Generate Prisma client
npm run db:migrate      # Create migrations
npm run db:reset        # Reset database
npm run db:studio       # Open Prisma Studio
```

### Production Commands

```bash
# Build the application
npm run build

# Start production server
npm start

# Or using PM2 (recommended)
pm2 start ecosystem.config.js
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio (database GUI) |

## 🎯 Available Features

### 1. Authentication System
- **User Registration/ Login**: Email and password-based authentication
- **Role-Based Access**: Admin, Manager, User roles with different permissions
- **JWT Tokens**: Secure session management
- **Password Reset**: Email-based password recovery
- **Profile Management**: User profile updates

**Access Routes:**
- `/login` - Login page
- `/register` - Registration page (admin only)
- `/profile` - User profile management

### 2. Dashboard
- **KPI Cards**: Total trucks, active vehicles, maintenance alerts
- **Charts**: Monthly costs, maintenance types, performance trends
- **Recent Activity**: Latest trucks and maintenance records
- **Quick Actions**: Add trucks, create maintenance records

**Access Route:** `/dashboard`

### 3. Truck Management
- **Fleet Overview**: List all trucks with status indicators
- **Add/Edit Trucks**: Complete truck information (VIN, make, model, etc.)
- **Truck Details**: Individual truck profiles with maintenance history
- **Status Tracking**: Active, In Maintenance, Inactive statuses

**Access Route:** `/trucks`

### 4. Tire Management System
- **Tire Inventory**: Comprehensive tire tracking system
- **Add Tires**: Quick tire addition with vehicle assignment
- **Tire Distribution**: Track tire assignment to vehicles
- **Vehicle Management**: Manage vehicles and driver assignments
- **Analytics**: Tire usage patterns and performance metrics

**Access Route:** `/tire-management`

**Features:**
- **Add Tires Tab**: Quick form for adding new tires
- **Inventory Tab**: View and manage tire inventory
- **Vehicles Tab**: Manage vehicles and drivers
- **Analytics Tab**: Tire performance charts and metrics
- **Reports Tab**: Generate professional tire reports

### 5. Maintenance Tracking
- **Service Records**: Complete maintenance history
- **Schedule Maintenance**: Plan future services
- **Cost Tracking**: Parts and labor cost management
- **Mechanic Assignment**: Assign mechanics to maintenance jobs
- **Status Updates**: Scheduled, In Progress, Completed statuses

**Access Route:** `/maintenance`

### 6. Report Generation
- **Professional Reports**: PDF and Excel report generation
- **Multiple Templates**: Executive Summary, Detailed Inventory, Manufacturer Analysis
- **Custom Reports**: Build your own custom reports
- **Data Filtering**: Filter by date, vehicle, manufacturer, etc.
- **Export Options**: Download in multiple formats

**Access Route:** `/tire-management` (Reports tab)

**Report Templates:**
- **Executive Summary**: High-level overview for management
- **Detailed Inventory**: Complete tire inventory with all details
- **Manufacturer Analysis**: Performance analysis by tire manufacturer
- **Vehicle Performance**: Tire usage and performance by vehicle
- **Custom Report**: Build your own custom report

### 7. Predictive Maintenance
- **AI-Powered Alerts**: Predictive failure alerts
- **Health Scores**: Vehicle health assessment
- **Maintenance Predictions**: When maintenance will be needed
- **Risk Assessment**: Critical, High, Medium, Low risk levels

**Access Route:** `/analytics`

### 8. User Administration
- **User Management**: Add, edit, deactivate users
- **Role Assignment**: Assign Admin, Manager, User roles
- **Permission Control**: Granular permission management
- **Activity Tracking**: User activity logs

**Access Route:** `/users` (Admin only)

## 🔌 API Documentation

### Authentication Endpoints

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Register (Admin only)
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "password123",
  "name": "New User",
  "role": "USER"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Truck Endpoints

#### Get All Trucks
```http
GET /api/trucks
Authorization: Bearer <token>
```

#### Create Truck
```http
POST /api/trucks
Content-Type: application/json
Authorization: Bearer <token>

{
  "vin": "1HGCM82633A123456",
  "make": "Honda",
  "model": "Accord",
  "year": 2020,
  "licensePlate": "ABC123",
  "currentMileage": 45000
}
```

#### Update Truck
```http
PUT /api/trucks/:id
Content-Type: application/json
Authorization: Bearer <token>

{
  "status": "MAINTENANCE",
  "currentMileage": 46000
}
```

### Tire Endpoints

#### Get All Tires
```http
GET /api/tires?limit=20&page=1
Authorization: Bearer <token>
```

#### Create Tire
```http
POST /api/tires
Content-Type: application/json
Authorization: Bearer <token>

{
  "tireSize": "225/65R17",
  "manufacturer": "Michelin",
  "origin": "JAPANESE",
  "plateNumber": "ABC123",
  "driverName": "John Doe",
  "quantity": 4
}
```

#### Generate Tire Reports
```http
GET /api/tires/reports/generate?template=executive-summary&startDate=2024-01-01&endDate=2024-12-31&format=pdf
Authorization: Bearer <token>
```

### Maintenance Endpoints

#### Get Maintenance Records
```http
GET /api/maintenance
Authorization: Bearer <token>
```

#### Create Maintenance Record
```http
POST /api/maintenance
Content-Type: application/json
Authorization: Bearer <token>

{
  "truckId": "truck-id",
  "serviceType": "Oil Change",
  "description": "Regular oil change",
  "datePerformed": "2024-01-15",
  "partsCost": 25.00,
  "laborCost": 50.00
}
```

## 🗃️ Database Schema

### Core Tables

#### Users
```sql
- id (String, Primary Key)
- email (String, Unique)
- name (String, Optional)
- password (String, Hashed)
- role (Enum: ADMIN, MANAGER, USER)
- isActive (Boolean, Default: true)
- isApproved (Boolean, Default: false)
- createdAt (DateTime)
- updatedAt (DateTime)
```

#### Trucks
```sql
- id (String, Primary Key)
- vin (String, Unique)
- make (String)
- model (String)
- year (Integer)
- licensePlate (String)
- currentMileage (Integer)
- status (Enum: ACTIVE, INACTIVE, MAINTENANCE)
- healthScore (Float, Optional)
- riskLevel (Enum: LOW, MEDIUM, HIGH, CRITICAL)
- createdAt (DateTime)
- updatedAt (DateTime)
```

#### Tires
```sql
- id (String, Primary Key)
- tireSize (String)
- manufacturer (String)
- origin (Enum: CHINESE, JAPANESE, EUROPEAN, AMERICAN, OTHER)
- plateNumber (String)
- trailerNumber (String, Optional)
- driverName (String, Optional)
- quantity (Integer, Default: 1)
- createdById (String, Foreign Key)
- createdAt (DateTime)
- updatedAt (DateTime)
```

#### Maintenance Records
```sql
- id (String, Primary Key)
- truckId (String, Foreign Key)
- serviceType (String)
- description (String, Optional)
- datePerformed (DateTime)
- partsCost (Float, Default: 0)
- laborCost (Float, Default: 0)
- totalCost (Float, Default: 0)
- status (Enum: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED)
- createdAt (DateTime)
- updatedAt (DateTime)
```

#### Vehicles
```sql
- id (String, Primary Key)
- plateNumber (String, Unique)
- trailerNumber (String, Optional)
- driverName (String, Optional)
- isActive (Boolean, Default: true)
- createdAt (DateTime)
- updatedAt (DateTime)
```

### Relationships

- **Users → MaintenanceRecords**: One-to-Many
- **Users → Tires**: One-to-Many (created by)
- **Trucks → MaintenanceRecords**: One-to-Many
- **Vehicles → Tires**: One-to-Many (via plateNumber)

## 🚀 Deployment

### Development Deployment

```bash
# Start development server
npm run dev

# Access at http://localhost:3000
```

### Production Deployment

#### 1. Build the Application
```bash
npm run build
```

#### 2. Set Up Production Database

```bash
# Using PostgreSQL
export DATABASE_URL="postgresql://user:password@localhost:5432/fleet_management"
npm run db:push
npm run db:generate
```

#### 3. Configure Production Environment

Create `.env.production`:
```env
NODE_ENV="production"
DATABASE_URL="postgresql://user:password@localhost:5432/fleet_management"
JWT_SECRET="your-production-jwt-secret"
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="your-production-nextauth-secret"
RESEND_API_KEY="your-production-resend-api-key"
EMAIL_FROM="Fleet Manager <noreply@yourdomain.com>"
RESEND_DOMAIN="yourdomain.com"
```

#### 4. Start Production Server

```bash
npm start
```

#### 5. Using PM2 (Recommended)

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'fleet-management',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

Start with PM2:
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Docker Deployment

#### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/
COPY .env.example .env

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://fleet_user:password@postgres:5432/fleet_management
    depends_on:
      - postgres

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: fleet_management
      POSTGRES_USER: fleet_user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

Build and run:
```bash
docker-compose up --build
```

## 📧 Email Service Setup (Resend)

The application uses Resend for email notifications and authentication emails.

### Setup Resend

1. **Create Resend Account**
   - Go to [resend.com](https://resend.com)
   - Sign up for a free account
   - Verify your email address

2. **Get API Key**
   - Go to API Keys in your Resend dashboard
   - Create a new API key
   - Copy the API key

3. **Add Domain (Optional)**
   - Go to Domains in your Resend dashboard
   - Add your domain for custom email addresses
   - Verify domain ownership

4. **Configure Environment Variables**
   ```env
   RESEND_API_KEY="re_your_api_key_here"
   EMAIL_FROM="Fleet Manager <noreply@yourdomain.com>"
   RESEND_DOMAIN="yourdomain.com"
   ```

### Email Features

- **OTP Authentication**: Secure login with one-time passwords
- **Email Verification**: Verify user email addresses during registration
- **Password Reset**: Send secure password reset links
- **Maintenance Alerts**: Automated maintenance notifications
- **System Notifications**: Important system updates and alerts

### Development Mode

If `RESEND_API_KEY` is not configured, the system will:
- Log emails to console instead of sending
- Display OTP codes in terminal
- Show verification links in logs
- Continue functioning without email dependency

## 🔧 Troubleshooting

### Common Issues

#### 1. Database Connection Errors

**Problem**: `Error: Unable to connect to database`

**Solutions**:
```bash
# Check database service status
sudo systemctl status postgresql

# For SQLite, check file permissions
ls -la dev.db

# Test database connection
npx prisma db push
```

#### 2. Authentication Issues

**Problem**: `401 Unauthorized` or `Invalid token`

**Solutions**:
```bash
# Clear browser cache and cookies
# Check JWT_SECRET in .env
# Verify user is active in database

# Test authentication endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

#### 3. Build Errors

**Problem**: TypeScript errors or missing dependencies

**Solutions**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check TypeScript
npm run lint

# Rebuild
npm run build
```

#### 4. Port Already in Use

**Problem**: `EADDRINUSE: address already in use :::3000`

**Solutions**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

#### 5. Prisma Issues

**Problem**: Prisma client not generated or schema issues

**Solutions**:
```bash
# Regenerate Prisma client
npm run db:generate

# Reset database
npm run db:reset

# Check schema
npx prisma validate
```

### Debug Commands

```bash
# Check database
npx prisma studio

# Test API endpoints
curl http://localhost:3000/api/health

# Check logs
npm run dev 2>&1 | tee dev.log

# Clear all data
npm run db:reset
```

### Performance Issues

#### Database Optimization
```sql
-- Add indexes for frequently queried fields
CREATE INDEX idx_trucks_vin ON trucks(vin);
CREATE INDEX idx_tires_manufacturer ON tires(manufacturer);
CREATE INDEX idx_maintenance_truck_id ON maintenance_records(truckId);
```

#### Application Optimization
```javascript
// Use React.memo for expensive components
const ExpensiveComponent = React.memo(function ExpensiveComponent({ props }) {
  // ...
});

// Use useCallback for event handlers
const handleClick = useCallback(() => {
  // ...
}, [dependencies]);
```

## 📊 Data Migration

### Export Data
```bash
# Export to CSV using Prisma
npx prisma db seed --preview
```

### Import Data
```bash
# Create seed file in prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Create sample data
  await prisma.truck.create({
    data: {
      vin: '1HGCM82633A123456',
      make: 'Honda',
      model: 'Accord',
      year: 2020,
      licensePlate: 'ABC123',
      currentMileage: 45000
    }
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

### Backup and Restore
```bash
# Backup SQLite database
cp dev.db backup-$(date +%Y%m%d).db

# Restore SQLite database
cp backup-20240101.db dev.db

# For PostgreSQL
pg_dump fleet_management > backup-$(date +%Y%m%d).sql
psql fleet_management < backup-20240101.sql
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Workflow
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes
# Add tests
# Commit changes
git commit -m "Add new feature"

# Push to fork
git push origin feature/new-feature

# Create pull request
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

1. Check the troubleshooting section above
2. Review the API documentation
3. Check existing issues on GitHub
4. Create a new issue with detailed information

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Framework**: Next.js 15 with TypeScript#   F l e e t - M a n a g e r - f i n a l 
 
 
# Fleet-Manager-

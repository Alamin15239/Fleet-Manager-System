# 🚛 Fleet Manager System

<div align="center">

![Fleet Manager](https://img.shields.io/badge/Fleet-Manager-blue?style=for-the-badge&logo=truck&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

**A comprehensive fleet and tire management system built with Next.js 15, featuring real-time analytics, predictive maintenance, and advanced reporting capabilities.**

[🚀 Quick Start](#-quick-start) • [📖 Documentation](#-documentation) • [🎯 Features](#-features) • [🛠️ Tech Stack](#️-tech-stack) • [📱 Demo](#-demo)

</div>

---

## 🌟 Overview

Fleet Manager System is a modern, full-stack web application designed to streamline fleet operations, tire inventory management, and maintenance tracking. Built with cutting-edge technologies, it provides real-time insights, predictive analytics, and comprehensive reporting for fleet management companies.

### ✨ Key Highlights

- 🔄 **Real-time Updates** - Live data synchronization with Socket.io
- 🤖 **AI-Powered Analytics** - Predictive maintenance and smart insights
- 📊 **Advanced Reporting** - Professional PDF/Excel reports with custom templates
- 🔐 **Role-based Access** - Secure authentication with granular permissions
- 📱 **Responsive Design** - Mobile-first approach with modern UI/UX
- ⚡ **High Performance** - Optimized for speed and scalability

---

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **npm** or **yarn** - Package manager
- **Git** - Version control
- **PostgreSQL** (optional) - For production database

### 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/fleet-manager-system.git
   cd fleet-manager-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Database
   DATABASE_URL="file:./dev.db"
   
   # Authentication
   JWT_SECRET="your-super-secret-jwt-key-at-least-32-characters-long"
   NEXTAUTH_URL="http://localhost:3000"
   NEXTAUTH_SECRET="your-nextauth-secret"
   
   # Email Service (Resend)
   RESEND_API_KEY="your-resend-api-key"
   EMAIL_FROM="Fleet Manager <noreply@yourdomain.com>"
   ```

4. **Database setup**
   ```bash
   npm run db:push
   npm run db:generate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

### 🎉 First Login

1. Register a new admin account at `/register`
2. Login with your credentials at `/login`
3. Start exploring the dashboard!

---

## 🎯 Features

<details>
<summary><strong>🏠 Dashboard & Analytics</strong></summary>

- **Real-time KPI Cards** - Fleet overview, active vehicles, maintenance alerts
- **Interactive Charts** - Monthly costs, maintenance trends, performance metrics
- **Activity Feed** - Live updates on fleet activities
- **Quick Actions** - Fast access to common tasks
- **Predictive Insights** - AI-powered maintenance predictions

</details>

<details>
<summary><strong>🚛 Fleet Management</strong></summary>

- **Vehicle Inventory** - Complete truck database with detailed profiles
- **Status Tracking** - Real-time vehicle status (Active, Maintenance, Inactive)
- **Maintenance History** - Comprehensive service records
- **Health Monitoring** - Vehicle health scores and risk assessment
- **Document Management** - Store and manage vehicle documents

</details>

<details>
<summary><strong>🛞 Tire Management</strong></summary>

- **Inventory Tracking** - Complete tire inventory with serial numbers
- **Distribution Management** - Track tire assignments to vehicles
- **Performance Analytics** - Tire usage patterns and lifecycle analysis
- **Manufacturer Analysis** - Performance comparison by brand
- **Cost Optimization** - Identify cost-saving opportunities

</details>

<details>
<summary><strong>🔧 Maintenance System</strong></summary>

- **Service Scheduling** - Plan and schedule maintenance activities
- **Work Order Management** - Create and track maintenance jobs
- **Cost Tracking** - Monitor parts and labor costs
- **Mechanic Assignment** - Assign technicians to specific jobs
- **Preventive Maintenance** - Automated maintenance reminders

</details>

<details>
<summary><strong>📊 Advanced Reporting</strong></summary>

- **Professional Templates** - Executive summary, detailed inventory, performance reports
- **Custom Report Builder** - Create tailored reports for specific needs
- **Multiple Export Formats** - PDF, Excel, CSV export options
- **Automated Scheduling** - Schedule reports for automatic generation
- **Data Visualization** - Rich charts and graphs in reports

</details>

<details>
<summary><strong>👥 User Management</strong></summary>

- **Role-based Access Control** - Admin, Manager, User roles with specific permissions
- **User Activity Tracking** - Monitor user actions and system usage
- **Profile Management** - User profiles with photo uploads
- **Security Features** - Password policies, session management
- **Audit Logging** - Complete audit trail of system activities

</details>

---

## 🛠️ Tech Stack

### Frontend
- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com/)** - Modern component library
- **[Framer Motion](https://www.framer.com/motion/)** - Animation library
- **[Recharts](https://recharts.org/)** - Data visualization

### Backend
- **[Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)** - Serverless API endpoints
- **[Prisma ORM](https://www.prisma.io/)** - Type-safe database client
- **[JWT](https://jwt.io/)** - Secure authentication
- **[Socket.io](https://socket.io/)** - Real-time communication
- **[Zod](https://zod.dev/)** - Schema validation

### Database
- **[SQLite](https://www.sqlite.org/)** - Development database
- **[PostgreSQL](https://www.postgresql.org/)** - Production database
- **[Prisma](https://www.prisma.io/)** - Database toolkit

### DevOps & Tools
- **[ESLint](https://eslint.org/)** - Code linting
- **[Prettier](https://prettier.io/)** - Code formatting
- **[Vercel](https://vercel.com/)** - Deployment platform
- **[GitHub Actions](https://github.com/features/actions)** - CI/CD

---

## 📖 Documentation

### 🏗️ Project Structure

```
fleet-manager-system/
├── 📁 src/
│   ├── 📁 app/                 # Next.js App Router pages
│   │   ├── 📁 api/            # API endpoints
│   │   ├── 📁 dashboard/      # Dashboard pages
│   │   ├── 📁 trucks/         # Fleet management
│   │   ├── 📁 tire-management/ # Tire system
│   │   └── 📁 maintenance/    # Maintenance tracking
│   ├── 📁 components/         # Reusable UI components
│   ├── 📁 lib/               # Utility functions
│   ├── 📁 hooks/             # Custom React hooks
│   └── 📁 types/             # TypeScript definitions
├── 📁 prisma/                # Database schema & migrations
├── 📁 public/                # Static assets
└── 📁 scripts/               # Utility scripts
```

### 🔌 API Endpoints

<details>
<summary><strong>Authentication</strong></summary>

```http
POST /api/auth/login          # User login
POST /api/auth/register       # User registration (admin only)
GET  /api/auth/me            # Get current user
POST /api/auth/logout        # User logout
POST /api/auth/forgot-password # Password reset request
```

</details>

<details>
<summary><strong>Fleet Management</strong></summary>

```http
GET    /api/trucks           # Get all trucks
POST   /api/trucks           # Create new truck
GET    /api/trucks/:id       # Get truck by ID
PUT    /api/trucks/:id       # Update truck
DELETE /api/trucks/:id       # Delete truck
```

</details>

<details>
<summary><strong>Tire Management</strong></summary>

```http
GET    /api/tires            # Get tire inventory
POST   /api/tires            # Add new tires
PUT    /api/tires/:id        # Update tire
DELETE /api/tires/:id        # Remove tire
GET    /api/tires/reports    # Generate tire reports
```

</details>

<details>
<summary><strong>Maintenance</strong></summary>

```http
GET    /api/maintenance      # Get maintenance records
POST   /api/maintenance      # Create maintenance record
PUT    /api/maintenance/:id  # Update maintenance record
DELETE /api/maintenance/:id  # Delete maintenance record
```

</details>

### 🗄️ Database Schema

The application uses Prisma ORM with the following main entities:

- **Users** - System users with role-based access
- **Trucks** - Fleet vehicles with maintenance history
- **Tires** - Tire inventory and distribution tracking
- **Maintenance** - Service records and scheduling
- **Vehicles** - Vehicle information for tire assignment

---

## 🚀 Deployment

### Development

```bash
# Start development server
npm run dev

# Run with database sync
npm run dev:sync
```

### Production

#### Option 1: Vercel (Recommended)

1. **Connect to Vercel**
   ```bash
   npm i -g vercel
   vercel
   ```

2. **Configure environment variables** in Vercel dashboard

3. **Deploy**
   ```bash
   vercel --prod
   ```

#### Option 2: Docker

```dockerfile
# Build and run with Docker
docker build -t fleet-manager .
docker run -p 3000:3000 fleet-manager
```

#### Option 3: Traditional Server

```bash
# Build for production
npm run build

# Start production server
npm start

# Or with PM2
pm2 start ecosystem.config.js
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | ✅ |
| `JWT_SECRET` | JWT signing secret | ✅ |
| `NEXTAUTH_URL` | Application URL | ✅ |
| `NEXTAUTH_SECRET` | NextAuth secret | ✅ |
| `RESEND_API_KEY` | Email service API key | ❌ |
| `EMAIL_FROM` | Sender email address | ❌ |

### Database Setup

#### SQLite (Development)
```bash
# Default setup - no additional configuration needed
npm run db:push
npm run db:generate
```

#### PostgreSQL (Production)
```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb fleet_management

# Update DATABASE_URL in .env
DATABASE_URL="postgresql://user:password@localhost:5432/fleet_management"

# Run migrations
npm run db:push
```

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### API Testing

```bash
# Test API endpoints
npm run test:api

# Test database connection
npm run test:db
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
5. **Push to the branch**
   ```bash
   git push origin feature/amazing-feature
   ```
6. **Open a Pull Request**

### Development Guidelines

- Follow TypeScript best practices
- Use conventional commit messages
- Add tests for new features
- Update documentation as needed
- Ensure code passes linting

---

## 🐛 Troubleshooting

<details>
<summary><strong>Common Issues</strong></summary>

### Database Connection Error
```bash
# Check database status
npx prisma db push

# Reset database
npm run db:reset
```

### Port Already in Use
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

### Build Errors
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

</details>

---

## 📱 Demo

### Screenshots

<div align="center">

| Dashboard | Fleet Management |
|-----------|------------------|
| ![Dashboard](https://via.placeholder.com/400x250?text=Dashboard) | ![Fleet](https://via.placeholder.com/400x250?text=Fleet+Management) |

| Tire Management | Reports |
|-----------------|---------|
| ![Tires](https://via.placeholder.com/400x250?text=Tire+Management) | ![Reports](https://via.placeholder.com/400x250?text=Reports) |

</div>

### Live Demo

🌐 **[View Live Demo](https://fleet-manager-demo.vercel.app)**

**Demo Credentials:**
- **Admin:** admin@demo.com / admin123
- **Manager:** manager@demo.com / manager123
- **User:** user@demo.com / user123

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

Need help? We're here for you!

- 📧 **Email:** support@fleetmanager.com
- 💬 **Discord:** [Join our community](https://discord.gg/fleetmanager)
- 📖 **Documentation:** [Full docs](https://docs.fleetmanager.com)
- 🐛 **Issues:** [GitHub Issues](https://github.com/your-username/fleet-manager-system/issues)

---

## 🙏 Acknowledgments

- [Next.js Team](https://nextjs.org/) for the amazing framework
- [Vercel](https://vercel.com/) for hosting and deployment
- [Prisma](https://www.prisma.io/) for the excellent ORM
- [shadcn](https://ui.shadcn.com/) for the beautiful UI components
- All contributors who helped make this project better

---

<div align="center">

**Made with ❤️ by the Fleet Manager Team**

⭐ **Star this repo if you find it helpful!** ⭐

[🔝 Back to top](#-fleet-manager-system)

</div>
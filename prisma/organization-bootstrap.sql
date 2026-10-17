-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PREDICTIVE_FAILURE', 'OIL_CHANGE_DUE', 'INSPECTION_DUE', 'ABNORMAL_READINGS', 'EFFICIENCY_DROP', 'SAFETY_ALERT');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'USER');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('PROVISIONING', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "TruckStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TireOrigin" AS ENUM ('CHINESE', 'JAPANESE', 'EUROPEAN', 'AMERICAN', 'OTHER');

-- CreateEnum
CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "PurchaseExpenseCategory" AS ENUM ('MAINTENANCE', 'SPARE_PARTS', 'TIRE', 'BATTERY', 'OIL_FILTER', 'OTHER');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('VEHICLE_EXPENSE', 'VENDOR_PAYABLE', 'INPUT_VAT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "permissions" JSONB,
    "profileImage" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "title" TEXT,
    "bio" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),
    "otpCode" TEXT,
    "otpExpires" TIMESTAMP(3),
    "lastOtpRequest" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpires" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mechanics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "specialty" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mechanics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trucks" (
    "id" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "currentMileage" INTEGER NOT NULL,
    "status" "TruckStatus" NOT NULL DEFAULT 'ACTIVE',
    "image" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "engineHours" INTEGER,
    "lastOilChange" TIMESTAMP(3),
    "nextOilChange" TIMESTAMP(3),
    "healthScore" DOUBLE PRECISION,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "fuelEfficiency" DOUBLE PRECISION,
    "avgDailyMileage" DOUBLE PRECISION,
    "lastInspection" TIMESTAMP(3),
    "nextInspection" TIMESTAMP(3),
    "driverName" TEXT,

    CONSTRAINT "trucks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trailers" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "TruckStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "healthScore" DOUBLE PRECISION,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'LOW',
    "lastInspection" TIMESTAMP(3),
    "nextInspection" TIMESTAMP(3),
    "driverName" TEXT,

    CONSTRAINT "trailers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_jobs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "parts" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictive_alerts" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "confidence" DOUBLE PRECISION NOT NULL,
    "predictedFailureDate" TIMESTAMP(3),
    "recommendedAction" TEXT,
    "costImpact" DOUBLE PRECISION,
    "probability" DOUBLE PRECISION NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "predictive_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trailer_predictive_alerts" (
    "id" TEXT NOT NULL,
    "trailerId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "confidence" DOUBLE PRECISION NOT NULL,
    "predictedFailureDate" TIMESTAMP(3),
    "recommendedAction" TEXT,
    "costImpact" DOUBLE PRECISION,
    "probability" DOUBLE PRECISION NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trailer_predictive_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "description" TEXT,
    "datePerformed" TIMESTAMP(3) NOT NULL,
    "partsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laborCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mechanicId" TEXT,
    "createdById" TEXT,
    "nextServiceDue" TIMESTAMP(3),
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "attachments" JSONB,
    "isOilChange" BOOLEAN NOT NULL DEFAULT false,
    "oilChangeInterval" INTEGER,
    "oilQuantityLiters" DOUBLE PRECISION,
    "currentMileage" INTEGER,
    "maintenanceJobId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "wasPredicted" BOOLEAN NOT NULL DEFAULT false,
    "predictionId" TEXT,
    "downtimeHours" DOUBLE PRECISION,
    "failureMode" TEXT,
    "rootCause" TEXT,
    "driverName" TEXT,
    "mechanicName" TEXT,
    "vehicleName" TEXT,
    "breakdownLocation" TEXT,
    "breakdownTime" TIMESTAMP(3),
    "isBreakdown" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trailer_maintenance_records" (
    "id" TEXT NOT NULL,
    "trailerId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "description" TEXT,
    "datePerformed" TIMESTAMP(3) NOT NULL,
    "partsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laborCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mechanicId" TEXT,
    "createdById" TEXT,
    "nextServiceDue" TIMESTAMP(3),
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "attachments" JSONB,
    "maintenanceJobId" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "wasPredicted" BOOLEAN NOT NULL DEFAULT false,
    "predictionId" TEXT,
    "downtimeHours" DOUBLE PRECISION,
    "failureMode" TEXT,
    "rootCause" TEXT,
    "driverName" TEXT,
    "mechanicName" TEXT,
    "vehicleName" TEXT,
    "breakdownLocation" TEXT,
    "breakdownTime" TIMESTAMP(3),
    "isBreakdown" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "trailer_maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_job_cards" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "truckId" TEXT,
    "trailerId" TEXT,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "odometerKm" INTEGER,
    "serviceType" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "reportedIssue" TEXT,
    "technicianName" TEXT,
    "driverName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "nextServiceOdometer" INTEGER,
    "nextServiceDate" TIMESTAMP(3),
    "partsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laborCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "technicianSignature" TEXT,
    "supervisorSignature" TEXT,
    "driverSignature" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_job_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "currencySymbol" TEXT NOT NULL DEFAULT '﷼',
    "currencyCode" TEXT NOT NULL DEFAULT 'SAR',
    "currencyName" TEXT NOT NULL DEFAULT 'Saudi Riyal',
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "thousandsSeparator" TEXT NOT NULL DEFAULT ',',
    "decimalSeparator" TEXT NOT NULL DEFAULT '.',
    "symbolPosition" TEXT NOT NULL DEFAULT 'before',
    "companyName" TEXT,
    "companyAddress" TEXT,
    "companyPhone" TEXT,
    "companyEmail" TEXT,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIBAN" TEXT,
    "acceptedPaymentMethods" JSONB,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "maintenanceIntervals" JSONB,
    "notifications" JSONB,
    "rolePermissions" JSONB,
    "userPermissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "status" "OrganizationStatus" NOT NULL DEFAULT 'PROVISIONING',
    "schemaReady" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "neonProjectId" TEXT,
    "encryptedDatabaseUrl" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vatRegistration" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" TEXT NOT NULL,
    "internalNumber" TEXT NOT NULL,
    "vendorInvoiceNumber" TEXT,
    "vendorId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "isVatInvoice" BOOLEAN NOT NULL DEFAULT false,
    "pricesIncludeVat" BOOLEAN NOT NULL DEFAULT false,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "vatTotal" DECIMAL(14,2) NOT NULL,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "status" "PurchaseInvoiceStatus" NOT NULL DEFAULT 'POSTED',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "category" "PurchaseExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "netAmount" DECIMAL(14,2) NOT NULL,
    "vatAmount" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "truckId" TEXT,
    "trailerId" TEXT,

    CONSTRAINT "purchase_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_ledger_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "truckId" TEXT,
    "trailerId" TEXT,
    "vendorId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_journal_entries" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_journal_lines" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "invoiceLineId" TEXT,
    "category" "PurchaseExpenseCategory",
    "description" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onedrive_integrations" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "connectedEmail" TEXT,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "driveItemId" TEXT,
    "driveItemName" TEXT,
    "webUrl" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT NOT NULL DEFAULT 'NEVER',
    "lastSyncError" TEXT,
    "syncInProgressAt" TIMESTAMP(3),
    "syncRevision" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedRevision" INTEGER NOT NULL DEFAULT 0,
    "lastWorkbookHash" TEXT,
    "graphSubscriptionId" TEXT,
    "graphSubscriptionExpiresAt" TIMESTAMP(3),
    "graphSubscriptionClientState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onedrive_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "excel_workbook_changes" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "recordId" TEXT,
    "rowData" JSONB NOT NULL,
    "changes" JSONB,
    "baseUpdatedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "appliedById" TEXT,

    CONSTRAINT "excel_workbook_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "truckId" TEXT,
    "userId" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trailer_notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "trailerId" TEXT,
    "userId" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trailer_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "userEmail" TEXT,
    "userRole" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "browser" TEXT,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "location" JSONB,
    "os" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "entityName" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "browser" TEXT,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "location" JSONB,
    "os" TEXT,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "loginTime" TIMESTAMP(3) NOT NULL,
    "logoutTime" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "sessionDuration" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "browser" TEXT,
    "deviceName" TEXT,
    "deviceType" TEXT,
    "location" JSONB,
    "os" TEXT,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "trailerNumber" TEXT,
    "driverName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tires" (
    "id" TEXT NOT NULL,
    "tireSize" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "plateNumber" TEXT,
    "trailerNumber" TEXT,
    "driverName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "serialNumber" TEXT,

    CONSTRAINT "tires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT,
    "editorState" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "eventData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "trucks_vin_key" ON "trucks"("vin");

-- CreateIndex
CREATE UNIQUE INDEX "trailers_number_key" ON "trailers"("number");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_jobs_name_category_key" ON "maintenance_jobs"("name", "category");

-- CreateIndex
CREATE UNIQUE INDEX "workshop_job_cards_jobNumber_key" ON "workshop_job_cards"("jobNumber");

-- CreateIndex
CREATE INDEX "workshop_job_cards_serviceDate_idx" ON "workshop_job_cards"("serviceDate");

-- CreateIndex
CREATE INDEX "workshop_job_cards_truckId_idx" ON "workshop_job_cards"("truckId");

-- CreateIndex
CREATE INDEX "workshop_job_cards_trailerId_idx" ON "workshop_job_cards"("trailerId");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_neonProjectId_key" ON "organizations"("neonProjectId");

-- CreateIndex
CREATE INDEX "organizations_status_idx" ON "organizations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_vatRegistration_key" ON "vendors"("vatRegistration");

-- CreateIndex
CREATE INDEX "vendors_name_idx" ON "vendors"("name");

-- CreateIndex
CREATE INDEX "vendors_isActive_idx" ON "vendors"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_internalNumber_key" ON "purchase_invoices"("internalNumber");

-- CreateIndex
CREATE INDEX "purchase_invoices_invoiceDate_idx" ON "purchase_invoices"("invoiceDate");

-- CreateIndex
CREATE INDEX "purchase_invoices_vendorId_invoiceDate_idx" ON "purchase_invoices"("vendorId", "invoiceDate");

-- CreateIndex
CREATE INDEX "purchase_invoices_status_idx" ON "purchase_invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_vendorId_vendorInvoiceNumber_key" ON "purchase_invoices"("vendorId", "vendorInvoiceNumber");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_truckId_idx" ON "purchase_invoice_lines"("truckId");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_trailerId_idx" ON "purchase_invoice_lines"("trailerId");

-- CreateIndex
CREATE INDEX "purchase_invoice_lines_category_idx" ON "purchase_invoice_lines"("category");

-- CreateIndex
CREATE UNIQUE INDEX "fleet_ledger_accounts_code_key" ON "fleet_ledger_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "fleet_ledger_accounts_truckId_key" ON "fleet_ledger_accounts"("truckId");

-- CreateIndex
CREATE UNIQUE INDEX "fleet_ledger_accounts_trailerId_key" ON "fleet_ledger_accounts"("trailerId");

-- CreateIndex
CREATE UNIQUE INDEX "fleet_ledger_accounts_vendorId_key" ON "fleet_ledger_accounts"("vendorId");

-- CreateIndex
CREATE INDEX "fleet_ledger_accounts_type_idx" ON "fleet_ledger_accounts"("type");

-- CreateIndex
CREATE INDEX "purchase_journal_entries_entryDate_idx" ON "purchase_journal_entries"("entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_journal_entries_invoiceId_isReversal_key" ON "purchase_journal_entries"("invoiceId", "isReversal");

-- CreateIndex
CREATE INDEX "purchase_journal_lines_accountId_idx" ON "purchase_journal_lines"("accountId");

-- CreateIndex
CREATE INDEX "purchase_journal_lines_entryId_idx" ON "purchase_journal_lines"("entryId");

-- CreateIndex
CREATE INDEX "purchase_journal_lines_invoiceLineId_idx" ON "purchase_journal_lines"("invoiceLineId");

-- CreateIndex
CREATE UNIQUE INDEX "excel_workbook_changes_fingerprint_key" ON "excel_workbook_changes"("fingerprint");

-- CreateIndex
CREATE INDEX "excel_workbook_changes_status_detectedAt_idx" ON "excel_workbook_changes"("status", "detectedAt");

-- CreateIndex
CREATE INDEX "excel_workbook_changes_entityType_recordId_status_idx" ON "excel_workbook_changes"("entityType", "recordId", "status");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "trailer_notifications_createdAt_idx" ON "trailer_notifications"("createdAt");

-- CreateIndex
CREATE INDEX "trailer_notifications_isRead_idx" ON "trailer_notifications"("isRead");

-- CreateIndex
CREATE INDEX "trailer_notifications_type_idx" ON "trailer_notifications"("type");

-- CreateIndex
CREATE INDEX "trailer_notifications_userId_idx" ON "trailer_notifications"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plateNumber_key" ON "vehicles"("plateNumber");

-- CreateIndex
CREATE INDEX "vehicles_plateNumber_idx" ON "vehicles"("plateNumber");

-- CreateIndex
CREATE INDEX "vehicles_trailerNumber_idx" ON "vehicles"("trailerNumber");

-- CreateIndex
CREATE INDEX "vehicles_driverName_idx" ON "vehicles"("driverName");

-- CreateIndex
CREATE INDEX "vehicles_isActive_idx" ON "vehicles"("isActive");

-- CreateIndex
CREATE INDEX "tires_manufacturer_idx" ON "tires"("manufacturer");

-- CreateIndex
CREATE INDEX "tires_origin_idx" ON "tires"("origin");

-- CreateIndex
CREATE INDEX "tires_plateNumber_idx" ON "tires"("plateNumber");

-- CreateIndex
CREATE INDEX "tires_driverName_idx" ON "tires"("driverName");

-- CreateIndex
CREATE INDEX "tires_serialNumber_idx" ON "tires"("serialNumber");

-- CreateIndex
CREATE INDEX "tires_createdAt_idx" ON "tires"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_emailId_key" ON "email_logs"("emailId");

-- CreateIndex
CREATE INDEX "email_logs_emailId_idx" ON "email_logs"("emailId");

-- CreateIndex
CREATE INDEX "email_logs_type_idx" ON "email_logs"("type");

-- CreateIndex
CREATE INDEX "email_logs_createdAt_idx" ON "email_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "predictive_alerts" ADD CONSTRAINT "predictive_alerts_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trailer_predictive_alerts" ADD CONSTRAINT "trailer_predictive_alerts_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_maintenanceJobId_fkey" FOREIGN KEY ("maintenanceJobId") REFERENCES "maintenance_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "mechanics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trailer_maintenance_records" ADD CONSTRAINT "trailer_maintenance_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trailer_maintenance_records" ADD CONSTRAINT "trailer_maintenance_records_maintenanceJobId_fkey" FOREIGN KEY ("maintenanceJobId") REFERENCES "maintenance_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trailer_maintenance_records" ADD CONSTRAINT "trailer_maintenance_records_mechanicId_fkey" FOREIGN KEY ("mechanicId") REFERENCES "mechanics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trailer_maintenance_records" ADD CONSTRAINT "trailer_maintenance_records_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_job_cards" ADD CONSTRAINT "workshop_job_cards_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_job_cards" ADD CONSTRAINT "workshop_job_cards_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_job_cards" ADD CONSTRAINT "workshop_job_cards_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "purchase_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_ledger_accounts" ADD CONSTRAINT "fleet_ledger_accounts_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_ledger_accounts" ADD CONSTRAINT "fleet_ledger_accounts_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_ledger_accounts" ADD CONSTRAINT "fleet_ledger_accounts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_journal_entries" ADD CONSTRAINT "purchase_journal_entries_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "purchase_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_journal_lines" ADD CONSTRAINT "purchase_journal_lines_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "purchase_journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_journal_lines" ADD CONSTRAINT "purchase_journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "fleet_ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_journal_lines" ADD CONSTRAINT "purchase_journal_lines_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "purchase_invoice_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "trucks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trailer_notifications" ADD CONSTRAINT "trailer_notifications_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tires" ADD CONSTRAINT "tires_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tires" ADD CONSTRAINT "tires_plateNumber_fkey" FOREIGN KEY ("plateNumber") REFERENCES "vehicles"("plateNumber") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

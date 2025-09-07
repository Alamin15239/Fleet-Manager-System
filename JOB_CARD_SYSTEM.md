# Job Card System Implementation

## Overview
A complete Job Card system integrated with the Fleet Manager app that allows generating, printing, and managing job cards for maintenance work.

## Features Implemented

### 1. Database Schema
- **JobCard Model**: Complete job card data with QR tokens
- **JobCardTemplate Model**: Customizable print templates
- **Relations**: Linked to MaintenanceRecord, TrailerMaintenanceRecord, Mechanic, and User

### 2. API Routes
- `GET/POST /api/job-cards` - List and create job cards
- `GET/PUT/DELETE /api/job-cards/[id]` - Individual job card operations
- `POST /api/job-cards/print` - PDF generation with audit trail
- `GET /api/job-cards/by-token/[token]` - QR code scanner access
- `GET/POST /api/job-card-templates` - Template management

### 3. Frontend Components

#### JobCardPreviewModal
- Vehicle information input
- Service details (mechanic, issues, work requested)
- Editable tasks list with status tracking
- Parts inventory with cost calculation
- Save and Print functionality

#### Job Cards List Page (`/job-cards`)
- Filterable job card list (status, vehicle type, mechanic, date)
- Print functionality with audit tracking
- Edit existing job cards
- Pagination support

#### QR Scanner Page (`/job-cards/[token]`)
- Public access via QR code
- Complete job card details display
- Print functionality
- Mobile-friendly design

#### Template Editor (`/admin/job-card-templates`)
- HTML template editor with token system
- Default template management
- Preview functionality

### 4. Integration Points

#### Maintenance Page Integration
- "Generate Job Card" button in Add Maintenance form
- "Generate Job Card" button for each maintenance record
- Auto-populate job card data from maintenance records

#### Navigation
- Added "Job Cards" to main navigation menu
- Admin-only template editor access

### 5. PDF Generation
- Server-side PDF generation using Puppeteer
- Customizable HTML templates with token replacement
- QR code integration for scan-back functionality
- Professional A4 format with signatures placeholders

### 6. Token System
Available template tokens:
- `{{jobCardNo}}` - Unique job card number
- `{{vehicleName}}` - Vehicle name/description
- `{{vehicleIdentifier}}` - License plate or trailer number
- `{{driverName}}` - Assigned driver
- `{{mechanicName}}` - Assigned mechanic
- `{{reportedIssues}}` - Customer reported issues
- `{{requestedWork}}` - Work to be performed
- `{{tasks}}` - Dynamic tasks table
- `{{parts}}` - Dynamic parts table
- `{{totalCost}}` - Calculated total cost
- `{{qrCode}}` - QR code image for scan-back
- `{{createdDate}}` - Job card creation date
- `{{odometer}}` - Vehicle odometer reading

### 7. Audit Trail
- Print tracking (who printed, when, how many times)
- Creation and modification history
- User attribution for all actions

## Usage Workflow

### Creating Job Cards
1. **From Maintenance Form**: Click "Generate Job Card" when adding maintenance
2. **From Maintenance List**: Click job card icon for existing records
3. **Standalone**: Use "Create Job Card" in job cards page

### Editing Job Cards
1. Open job card from list
2. Modify vehicle info, tasks, parts
3. Save changes
4. Print updated version

### Printing Job Cards
1. Click "Save & Print" or "Print" button
2. PDF generated server-side
3. Download automatically starts
4. Print count incremented

### QR Code Scanning
1. Scan QR code from printed job card
2. Access public job card view
3. View all details without login
4. Option to print additional copies

### Template Management (Admin)
1. Access `/admin/job-card-templates`
2. Create/edit HTML templates
3. Use token system for dynamic content
4. Set default template

## Database Migration Required

Run the following command to apply schema changes:
```bash
npx prisma db push
```

## Dependencies
- `puppeteer` - PDF generation (already installed)
- `qrcode` - QR code generation (already installed)

## File Structure
```
src/
├── app/
│   ├── api/
│   │   ├── job-cards/
│   │   │   ├── route.ts
│   │   │   ├── [id]/route.ts
│   │   │   ├── print/route.ts
│   │   │   └── by-token/[token]/route.ts
│   │   └── job-card-templates/
│   │       └── route.ts
│   ├── job-cards/
│   │   ├── page.tsx
│   │   └── [token]/page.tsx
│   └── admin/
│       └── job-card-templates/
│           └── page.tsx
├── components/
│   └── job-card-preview-modal.tsx
└── prisma/
    └── schema.prisma (updated)
```

## Next Steps
1. Run database migration: `npx prisma db push`
2. Test job card creation from maintenance records
3. Test PDF generation and printing
4. Test QR code scanning functionality
5. Configure template permissions for admin users
6. Add job card permissions to role-based access control

## Security Considerations
- QR tokens are unique and non-guessable
- Public job card view is read-only
- Template editing restricted to admin users
- Print audit trail for accountability

## Performance Notes
- PDF generation is server-side for consistency
- QR codes cached for performance
- Pagination implemented for large job card lists
- Database indexes on frequently queried fields
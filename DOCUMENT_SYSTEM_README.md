# Document Management System

A fully isolated, production-ready PDF/document management system integrated into the existing Next.js Fleet Manager application.

## 🚀 Features

- **Rich Text Editor**: Tiptap-powered editor with formatting, tables, and lists
- **Table Editor**: Interactive data grid with add/remove rows and columns
- **Excel Support**: Upload, edit, and download Excel files using SheetJS
- **PDF Generation**: Puppeteer-powered PDF generation with QR codes
- **File Upload**: Support for PDF, images, and Excel files
- **Document Viewer**: Dedicated viewer with print, share, and download options
- **QR Code Integration**: Each document gets a QR code linking back to the viewer
- **Version Control**: Automatic version incrementing on updates
- **Responsive Design**: Mobile-friendly interface matching existing design system

## 📁 File Structure

```
src/
├── app/
│   ├── api/
│   │   └── documents/
│   │       ├── route.ts              # GET/POST documents
│   │       ├── [id]/route.ts         # GET/PUT/DELETE single document
│   │       ├── pdf/[id]/route.ts     # PDF generation with QR codes
│   │       └── upload/route.ts       # File upload handler
│   ├── editor/
│   │   └── page.tsx                  # Document editor page
│   └── document/
│       └── [id]/page.tsx             # Document viewer page
├── components/
│   ├── Editor.tsx                    # Tiptap rich text editor
│   ├── TableEditor.tsx               # React Data Grid table editor
│   ├── ExcelEditor.tsx               # SheetJS Excel editor
│   └── PDFViewer.tsx                 # React PDF viewer
├── lib/
│   ├── qrCode.ts                     # QR code generation utility
│   └── puppeteer.ts                  # PDF generation utility
└── types/
    └── document.ts                   # TypeScript interfaces
```

## 🛠️ Installation

The system is already integrated. Dependencies installed:

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header react-data-grid xlsx puppeteer react-pdf @types/puppeteer
```

## 📊 Database Schema

Added to existing Prisma schema:

```prisma
model Document {
  id          String   @id @default(cuid())
  title       String
  type        String   // text, table, excel, image, pdf
  fileUrl     String?
  editorState Json?    // Tiptap or table/Excel state
  version     Int      @default(1)
  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   User?    @relation(fields: [createdById], references: [id], onDelete: SetNull)

  @@map("documents")
}
```

## 🔗 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | Fetch all documents |
| `/api/documents` | POST | Create new document |
| `/api/documents/[id]` | GET | Fetch single document |
| `/api/documents/[id]` | PUT | Update document |
| `/api/documents/[id]` | DELETE | Delete document |
| `/api/documents/pdf/[id]` | GET | Generate PDF with QR code |
| `/api/upload` | POST | Upload files |

## 🎨 UI Components

### Editor Component
- Rich text editing with Tiptap
- Toolbar with formatting options
- Table insertion and editing
- Responsive design

### TableEditor Component
- Interactive data grid
- Add/remove rows and columns
- Cell editing
- Export functionality

### ExcelEditor Component
- Upload Excel files
- Edit spreadsheet data
- Download as Excel
- Table-based interface

### PDFViewer Component
- PDF display with pagination
- Zoom controls
- Download functionality
- Navigation controls

## 🔐 Security Features

- JWT token authentication
- User-based document access
- Input validation with Zod
- File type restrictions
- Secure file upload handling

## 📱 Pages

### `/editor` - Document Editor
- Create new documents
- Choose document type (text, table, excel)
- Real-time editing
- Save and version control
- File upload support
- Recent documents sidebar

### `/document/[id]` - Document Viewer
- View documents in read-only mode
- Print functionality
- Share options
- Download as PDF with QR code
- Document metadata sidebar
- QR code display

## 🎯 Usage

1. **Access the Editor**: Navigate to `/editor` from the main navigation
2. **Create Document**: Choose type and enter title
3. **Edit Content**: Use the appropriate editor for your document type
4. **Save Document**: Click save to store in database
5. **View Document**: Access via `/document/[id]` or click from recent list
6. **Generate PDF**: Use download button to create PDF with QR code
7. **Share**: Use QR code or share button to distribute document

## 🔄 PDF Generation Workflow

1. User clicks "Download PDF" on document viewer
2. API route `/api/documents/pdf/[id]` is called
3. Puppeteer generates HTML from document content
4. QR code is generated linking to document viewer
5. PDF is created with content + QR code
6. PDF is returned as download

## 🎨 Styling

- Matches existing Fleet Manager design system
- Uses Tailwind CSS classes consistent with the app
- Responsive design for mobile and desktop
- Professional UI with proper spacing and typography
- Consistent with existing card layouts and button styles

## 🔧 Configuration

Environment variables (already configured):
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-jwt-secret"
NEXTAUTH_URL="http://localhost:3000"
```

## 🚀 Production Deployment

The system is production-ready with:
- Proper error handling
- Loading states
- Responsive design
- Security measures
- Performance optimizations
- Clean separation from existing code

## 🔒 Isolation

The document management system is completely isolated:
- ✅ No changes to existing pages or components
- ✅ Self-contained API routes
- ✅ Independent database models
- ✅ Separate UI components
- ✅ Modular file structure
- ✅ Easy to maintain and extend

## 📝 Notes

- QR codes link back to the document viewer page
- Documents are versioned automatically on updates
- File uploads are stored in `/public/uploads/`
- PDF generation includes document content + QR code
- All components follow existing design patterns
- Authentication is handled via existing JWT system

The system is now fully functional and ready for production use!
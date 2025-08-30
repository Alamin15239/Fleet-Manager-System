# Security Policy

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication with secure secrets
- Role-based access control (ADMIN, MANAGER, USER)
- Email verification required
- Admin approval for new accounts
- Rate limiting on auth endpoints (10 requests/15 minutes)

### Data Protection
- Password hashing with bcrypt (12 rounds)
- SQL injection protection via Prisma ORM
- Input validation with Zod schemas
- XSS protection with DOMPurify

### Environment Security
- Required JWT_SECRET environment variable
- No default/fallback secrets
- Secure cookie settings in production

## 🚨 Security Requirements

### Required Environment Variables
```bash
JWT_SECRET="minimum-32-character-secure-random-string"
NEXTAUTH_SECRET="another-secure-random-string"
```

### Production Checklist
- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Enable HTTPS
- [ ] Set secure cookie flags
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Regular security updates

## 📋 Vulnerability Reporting

Report security issues to: security@yourcompany.com

## 🔄 Security Updates

- Next.js: Updated to 15.5.2 (fixes SSRF, image optimization)
- DOMPurify: Updated to 3.2.4 (fixes XSS)
- Removed XLSX library (prototype pollution risk)

Last Updated: August 2024
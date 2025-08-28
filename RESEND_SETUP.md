# Resend Email Setup Guide

This guide will help you set up Resend for email functionality in the Fleet Manager application.

## 🚀 Quick Setup

### 1. Create a Resend Account

1. Go to [resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### 2. Get Your API Key

1. Log in to your Resend dashboard
2. Go to **API Keys** section
3. Click **Create API Key**
4. Give it a name (e.g., "Fleet Manager")
5. Copy the API key (starts with `re_`)

### 3. Configure Environment Variables

Add these variables to your `.env` file:

```env
# Resend Configuration
RESEND_API_KEY="re_your_actual_api_key_here"
EMAIL_FROM="Fleet Manager <noreply@yourdomain.com>"

# Optional: App URL for email links
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Domain Setup (Optional but Recommended)

For production, you should verify your domain:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Add the required DNS records to your domain provider
5. Wait for verification (usually takes a few minutes)

Once verified, update your `EMAIL_FROM`:
```env
EMAIL_FROM="Fleet Manager <noreply@yourdomain.com>"
```

## 📧 Email Features

The application now supports:

### 1. **OTP Login**
- Users can request OTP via email
- 6-digit codes valid for 10 minutes
- Rate limiting (60 seconds between requests)

### 2. **Email Verification**
- New users receive verification emails
- 24-hour expiry on verification links
- Required before account activation

### 3. **Password Reset**
- Forgot password functionality
- Secure reset links via email
- 1-hour expiry on reset tokens

### 4. **User Registration**
- Welcome emails for new users
- Email verification required
- Admin approval workflow

## 🔧 API Endpoints

### Send OTP
```http
POST /api/auth/send-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Verify OTP
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```

### Forgot Password
```http
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

## 🛠️ Development Mode

If `RESEND_API_KEY` is not configured, the application will run in development mode:

- Email content will be logged to console
- OTP codes will be displayed in terminal
- Verification links will be shown in logs
- No actual emails will be sent

This allows development without email configuration.

## 📊 Resend Limits

### Free Plan
- 100 emails per day
- 3,000 emails per month
- All features included

### Paid Plans
- Starting at $20/month
- 50,000 emails per month
- Higher sending rates
- Priority support

## 🔒 Security Features

### Rate Limiting
- OTP requests limited to once per 60 seconds
- Prevents spam and abuse

### Token Expiry
- OTP: 10 minutes
- Email verification: 24 hours
- Password reset: 1 hour

### Secure Storage
- OTP codes are hashed before storage
- Tokens are cryptographically secure
- No plain text passwords in database

## 🚨 Troubleshooting

### Common Issues

#### 1. "RESEND_API_KEY not found"
**Solution**: Add your Resend API key to `.env` file

#### 2. "Domain not verified"
**Solution**: 
- Use `onboarding@resend.dev` for testing
- Or verify your domain in Resend dashboard

#### 3. "Rate limit exceeded"
**Solution**: Wait 60 seconds between OTP requests

#### 4. "Email not delivered"
**Check**:
- Spam folder
- API key is correct
- Domain is verified (for custom domains)
- Resend dashboard for delivery status

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV="development"
```

This will show detailed logs in the console.

## 📝 Email Templates

The application includes professional email templates for:

- **OTP Login**: Clean, branded OTP delivery
- **Email Verification**: Welcome message with verification button
- **Password Reset**: Secure reset instructions
- **Registration**: Account creation confirmation

All templates are:
- Mobile responsive
- Professionally designed
- Include security notices
- Have fallback text versions

## 🔄 Migration from Gmail SMTP

If you're migrating from Gmail SMTP:

1. **Remove old environment variables**:
   ```env
   # Remove these
   EMAIL_HOST=
   EMAIL_PORT=
   EMAIL_SECURE=
   EMAIL_USER=
   EMAIL_PASS=
   ```

2. **Add Resend variables**:
   ```env
   # Add these
   RESEND_API_KEY="re_your_key_here"
   EMAIL_FROM="Fleet Manager <noreply@yourdomain.com>"
   ```

3. **Test the integration**:
   ```bash
   npm run dev
   # Try OTP login or registration
   ```

## 📞 Support

- **Resend Documentation**: [resend.com/docs](https://resend.com/docs)
- **Resend Support**: [resend.com/support](https://resend.com/support)
- **Fleet Manager Issues**: Check the application logs for detailed error messages

---

**Last Updated**: January 2024  
**Resend Version**: 6.0.1  
**Integration**: Complete ✅
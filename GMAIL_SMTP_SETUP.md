# ⚠️ DEPRECATED: Gmail SMTP Setup Guide

**This guide is deprecated. The Fleet Manager application now uses Resend for email functionality.**

**👉 Please see [RESEND_SETUP.md](./RESEND_SETUP.md) for the current email setup instructions.**

---

*This guide is kept for reference only. Gmail SMTP configuration is no longer supported.*

## 📧 Prerequisites

1. **Gmail Account**: You need a Gmail account
2. **2-Step Verification**: Must be enabled on your Gmail account
3. **App Password**: You need to generate an app-specific password

## 🔧 Step-by-Step Setup

### 1. Enable 2-Step Verification

If you haven't already enabled 2-Step Verification:

1. Go to your Google Account: https://myaccount.google.com/
2. Click on "Security" in the left navigation panel
3. Scroll down to "How you sign in to Google"
4. Click on "2-Step Verification"
5. Follow the prompts to enable 2-Step Verification

### 2. Generate App Password

After enabling 2-Step Verification:

1. Stay on the Security page
2. Scroll down to "How you sign in to Google"
3. Click on "App passwords" (you may need to sign in again)
4. Under "Select app", choose "Other (Custom name)"
5. Enter a name for your app (e.g., "Fleet Manager App")
6. Click "Generate"
7. **Copy the 16-character password immediately** (you won't be able to see it again)

### 3. Configure Environment Variables

Update your `.env` file with the following settings:

```bash
# Gmail SMTP Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-character-app-password
EMAIL_FROM="Fleet Manager" <your-gmail@gmail.com>
```

**Important Notes:**
- `EMAIL_USER`: Your full Gmail address
- `EMAIL_PASS`: The 16-character app password you generated (NOT your regular Gmail password)
- `EMAIL_SECURE`: Must be `false` for Gmail's STARTTLS
- `EMAIL_PORT`: Use `587` for TLS/STARTTLS

### 4. Configuration for Different Environments

#### Local Development (.env)
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-character-app-password
EMAIL_FROM="Fleet Manager Dev" <your-gmail@gmail.com>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

#### Production (.env.production)
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-character-app-password
EMAIL_FROM="Fleet Manager" <your-gmail@gmail.com>
NEXT_PUBLIC_APP_URL=https://your-domain.com
NODE_ENV=production
```

## 🧪 Testing the Configuration

### 1. Test Email Sending

You can test the email configuration by:

1. Starting your application: `npm run dev`
2. Try to register a new user at `http://localhost:3000/signup`
3. Check if you receive the verification email
4. Try the OTP login at `http://localhost:3000/login`

### 2. Check Development Mode

If email configuration is not set up, the system will fall back to development mode and display OTP/verification links in the console:

```bash
=== 📧 DEVELOPMENT MODE - EMAIL CONFIGURATION MISSING ===
🔑 OTP for user@example.com: 123456
👤 Name: John Doe
⚙️  To enable email sending, configure Gmail SMTP in .env file:
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_PASS=your-app-password
=========================================================
```

## 🔍 Troubleshooting

### Common Issues

#### 1. "Authentication failed" Error
- **Cause**: Incorrect app password or 2-Step Verification not enabled
- **Solution**: 
  - Ensure 2-Step Verification is enabled
  - Generate a new app password
  - Double-check the app password (no spaces, all 16 characters)

#### 2. "Connection timeout" Error
- **Cause**: Firewall blocking SMTP port or incorrect port settings
- **Solution**:
  - Use port 587 with `EMAIL_SECURE=false`
  - Check if your network allows SMTP connections
  - Try disabling firewall temporarily for testing

#### 3. "Email not received"
- **Cause**: Email sent to spam/promotions folder or configuration issues
- **Solution**:
  - Check spam/junk folders
  - Verify the "from" email address
  - Check Gmail sending limits (100 emails/day for free accounts)

#### 4. "Invalid login credentials"
- **Cause**: Using regular Gmail password instead of app password
- **Solution**: Always use the 16-character app password, not your regular Gmail password

### Gmail Sending Limits

Free Gmail accounts have sending limits:
- **100 emails per day**
- **500 recipients per day (total)**
- **Maximum 500 recipients per message**

For higher limits, consider:
- Google Workspace account (2,000 emails/day)
- Third-party email services (SendGrid, Mailgun, etc.)

## 🚀 Alternative Email Services

If you prefer not to use Gmail SMTP, you can configure other email services:

### SendGrid (Recommended for Production)
```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key
EMAIL_FROM="Fleet Manager" <noreply@yourdomain.com>
```

### Mailgun
```bash
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=postmaster@yourdomain.com
EMAIL_PASS=your-mailgun-password
EMAIL_FROM="Fleet Manager" <noreply@yourdomain.com>
```

## 📋 Final Checklist

- [ ] Enable 2-Step Verification on Gmail account
- [ ] Generate 16-character app password
- [ ] Update `.env` file with correct SMTP settings
- [ ] Test user registration and email verification
- [ ] Test OTP login functionality
- [ ] Check spam/junk folders for test emails
- [ ] Verify email sending in production environment

## 🔒 Security Best Practices

1. **Never commit your `.env` file to version control**
2. **Use different app passwords for different environments**
3. **Regularly rotate your app passwords**
4. **Monitor email sending logs for unusual activity**
5. **Use domain-based emails in production (not @gmail.com)**

## 📞 Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify your Gmail account settings
3. Ensure your app password is correct
4. Test with a different Gmail account if needed

For additional help, refer to:
- [Gmail App Passwords Help](https://support.google.com/accounts/answer/185833)
- [Nodemailer Gmail Configuration](https://nodemailer.com/usage/using-gmail/)
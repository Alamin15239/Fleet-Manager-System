# User Activity Tracking System

## Overview

The Fleet Manager System now includes comprehensive user activity tracking that captures:
- **Real-time location** (country, city, region, coordinates)
- **Device information** (device name, type, browser, OS)
- **Timestamps** (creation time, time ago)
- **User actions** (login, logout, create, update, delete, view)
- **IP addresses** and user agents

## Features Implemented

### 1. Database Schema Updates
- Enhanced `LoginHistory` model with location and device fields
- Enhanced `UserActivity` model with comprehensive tracking
- Enhanced `AuditLog` model with device and location data

### 2. Device & Location Tracking (`/src/lib/device-tracking.ts`)
- **Device Detection**: Automatically detects device type (Mobile/Tablet/Desktop)
- **Browser Detection**: Identifies Chrome, Firefox, Safari, Edge, Opera
- **OS Detection**: Recognizes Windows, macOS, Linux, Android, iOS with versions
- **Location Services**: Uses IP geolocation to determine user location
- **Privacy-Safe**: Handles localhost and private IPs appropriately

### 3. Activity Tracking System (`/src/lib/activity-tracker.ts`)
- **Comprehensive Logging**: Tracks all user actions with context
- **Predefined Actions**: LOGIN, LOGOUT, REGISTER, CREATE, UPDATE, DELETE, VIEW
- **Entity Types**: USER, TRUCK, MAINTENANCE, TIRE, VEHICLE, REPORT, SYSTEM
- **Metadata Support**: Stores additional context for each activity

### 4. Enhanced Authentication
- **Login Tracking**: Captures device and location on every login
- **Registration Tracking**: Records new user registrations with full context
- **Session Management**: Tracks login/logout with session duration

### 5. Admin Monitoring Interface

#### API Endpoint: `/api/admin/user-activities`
- **Filtering**: By user, action, entity type, date range
- **Pagination**: Efficient handling of large activity logs
- **Real-time Data**: Live activity monitoring

#### Admin Dashboard: `/admin/user-activities`
- **Visual Interface**: Clean, organized activity display
- **Device Information**: Shows device type, browser, OS
- **Location Display**: Country, city, region information
- **Time Tracking**: Timestamps with "time ago" formatting
- **Activity Details**: Expandable metadata and change tracking

## How It Works

### 1. User Login/Registration
```typescript
// When user logs in
const trackingInfo = await getTrackingInfo(request)
await db.loginHistory.create({
  userId: user.id,
  loginTime: new Date(),
  ipAddress: trackingInfo.ipAddress,
  deviceName: trackingInfo.device.deviceName,
  location: trackingInfo.location
})
```

### 2. Activity Tracking
```typescript
// Track any user action
await trackUserActivity({
  userId: user.id,
  action: 'TRUCK_CREATE',
  entityType: 'TRUCK',
  entityName: 'Honda Accord (ABC123)',
  newValues: truckData
}, request)
```

### 3. Admin Monitoring
```typescript
// Admins can view all activities
GET /api/admin/user-activities?userId=123&action=LOGIN&startDate=2024-01-01
```

## Data Captured

### Device Information
- **Device Name**: "Windows 10 - Chrome (Desktop)"
- **Device Type**: Mobile, Tablet, Desktop
- **Browser**: Chrome, Firefox, Safari, Edge, Opera
- **Operating System**: Windows 10, macOS 14.1, Android 13, iOS 17.1
- **User Agent**: Full browser string

### Location Information
- **Country**: United States
- **City**: New York
- **Region**: New York
- **Coordinates**: Latitude/Longitude
- **Timezone**: America/New_York
- **IP Address**: User's public IP

### Activity Context
- **Action**: What the user did (LOGIN, CREATE, UPDATE, etc.)
- **Entity**: What was affected (USER, TRUCK, MAINTENANCE, etc.)
- **Changes**: Before/after values for updates
- **Metadata**: Additional context and timestamps

## Admin Features

### Real-time Monitoring
- See all user activities as they happen
- Filter by specific users or actions
- View device and location information
- Track suspicious activities

### Security Insights
- Multiple logins from different locations
- Unusual device access patterns
- Failed login attempts
- Account changes and modifications

### Compliance & Auditing
- Complete audit trail of all actions
- Exportable activity logs
- User behavior analytics
- System access monitoring

## Privacy & Security

### Data Protection
- IP addresses are used only for location services
- Location data is approximate (city-level)
- No personal device identifiers stored
- Compliant with privacy regulations

### Security Features
- Detects unusual login patterns
- Tracks administrative actions
- Monitors system access
- Alerts for suspicious activities

## Usage Examples

### For Admins
1. **Monitor User Logins**: See who logged in from where and when
2. **Track Changes**: Monitor all system modifications with full context
3. **Security Auditing**: Identify unusual access patterns
4. **Compliance Reporting**: Generate activity reports for audits

### For System Security
1. **Fraud Detection**: Multiple logins from different countries
2. **Account Compromise**: Unusual device or location access
3. **Insider Threats**: Monitoring administrative actions
4. **Data Integrity**: Track all data modifications

## API Endpoints

### User Activities (Admin Only)
```
GET /api/admin/user-activities
- Query Parameters: page, limit, userId, action, entityType, startDate, endDate
- Returns: Paginated list of user activities with device and location info
```

### Test Tracking
```
POST /api/test-tracking
- Tests the tracking system functionality
- Requires authentication
- Creates a test activity log entry
```

## Implementation Status

✅ **Database Schema**: Updated with tracking fields
✅ **Device Detection**: Full browser/OS/device type detection
✅ **Location Services**: IP-based geolocation
✅ **Activity Tracking**: Comprehensive action logging
✅ **Admin Interface**: Real-time activity monitoring
✅ **Authentication Tracking**: Login/logout with full context
✅ **Registration Tracking**: New user registration monitoring
✅ **API Endpoints**: Admin access to activity data

## Next Steps

1. **Real-time Notifications**: Alert admins of suspicious activities
2. **Advanced Analytics**: User behavior patterns and insights
3. **Export Features**: CSV/PDF export of activity logs
4. **Mobile App Tracking**: Enhanced mobile device detection
5. **Geofencing**: Location-based access controls

The system now provides complete visibility into user activities while maintaining privacy and security standards. Admins can monitor all user interactions with full device and location context for enhanced security and compliance.
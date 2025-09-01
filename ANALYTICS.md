# Vercel Analytics & Speed Insights Setup

This Fleet Manager System includes Vercel Analytics and Speed Insights for comprehensive performance monitoring and user behavior tracking.

## 🚀 Features Enabled

### Vercel Analytics
- **User Behavior Tracking**: Track page views, user interactions, and custom events
- **Real-time Data**: Monitor user activity in real-time
- **Custom Events**: Track fleet-specific actions like truck additions, maintenance scheduling
- **Conversion Tracking**: Monitor key business metrics

### Speed Insights
- **Core Web Vitals**: Monitor LCP, FID, CLS, and other performance metrics
- **Real User Monitoring**: Track actual user experience data
- **Performance Alerts**: Get notified of performance regressions
- **Optimization Insights**: Receive recommendations for performance improvements

## 📊 Custom Analytics Events

The system tracks the following custom events:

- `truck_added` - When a new truck is added to the fleet
- `maintenance_scheduled` - When maintenance is scheduled
- `tire_added` - When tires are added to inventory
- `report_generated` - When reports are generated
- `user_login` - User authentication events
- `dashboard_viewed` - Dashboard page views
- `email_sent` - Email notifications sent

## 🔧 Configuration

### Environment Variables
```env
# Optional: Custom Analytics ID
NEXT_PUBLIC_VERCEL_ANALYTICS_ID="your-vercel-analytics-id"
VERCEL_ANALYTICS_ID="your-vercel-analytics-id"
```

### Vercel.json Configuration
```json
{
  "analytics": {
    "enable": true
  },
  "speedInsights": {
    "enable": true
  }
}
```

## 📈 Usage

### Automatic Tracking
Analytics and Speed Insights are automatically enabled for all pages through the root layout.

### Custom Event Tracking
```typescript
import { analytics } from '@/lib/analytics';

// Track truck addition
analytics.trackTruckAdded({
  make: 'Ford',
  model: 'F-150',
  year: 2024
});

// Track maintenance scheduling
analytics.trackMaintenanceScheduled({
  serviceType: 'Oil Change',
  cost: 150
});
```

## 🎯 Key Metrics Monitored

### Performance Metrics
- **Largest Contentful Paint (LCP)**: Loading performance
- **First Input Delay (FID)**: Interactivity
- **Cumulative Layout Shift (CLS)**: Visual stability
- **First Contentful Paint (FCP)**: Perceived loading speed

### Business Metrics
- Fleet management operations
- User engagement patterns
- Report generation frequency
- Maintenance scheduling trends
- System usage analytics

## 📱 Dashboard Access

### Vercel Analytics Dashboard
1. Go to your Vercel project dashboard
2. Click on the "Analytics" tab
3. View real-time and historical data

### Speed Insights Dashboard
1. Go to your Vercel project dashboard
2. Click on the "Speed Insights" tab
3. Monitor Core Web Vitals and performance trends

## 🔍 Monitoring & Alerts

### Performance Alerts
- Automatic alerts for Core Web Vitals regressions
- Email notifications for performance issues
- Real-time monitoring of user experience

### Custom Alerts
Set up custom alerts for:
- High error rates
- Slow page load times
- Unusual traffic patterns
- Business metric thresholds

## 🛠️ Troubleshooting

### Analytics Not Showing Data
1. Verify analytics are enabled in vercel.json
2. Check environment variables
3. Ensure proper deployment to Vercel
4. Wait 24-48 hours for initial data collection

### Speed Insights Issues
1. Confirm Speed Insights component is in layout
2. Check browser console for errors
3. Verify Vercel deployment status
4. Test with different browsers/devices

## 📚 Resources

- [Vercel Analytics Documentation](https://vercel.com/docs/analytics)
- [Speed Insights Documentation](https://vercel.com/docs/speed-insights)
- [Core Web Vitals Guide](https://web.dev/vitals/)
- [Custom Events Tracking](https://vercel.com/docs/analytics/custom-events)
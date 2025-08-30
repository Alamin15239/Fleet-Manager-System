'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'en' | 'ar'

interface LanguageContextType {
  language: Language
  toggleLanguage: () => void
  t: (key: string) => string
}

const translations = {
  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.trucks': 'Trucks',
    'nav.maintenance': 'Maintenance',
    'nav.mechanics': 'Mechanics',
    'nav.tireManagement': 'Tire Management',
    'nav.analytics': 'Advanced Analytics',
    'nav.reports': 'Reports',
    'nav.editor': 'Document Editor',
    'nav.users': 'Users',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',
    'nav.admin': 'Admin',
    'nav.logout': 'Logout',
    
    // Dashboard
    'dashboard.title': 'Fleet Maintenance Dashboard',
    'dashboard.subtitle': 'Monitor and manage your truck fleet maintenance',
    'dashboard.totalTrucks': 'Total Trucks',
    'dashboard.activeTrucks': 'active vehicles',
    'dashboard.upcomingMaintenance': 'Upcoming Maintenance',
    'dashboard.dueWithin30Days': 'Due within 30 days',
    'dashboard.overdueRepairs': 'Overdue Repairs',
    'dashboard.requireAttention': 'Require immediate attention',
    'dashboard.monthlyMaintenanceCost': 'Monthly Maintenance Cost',
    'dashboard.averageMonthlyCost': 'Average monthly cost',
    'dashboard.totalCost6mo': 'Total Cost (6mo)',
    'dashboard.last6Months': 'Last 6 months',
    'dashboard.noDataAvailable': 'No Data Available',
    'dashboard.addFirstTruck': 'Add Your First Truck',
    'dashboard.recentTrucks': 'Recent Trucks',
    'dashboard.recentMaintenance': 'Recent Maintenance',
    
    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.cost': 'Cost',
    'common.total': 'Total',
    'common.active': 'Active',
    'common.inactive': 'Inactive',
    'common.maintenance': 'Maintenance',
    
    // Login/Auth
    'auth.login': 'Login',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgotPassword': 'Forgot Password?',
    'auth.signIn': 'Sign In',
    'auth.welcome': 'Welcome Back',
    'auth.loginSubtitle': 'Sign in to your account to continue',
    
    // Trucks
    'trucks.title': 'Fleet Management',
    'trucks.subtitle': 'Manage your truck fleet',
    'trucks.addTruck': 'Add Truck',
    'trucks.vin': 'VIN',
    'trucks.make': 'Make',
    'trucks.model': 'Model',
    'trucks.year': 'Year',
    'trucks.licensePlate': 'License Plate',
    'trucks.mileage': 'Mileage',
    
    // Maintenance
    'maintenance.title': 'Maintenance Records',
    'maintenance.subtitle': 'Track and manage maintenance activities',
    'maintenance.addRecord': 'Add Maintenance Record',
    'maintenance.serviceType': 'Service Type',
    'maintenance.description': 'Description',
    'maintenance.datePerformed': 'Date Performed',
    'maintenance.partsCost': 'Parts Cost',
    'maintenance.laborCost': 'Labor Cost',
    'maintenance.totalCost': 'Total Cost',
    
    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Configure your application preferences',
    'settings.general': 'General',
    'settings.notifications': 'Notifications',
    'settings.maintenance': 'Maintenance',
    'settings.permissions': 'Permissions',
    
    // Profile
    'profile.title': 'Profile',
    'profile.subtitle': 'Manage your account information',
    'profile.name': 'Name',
    'profile.phone': 'Phone',
    'profile.department': 'Department',
    'profile.title': 'Title',
    'profile.bio': 'Bio',
    'profile.updateProfile': 'Update Profile',
    
    // Users
    'users.title': 'User Management',
    'users.subtitle': 'Manage system users and permissions',
    'users.addUser': 'Add User',
    'users.role': 'Role',
    'users.approved': 'Approved',
    'users.emailVerified': 'Email Verified',
    
    // All Pages
    'admin.title': 'Admin Dashboard',
    'admin.subtitle': 'System administration and monitoring',
    'admin.activity': 'Activity Logs',
    'admin.monitoring': 'System Monitoring',
    'analytics.title': 'Advanced Analytics',
    'analytics.subtitle': 'Fleet performance insights and trends',
    'documents.title': 'Document Management',
    'documents.subtitle': 'Manage fleet documents and files',
    'editor.title': 'Document Editor',
    'editor.subtitle': 'Create and edit documents',
    'mechanics.title': 'Mechanics Management',
    'mechanics.subtitle': 'Manage mechanics and technicians',
    'tires.title': 'Tire Management',
    'tires.subtitle': 'Track tire inventory and distribution',
    'reports.title': 'Reports',
    'reports.subtitle': 'Generate fleet reports and analytics',
    'signup.title': 'Create Account',
    'signup.subtitle': 'Join the fleet management system',
    'forgotPassword.title': 'Forgot Password',
    'forgotPassword.subtitle': 'Reset your account password',
    'resetPassword.title': 'Reset Password',
    'resetPassword.subtitle': 'Enter your new password',
    'verifyEmail.title': 'Verify Email',
    'verifyEmail.subtitle': 'Confirm your email address',
    'pendingApproval.title': 'Pending Approval',
    'pendingApproval.subtitle': 'Your account is awaiting admin approval',
  },
  ar: {
    // Navigation
    'nav.dashboard': 'لوحة التحكم',
    'nav.trucks': 'الشاحنات',
    'nav.maintenance': 'الصيانة',
    'nav.mechanics': 'الميكانيكيين',
    'nav.tireManagement': 'إدارة الإطارات',
    'nav.analytics': 'التحليلات المتقدمة',
    'nav.reports': 'التقارير',
    'nav.editor': 'محرر المستندات',
    'nav.users': 'المستخدمين',
    'nav.profile': 'الملف الشخصي',
    'nav.settings': 'الإعدادات',
    'nav.admin': 'المدير',
    'nav.logout': 'تسجيل الخروج',
    
    // Dashboard
    'dashboard.title': 'لوحة تحكم صيانة الأسطول',
    'dashboard.subtitle': 'راقب وأدر صيانة أسطول الشاحنات الخاص بك',
    'dashboard.totalTrucks': 'إجمالي الشاحنات',
    'dashboard.activeTrucks': 'مركبات نشطة',
    'dashboard.upcomingMaintenance': 'الصيانة القادمة',
    'dashboard.dueWithin30Days': 'مستحقة خلال 30 يوماً',
    'dashboard.overdueRepairs': 'الإصلاحات المتأخرة',
    'dashboard.requireAttention': 'تتطلب اهتماماً فورياً',
    'dashboard.monthlyMaintenanceCost': 'تكلفة الصيانة الشهرية',
    'dashboard.averageMonthlyCost': 'متوسط التكلفة الشهرية',
    'dashboard.totalCost6mo': 'التكلفة الإجمالية (6 أشهر)',
    'dashboard.last6Months': 'آخر 6 أشهر',
    'dashboard.noDataAvailable': 'لا توجد بيانات متاحة',
    'dashboard.addFirstTruck': 'أضف شاحنتك الأولى',
    'dashboard.recentTrucks': 'الشاحنات الحديثة',
    'dashboard.recentMaintenance': 'الصيانة الحديثة',
    
    // Common
    'common.loading': 'جاري التحميل...',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.add': 'إضافة',
    'common.search': 'بحث',
    'common.filter': 'تصفية',
    'common.export': 'تصدير',
    'common.import': 'استيراد',
    'common.status': 'الحالة',
    'common.date': 'التاريخ',
    'common.cost': 'التكلفة',
    'common.total': 'المجموع',
    'common.active': 'نشط',
    'common.inactive': 'غير نشط',
    'common.maintenance': 'صيانة',
    
    // Login/Auth
    'auth.login': 'تسجيل الدخول',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.forgotPassword': 'نسيت كلمة المرور؟',
    'auth.signIn': 'تسجيل الدخول',
    'auth.welcome': 'مرحباً بعودتك',
    'auth.loginSubtitle': 'سجل دخولك إلى حسابك للمتابعة',
    
    // Trucks
    'trucks.title': 'إدارة الأسطول',
    'trucks.subtitle': 'إدارة أسطول الشاحنات الخاص بك',
    'trucks.addTruck': 'إضافة شاحنة',
    'trucks.vin': 'رقم الهيكل',
    'trucks.make': 'الصانع',
    'trucks.model': 'الطراز',
    'trucks.year': 'السنة',
    'trucks.licensePlate': 'رقم اللوحة',
    'trucks.mileage': 'المسافة المقطوعة',
    
    // Maintenance
    'maintenance.title': 'سجلات الصيانة',
    'maintenance.subtitle': 'تتبع وإدارة أنشطة الصيانة',
    'maintenance.addRecord': 'إضافة سجل صيانة',
    'maintenance.serviceType': 'نوع الخدمة',
    'maintenance.description': 'الوصف',
    'maintenance.datePerformed': 'تاريخ التنفيذ',
    'maintenance.partsCost': 'تكلفة القطع',
    'maintenance.laborCost': 'تكلفة العمالة',
    'maintenance.totalCost': 'التكلفة الإجمالية',
    
    // Settings
    'settings.title': 'الإعدادات',
    'settings.subtitle': 'تكوين تفضيلات التطبيق الخاص بك',
    'settings.general': 'عام',
    'settings.notifications': 'الإشعارات',
    'settings.maintenance': 'الصيانة',
    'settings.permissions': 'الصلاحيات',
    
    // Profile
    'profile.title': 'الملف الشخصي',
    'profile.subtitle': 'إدارة معلومات حسابك',
    'profile.name': 'الاسم',
    'profile.phone': 'الهاتف',
    'profile.department': 'القسم',
    'profile.title': 'المسمى الوظيفي',
    'profile.bio': 'النبذة الشخصية',
    'profile.updateProfile': 'تحديث الملف الشخصي',
    
    // Users
    'users.title': 'إدارة المستخدمين',
    'users.subtitle': 'إدارة مستخدمي النظام والصلاحيات',
    'users.addUser': 'إضافة مستخدم',
    'users.role': 'الدور',
    'users.approved': 'موافق عليه',
    'users.emailVerified': 'البريد الإلكتروني مُتحقق منه',
    
    // All Pages
    'admin.title': 'لوحة تحكم المدير',
    'admin.subtitle': 'إدارة النظام والمراقبة',
    'admin.activity': 'سجلات النشاط',
    'admin.monitoring': 'مراقبة النظام',
    'analytics.title': 'التحليلات المتقدمة',
    'analytics.subtitle': 'رؤى أداء الأسطول والاتجاهات',
    'documents.title': 'إدارة المستندات',
    'documents.subtitle': 'إدارة مستندات وملفات الأسطول',
    'editor.title': 'محرر المستندات',
    'editor.subtitle': 'إنشاء وتحرير المستندات',
    'mechanics.title': 'إدارة الميكانيكيين',
    'mechanics.subtitle': 'إدارة الميكانيكيين والفنيين',
    'tires.title': 'إدارة الإطارات',
    'tires.subtitle': 'تتبع مخزون الإطارات والتوزيع',
    'reports.title': 'التقارير',
    'reports.subtitle': 'إنشاء تقارير الأسطول والتحليلات',
    'signup.title': 'إنشاء حساب',
    'signup.subtitle': 'انضم إلى نظام إدارة الأسطول',
    'forgotPassword.title': 'نسيت كلمة المرور',
    'forgotPassword.subtitle': 'إعادة تعيين كلمة مرور حسابك',
    'resetPassword.title': 'إعادة تعيين كلمة المرور',
    'resetPassword.subtitle': 'أدخل كلمة المرور الجديدة',
    'verifyEmail.title': 'تحقق من البريد الإلكتروني',
    'verifyEmail.subtitle': 'تأكيد عنوان بريدك الإلكتروني',
    'pendingApproval.title': 'في انتظار الموافقة',
    'pendingApproval.subtitle': 'حسابك في انتظار موافقة المدير',
  }
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')

  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') as Language
    if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'ar')) {
      setLanguage(savedLanguage)
      document.documentElement.lang = savedLanguage
      document.documentElement.dir = savedLanguage === 'ar' ? 'rtl' : 'ltr'
    }
  }, [])

  const toggleLanguage = () => {
    const newLanguage = language === 'en' ? 'ar' : 'en'
    setLanguage(newLanguage)
    localStorage.setItem('language', newLanguage)
    document.documentElement.lang = newLanguage
    document.documentElement.dir = newLanguage === 'ar' ? 'rtl' : 'ltr'
  }

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key
  }

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
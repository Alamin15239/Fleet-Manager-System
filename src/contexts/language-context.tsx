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
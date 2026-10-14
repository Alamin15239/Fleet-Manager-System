'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, FileText, List, Plus, Settings } from 'lucide-react'
import TireManagementForm from '@/components/tire-management-form'
import TireInventoryGrouped from '@/components/tire-inventory-grouped'
import TireReports from '@/components/tire-reports'
import TireReportsSimple from '@/components/tire-reports-simple'
import TireExcelViewer from '@/components/tire-excel-viewer'
import { useLanguage } from '@/contexts/language-context'

export default function TireManagementPage() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('form')

  return (
    <div className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('tires.title')}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t('tires.subtitle')}</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-5">
          <TabsTrigger value="form" className="flex min-h-[60px] flex-col items-center gap-1 p-1.5 text-xs">
            <Plus className="h-4 w-4" />
            <span className="leading-tight">Add</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex min-h-[60px] flex-col items-center gap-1 p-1.5 text-xs">
            <List className="h-4 w-4" />
            <span className="leading-tight">List</span>
          </TabsTrigger>
          <TabsTrigger value="excel" className="flex min-h-[60px] flex-col items-center gap-1 p-1.5 text-xs">
            <FileText className="h-4 w-4" />
            <span className="leading-tight">Excel</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex min-h-[60px] flex-col items-center gap-1 p-1.5 text-xs">
            <BarChart3 className="h-4 w-4" />
            <span className="leading-tight">Stats</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex min-h-[60px] flex-col items-center gap-1 p-1.5 text-xs">
            <Settings className="h-4 w-4" />
            <span className="leading-tight">Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-4">
          <TireManagementForm />
        </TabsContent>
        <TabsContent value="inventory" className="space-y-4">
          <TireInventoryGrouped />
        </TabsContent>
        <TabsContent value="excel" className="space-y-4">
          <TireExcelViewer />
        </TabsContent>
        <TabsContent value="analytics" className="space-y-4">
          <TireReports />
        </TabsContent>
        <TabsContent value="reports" className="space-y-4">
          <TireReportsSimple />
        </TabsContent>
      </Tabs>
    </div>
  )
}

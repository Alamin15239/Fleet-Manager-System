'use client'
import { LocalizedText } from '@/components/localized-text'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, FileText, List, Loader2, Plus, Settings } from 'lucide-react'
import { useLanguage } from '@/contexts/language-context'
import { usePermissions } from '@/contexts/permissions-context'

const TabContentLoading = () => <div role="status" className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border bg-muted/30 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><LocalizedText>Loading...</LocalizedText></div>
const TireManagementForm = dynamic(() => import('@/components/tire-management-form'), { loading: TabContentLoading })
const TireInventoryGrouped = dynamic(() => import('@/components/tire-inventory-grouped'), { loading: TabContentLoading })
const TireReports = dynamic(() => import('@/components/tire-reports'), { loading: TabContentLoading })
const TireReportsSimple = dynamic(() => import('@/components/tire-reports-simple'), { loading: TabContentLoading })
const TireExcelViewer = dynamic(() => import('@/components/tire-excel-viewer'), { loading: TabContentLoading })

export default function TireManagementPage() {
  const { t } = useLanguage()
  const { canCreate, loading: permissionsLoading } = usePermissions()
  const [activeTab, setActiveTab] = useState('form')
  const canAddTires = canCreate('tire-management')

  useEffect(() => {
    if (!permissionsLoading && !canAddTires && activeTab === 'form') setActiveTab('inventory')
  }, [permissionsLoading, canAddTires, activeTab])

  return (
    <div className="container mx-auto space-y-4 p-4 sm:space-y-6 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('tires.title')}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t('tires.subtitle')}</p>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className={`grid h-auto w-full grid-cols-2 gap-1 p-1 ${canAddTires ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
          {canAddTires && <TabsTrigger value="form" className="flex min-h-[60px] flex-col items-center gap-1 p-1.5 text-xs">
            <Plus className="h-4 w-4" />
            <span className="leading-tight"><LocalizedText>Add</LocalizedText></span>
          </TabsTrigger>}
          <TabsTrigger value="inventory" className="flex min-h-[60px] flex-col items-center gap-1 p-1.5 text-xs">
            <List className="h-4 w-4" />
            <span className="leading-tight"><LocalizedText>List</LocalizedText></span>
          </TabsTrigger>
          <TabsTrigger value="excel" className="flex min-h-[60px] flex-col items-center gap-1 p-1.5 text-xs">
            <FileText className="h-4 w-4" />
            <span className="leading-tight"><LocalizedText>Excel</LocalizedText></span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex min-h-[60px] flex-col items-center gap-1 p-1.5 text-xs">
            <BarChart3 className="h-4 w-4" />
            <span className="leading-tight"><LocalizedText>Stats</LocalizedText></span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex min-h-[60px] flex-col items-center gap-1 p-1.5 text-xs">
            <Settings className="h-4 w-4" />
            <span className="leading-tight"><LocalizedText>Reports</LocalizedText></span>
          </TabsTrigger>
        </TabsList>

        {canAddTires && <TabsContent value="form" className="space-y-4">
          <TireManagementForm />
        </TabsContent>}
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

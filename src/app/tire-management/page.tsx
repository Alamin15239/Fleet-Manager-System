'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  List, 
  BarChart3, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Database,
  Settings,
  FileText,
  Truck,
  Users
} from 'lucide-react'
import TireManagementForm from '@/components/tire-management-form'
import TireInventoryList from '@/components/tire-inventory-list'
import TireReports from '@/components/tire-reports'
import VehicleManagement from '@/components/vehicle-management'
import ProfessionalReportGenerator from '@/components/professional-report-generator'
import { useLanguage } from '@/contexts/language-context'

interface InitializationStatus {
  initialized: boolean
  count: number
  vehicles: Array<{
    plateNumber: string
    trailerNumber: string | null
    driverName: string | null
  }>
}

export default function TireManagementPage() {
  const { t } = useLanguage()
  const [activeTab, setActiveTab] = useState('form')
  const [initializationStatus, setInitializationStatus] = useState<InitializationStatus | null>(null)
  const [initializing, setInitializing] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [initSuccess, setInitSuccess] = useState<string | null>(null)

  useEffect(() => {
    checkInitializationStatus()
  }, [])

  const checkInitializationStatus = async () => {
    try {
      const response = await fetch('/api/vehicles/initialize')
      if (response.ok) {
        const data = await response.json()
        setInitializationStatus(data)
      }
    } catch (error) {
      console.error('Error checking initialization status:', error)
    }
  }

  const initializeVehicles = async () => {
    setInitializing(true)
    setInitError(null)
    setInitSuccess(null)

    try {
      const response = await fetch('/api/vehicles/initialize', {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        setInitSuccess(data.message)
        checkInitializationStatus()
      } else {
        const errorData = await response.json()
        setInitError(errorData.error || 'Failed to initialize vehicles')
      }
    } catch (error) {
      console.error('Error initializing vehicles:', error)
      setInitError('Failed to initialize vehicles')
    } finally {
      setInitializing(false)
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('tires.title')}</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {t('tires.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {initializationStatus && (
            <Badge variant={initializationStatus.initialized ? "default" : "secondary"} className="text-xs">
              {initializationStatus.initialized ? `${initializationStatus.count} Vehicles` : "Not Initialized"}
            </Badge>
          )}
        </div>
      </div>

      {/* Initialization Alert */}
      {initializationStatus && !initializationStatus.initialized && (
        <Alert className="border-orange-200 bg-orange-50">
          <Database className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-700">
            <div className="flex items-center justify-between">
              <span>
                Vehicle data needs to be initialized. This will load the driver-vehicle mappings into the system.
              </span>
              <Button 
                onClick={initializeVehicles} 
                disabled={initializing}
                size="sm"
                className="ml-4"
              >
                {initializing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Database className="mr-2 h-4 w-4" />
                    Initialize Data
                  </>
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {initError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{initError}</AlertDescription>
        </Alert>
      )}

      {initSuccess && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{initSuccess}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 h-auto p-1">
          <TabsTrigger value="form" className="flex flex-col items-center gap-1 text-xs p-1.5 min-h-[60px]">
            <Plus className="h-4 w-4" />
            <span className="leading-tight">Add</span>
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex flex-col items-center gap-1 text-xs p-1.5 min-h-[60px]">
            <List className="h-4 w-4" />
            <span className="leading-tight">List</span>
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex flex-col items-center gap-1 text-xs p-1.5 min-h-[60px]">
            <Truck className="h-4 w-4" />
            <span className="leading-tight">Cars</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex flex-col items-center gap-1 text-xs p-1.5 min-h-[60px]">
            <BarChart3 className="h-4 w-4" />
            <span className="leading-tight">Stats</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex flex-col items-center gap-1 text-xs p-1.5 min-h-[60px]">
            <FileText className="h-4 w-4" />
            <span className="leading-tight">Reports</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="form" className="space-y-4">
          <TireManagementForm />
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <TireInventoryList />
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-4">
          <VehicleManagement />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <TireReports />
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <ProfessionalReportGenerator />
        </TabsContent>
      </Tabs>
    </div>
  )
}
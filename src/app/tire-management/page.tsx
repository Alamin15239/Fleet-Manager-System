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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tire Management System</h1>
          <p className="text-muted-foreground">
            Comprehensive tire distribution and tracking system
          </p>
        </div>
        <div className="flex items-center gap-2">
          {initializationStatus && (
            <Badge variant={initializationStatus.initialized ? "default" : "secondary"}>
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="form" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Tires
          </TabsTrigger>
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Vehicles
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reports
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
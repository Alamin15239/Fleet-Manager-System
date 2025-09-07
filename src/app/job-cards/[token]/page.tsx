'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'
import { FileText, Printer, Calendar, User, Wrench, DollarSign, Clock } from 'lucide-react'
import { toast } from 'sonner'

interface JobCard {
  id: string
  jobCardNo: string
  status: string
  vehicleType: string
  vehicleName: string
  vehicleIdentifier: string
  driverName?: string
  mechanicName?: string
  reportedIssues?: string
  requestedWork?: string
  tasks: any[]
  parts: any[]
  totalCost: number
  odometer?: number
  engineHours?: number
  printCount: number
  printedAt?: string
  createdAt: string
  updatedAt: string
  maintenanceRecord?: any
  trailerMaintenanceRecord?: any
}

export default function JobCardViewPage() {
  const params = useParams()
  const token = params.token as string
  const [jobCard, setJobCard] = useState<JobCard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (token) {
      fetchJobCard()
    }
  }, [token])

  const fetchJobCard = async () => {
    try {
      const response = await fetch(`/api/job-cards/by-token/${token}`)
      if (response.ok) {
        const data = await response.json()
        setJobCard(data.data)
      } else if (response.status === 404) {
        setError('Job card not found')
      } else {
        setError('Failed to load job card')
      }
    } catch (error) {
      console.error('Error fetching job card:', error)
      setError('Failed to load job card')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = async () => {
    if (!jobCard) return

    try {
      const response = await fetch('/api/job-cards/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobCardId: jobCard.id
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `job-card-${jobCard.jobCardNo}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Job card printed successfully')
        
        // Refresh job card data to update print count
        fetchJobCard()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to print job card')
      }
    } catch (error) {
      console.error('Error printing job card:', error)
      toast.error('Failed to print job card')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'ACTIVE': return 'bg-blue-100 text-blue-800'
      case 'DRAFT': return 'bg-yellow-100 text-yellow-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in-progress': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Job Card Not Found</h2>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!jobCard) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="text-center py-12">
            <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Job Card Not Found</h2>
            <p className="text-gray-600">The requested job card could not be found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <FileText className="h-8 w-8" />
            Job Card {jobCard.jobCardNo}
          </h1>
          <p className="text-gray-600 mt-1">
            Created on {format(new Date(jobCard.createdAt), 'MMMM dd, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`text-sm ${getStatusColor(jobCard.status)}`}>
            {jobCard.status}
          </Badge>
          <Button onClick={handlePrint} className="bg-green-600 hover:bg-green-700">
            <Printer className="h-4 w-4 mr-2" />
            Print Job Card
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicle Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="text-2xl">{jobCard.vehicleType === 'truck' ? '🚛' : '🚚'}</div>
              Vehicle Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-gray-500">Vehicle</div>
              <div className="font-medium">{jobCard.vehicleName}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Registration/Number</div>
              <div className="font-medium">{jobCard.vehicleIdentifier}</div>
            </div>
            {jobCard.driverName && (
              <div>
                <div className="text-sm text-gray-500">Driver</div>
                <div className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {jobCard.driverName}
                </div>
              </div>
            )}
            {jobCard.odometer && (
              <div>
                <div className="text-sm text-gray-500">Odometer</div>
                <div className="font-medium">{jobCard.odometer.toLocaleString()} km</div>
              </div>
            )}
            {jobCard.engineHours && (
              <div>
                <div className="text-sm text-gray-500">Engine Hours</div>
                <div className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {jobCard.engineHours} hrs
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Service Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Service Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobCard.mechanicName && (
              <div>
                <div className="text-sm text-gray-500">Assigned Mechanic</div>
                <div className="font-medium">{jobCard.mechanicName}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-gray-500">Total Cost</div>
              <div className="font-bold text-lg text-green-600 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                ${jobCard.totalCost.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Print History</div>
              <div className="font-medium">
                Printed {jobCard.printCount} time{jobCard.printCount !== 1 ? 's' : ''}
                {jobCard.printedAt && (
                  <div className="text-sm text-gray-500">
                    Last printed: {format(new Date(jobCard.printedAt), 'MMM dd, yyyy HH:mm')}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{jobCard.tasks?.length || 0}</div>
                <div className="text-sm text-gray-500">Tasks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{jobCard.parts?.length || 0}</div>
                <div className="text-sm text-gray-500">Parts</div>
              </div>
            </div>
            <Separator />
            <div>
              <div className="text-sm text-gray-500">Last Updated</div>
              <div className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {format(new Date(jobCard.updatedAt), 'MMM dd, yyyy HH:mm')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues and Work */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {jobCard.reportedIssues && (
          <Card>
            <CardHeader>
              <CardTitle>Reported Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-200">
                <p className="text-gray-800">{jobCard.reportedIssues}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {jobCard.requestedWork && (
          <Card>
            <CardHeader>
              <CardTitle>Requested Work</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-200">
                <p className="text-gray-800">{jobCard.requestedWork}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tasks */}
      {jobCard.tasks && jobCard.tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {jobCard.tasks.map((task, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{task.description}</div>
                    {task.notes && (
                      <div className="text-sm text-gray-600 mt-1">{task.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-xs ${getTaskStatusColor(task.status)}`}>
                      {task.status?.replace('-', ' ') || 'pending'}
                    </Badge>
                    {task.timeHours > 0 && (
                      <div className="text-sm text-gray-500">{task.timeHours}h</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parts */}
      {jobCard.parts && jobCard.parts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Parts Used</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Part Name</th>
                    <th className="text-left py-2">Part Number</th>
                    <th className="text-right py-2">Quantity</th>
                    <th className="text-right py-2">Unit Cost</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {jobCard.parts.map((part, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 font-medium">{part.name}</td>
                      <td className="py-2 text-gray-600">{part.partNumber || 'N/A'}</td>
                      <td className="py-2 text-right">{part.quantity}</td>
                      <td className="py-2 text-right">${part.unitCost?.toFixed(2) || '0.00'}</td>
                      <td className="py-2 text-right font-medium">
                        ${((part.quantity || 0) * (part.unitCost || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td colSpan={4} className="py-2 text-right">Total Cost:</td>
                    <td className="py-2 text-right text-green-600">
                      ${jobCard.totalCost.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
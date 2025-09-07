'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, FileText, Printer, Save } from 'lucide-react'
import { toast } from 'sonner'
import { apiPost, apiPut } from '@/lib/api'

interface Task {
  id?: string
  description: string
  status: 'pending' | 'in-progress' | 'completed'
  timeHours: number
  notes: string
}

interface Part {
  id?: string
  name: string
  partNumber: string
  quantity: number
  unitCost: number
}

interface JobCardData {
  id?: string
  jobCardNo?: string
  maintenanceRecordId?: string
  trailerMaintenanceRecordId?: string
  vehicleType: string
  vehicleId: string
  vehicleName: string
  vehicleIdentifier: string
  driverName?: string
  mechanicId?: string
  mechanicName?: string
  reportedIssues?: string
  requestedWork?: string
  tasks: Task[]
  parts: Part[]
  totalCost: number
  odometer?: number
  engineHours?: number
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
}

interface JobCardPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  initialData?: Partial<JobCardData>
  onSave?: (jobCard: any) => void
}

export function JobCardPreviewModal({ isOpen, onClose, initialData, onSave }: JobCardPreviewModalProps) {
  const [jobCardData, setJobCardData] = useState<JobCardData>({
    vehicleType: 'truck',
    vehicleId: '',
    vehicleName: '',
    vehicleIdentifier: '',
    driverName: '',
    mechanicName: '',
    reportedIssues: '',
    requestedWork: '',
    tasks: [],
    parts: [],
    totalCost: 0,
    status: 'DRAFT'
  })
  
  const [loading, setLoading] = useState(false)
  const [newTask, setNewTask] = useState<Task>({
    description: '',
    status: 'pending',
    timeHours: 0,
    notes: ''
  })
  
  const [newPart, setNewPart] = useState<Part>({
    name: '',
    partNumber: '',
    quantity: 1,
    unitCost: 0
  })

  useEffect(() => {
    if (initialData) {
      setJobCardData(prev => ({
        ...prev,
        ...initialData,
        tasks: initialData.tasks || [],
        parts: initialData.parts || []
      }))
    }
  }, [initialData])

  useEffect(() => {
    // Calculate total cost from parts
    const partsTotal = jobCardData.parts.reduce((sum, part) => 
      sum + (part.quantity * part.unitCost), 0
    )
    setJobCardData(prev => ({ ...prev, totalCost: partsTotal }))
  }, [jobCardData.parts])

  const addTask = () => {
    if (!newTask.description.trim()) {
      toast.error('Task description is required')
      return
    }
    
    setJobCardData(prev => ({
      ...prev,
      tasks: [...prev.tasks, { ...newTask, id: Date.now().toString() }]
    }))
    
    setNewTask({
      description: '',
      status: 'pending',
      timeHours: 0,
      notes: ''
    })
  }

  const removeTask = (taskId: string) => {
    setJobCardData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(task => task.id !== taskId)
    }))
  }

  const addPart = () => {
    if (!newPart.name.trim()) {
      toast.error('Part name is required')
      return
    }
    
    setJobCardData(prev => ({
      ...prev,
      parts: [...prev.parts, { ...newPart, id: Date.now().toString() }]
    }))
    
    setNewPart({
      name: '',
      partNumber: '',
      quantity: 1,
      unitCost: 0
    })
  }

  const removePart = (partId: string) => {
    setJobCardData(prev => ({
      ...prev,
      parts: prev.parts.filter(part => part.id !== partId)
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      // Get current user ID
      let currentUserId = null
      try {
        const userResponse = await fetch('/api/auth/me')
        if (userResponse.ok) {
          const userData = await userResponse.json()
          currentUserId = userData.user?.id || userData.id
        }
      } catch (e) {
        console.error('Error getting current user:', e)
      }

      const payload = {
        ...jobCardData,
        createdById: currentUserId
      }

      const response = jobCardData.id 
        ? await apiPut(`/api/job-cards/${jobCardData.id}`, payload)
        : await apiPost('/api/job-cards', payload)

      if (response.ok) {
        const result = await response.json()
        toast.success(jobCardData.id ? 'Job card updated successfully' : 'Job card created successfully')
        onSave?.(result.data)
        onClose()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save job card')
      }
    } catch (error) {
      console.error('Error saving job card:', error)
      toast.error('Failed to save job card')
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = async () => {
    if (!jobCardData.id) {
      toast.error('Please save the job card first')
      return
    }

    setLoading(true)
    try {
      // Get current user ID
      let currentUserId = null
      try {
        const userResponse = await fetch('/api/auth/me')
        if (userResponse.ok) {
          const userData = await userResponse.json()
          currentUserId = userData.user?.id || userData.id
        }
      } catch (e) {
        console.error('Error getting current user:', e)
      }

      const response = await fetch('/api/job-cards/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobCardId: jobCardData.id,
          userId: currentUserId
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `job-card-${jobCardData.jobCardNo || 'new'}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Job card printed successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to print job card')
      }
    } catch (error) {
      console.error('Error printing job card:', error)
      toast.error('Failed to print job card')
    } finally {
      setLoading(false)
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {jobCardData.id ? 'Edit Job Card' : 'Create Job Card'}
            {jobCardData.jobCardNo && (
              <Badge variant="outline">{jobCardData.jobCardNo}</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Generate a professional job card for maintenance work
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Vehicle Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vehicle Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Vehicle Name</Label>
                  <Input
                    value={jobCardData.vehicleName}
                    onChange={(e) => setJobCardData(prev => ({ ...prev, vehicleName: e.target.value }))}
                    placeholder="e.g., 2020 Ford F-150"
                  />
                </div>
                <div>
                  <Label>Registration/Number</Label>
                  <Input
                    value={jobCardData.vehicleIdentifier}
                    onChange={(e) => setJobCardData(prev => ({ ...prev, vehicleIdentifier: e.target.value }))}
                    placeholder="License plate or trailer number"
                  />
                </div>
                <div>
                  <Label>Driver Name</Label>
                  <Input
                    value={jobCardData.driverName || ''}
                    onChange={(e) => setJobCardData(prev => ({ ...prev, driverName: e.target.value }))}
                    placeholder="Driver name"
                  />
                </div>
                <div>
                  <Label>Odometer (km)</Label>
                  <Input
                    type="number"
                    value={jobCardData.odometer || ''}
                    onChange={(e) => setJobCardData(prev => ({ ...prev, odometer: parseInt(e.target.value) || 0 }))}
                    placeholder="Current mileage"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Service Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Service Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Mechanic Name</Label>
                  <Input
                    value={jobCardData.mechanicName || ''}
                    onChange={(e) => setJobCardData(prev => ({ ...prev, mechanicName: e.target.value }))}
                    placeholder="Assigned mechanic"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select 
                    value={jobCardData.status} 
                    onValueChange={(value) => setJobCardData(prev => ({ ...prev, status: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Reported Issues</Label>
                <Textarea
                  value={jobCardData.reportedIssues || ''}
                  onChange={(e) => setJobCardData(prev => ({ ...prev, reportedIssues: e.target.value }))}
                  placeholder="Describe the reported issues..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Requested Work</Label>
                <Textarea
                  value={jobCardData.requestedWork || ''}
                  onChange={(e) => setJobCardData(prev => ({ ...prev, requestedWork: e.target.value }))}
                  placeholder="Describe the work to be performed..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Label>Task Description</Label>
                  <Input
                    value={newTask.description}
                    onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Task description"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Status</Label>
                  <Select 
                    value={newTask.status} 
                    onValueChange={(value) => setNewTask(prev => ({ ...prev, status: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Time (hrs)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={newTask.timeHours}
                    onChange={(e) => setNewTask(prev => ({ ...prev, timeHours: parseFloat(e.target.value) || 0 }))}
                    placeholder="0"
                  />
                </div>
                <div className="col-span-3">
                  <Label>Notes</Label>
                  <Input
                    value={newTask.notes}
                    onChange={(e) => setNewTask(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes"
                  />
                </div>
                <div className="col-span-1">
                  <Button onClick={addTask} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {jobCardData.tasks.length > 0 && (
                <div className="space-y-2">
                  {jobCardData.tasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="font-medium">{task.description}</div>
                        <div className="text-sm text-gray-600">
                          <Badge className={`text-xs mr-2 ${
                            task.status === 'completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {task.status.replace('-', ' ')}
                          </Badge>
                          {task.timeHours}h
                          {task.notes && ` • ${task.notes}`}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTask(task.id!)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Parts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-3">
                  <Label>Part Name</Label>
                  <Input
                    value={newPart.name}
                    onChange={(e) => setNewPart(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Part name"
                  />
                </div>
                <div className="col-span-3">
                  <Label>Part Number</Label>
                  <Input
                    value={newPart.partNumber}
                    onChange={(e) => setNewPart(prev => ({ ...prev, partNumber: e.target.value }))}
                    placeholder="Part number"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={newPart.quantity}
                    onChange={(e) => setNewPart(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    placeholder="1"
                  />
                </div>
                <div className="col-span-3">
                  <Label>Unit Cost ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newPart.unitCost}
                    onChange={(e) => setNewPart(prev => ({ ...prev, unitCost: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="col-span-1">
                  <Button onClick={addPart} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {jobCardData.parts.length > 0 && (
                <div className="space-y-2">
                  {jobCardData.parts.map((part) => (
                    <div key={part.id} className="flex items-center gap-2 p-3 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="font-medium">{part.name}</div>
                        <div className="text-sm text-gray-600">
                          {part.partNumber && `${part.partNumber} • `}
                          Qty: {part.quantity} × ${part.unitCost.toFixed(2)} = ${(part.quantity * part.unitCost).toFixed(2)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePart(part.id!)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="text-right font-bold text-lg text-green-600">
                    Total Cost: ${jobCardData.totalCost.toFixed(2)}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save Job Card'}
          </Button>
          {jobCardData.id && (
            <Button onClick={handlePrint} disabled={loading} className="bg-green-600 hover:bg-green-700">
              <Printer className="h-4 w-4 mr-2" />
              {loading ? 'Printing...' : 'Save & Print'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
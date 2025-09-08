'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FileText, Download } from 'lucide-react'

interface JobCardModalProps {
  isOpen: boolean
  onClose: () => void
  maintenanceRecord?: any
}

export function JobCardModal({ isOpen, onClose, maintenanceRecord }: JobCardModalProps) {
  const [jobCardData, setJobCardData] = useState({
    vehicleName: maintenanceRecord?.truck ? `${maintenanceRecord.truck.year} ${maintenanceRecord.truck.make} ${maintenanceRecord.truck.model}` : `Trailer ${maintenanceRecord?.trailer?.number || ''}`,
    plateNumber: maintenanceRecord?.truck?.licensePlate || maintenanceRecord?.trailer?.number || '',
    driverName: maintenanceRecord?.driverName || '',
    mechanicName: maintenanceRecord?.mechanic?.name || '',
    serviceType: maintenanceRecord?.serviceType || '',
    description: maintenanceRecord?.description || '',
    datePerformed: maintenanceRecord?.datePerformed || new Date().toISOString().split('T')[0],
    totalCost: maintenanceRecord?.totalCost || 0,
    status: maintenanceRecord?.status || 'SCHEDULED'
  })

  const generateJobCard = () => {
    const jobCardContent = `
JOB CARD
========

Vehicle: ${jobCardData.vehicleName}
Plate Number: ${jobCardData.plateNumber}
Driver: ${jobCardData.driverName}
Mechanic: ${jobCardData.mechanicName}

Service Type: ${jobCardData.serviceType}
Description: ${jobCardData.description}
Date: ${new Date(jobCardData.datePerformed).toLocaleDateString()}
Status: ${jobCardData.status}
Total Cost: ﷼${jobCardData.totalCost.toFixed(2)}

Generated on: ${new Date().toLocaleString()}
    `.trim()

    const blob = new Blob([jobCardContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-card-${jobCardData.plateNumber}-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Job Card Generator
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vehicle</Label>
              <Input 
                value={jobCardData.vehicleName} 
                onChange={(e) => setJobCardData({...jobCardData, vehicleName: e.target.value})}
              />
            </div>
            <div>
              <Label>Plate Number</Label>
              <Input 
                value={jobCardData.plateNumber} 
                onChange={(e) => setJobCardData({...jobCardData, plateNumber: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Driver</Label>
              <Input 
                value={jobCardData.driverName} 
                onChange={(e) => setJobCardData({...jobCardData, driverName: e.target.value})}
              />
            </div>
            <div>
              <Label>Mechanic</Label>
              <Input 
                value={jobCardData.mechanicName} 
                onChange={(e) => setJobCardData({...jobCardData, mechanicName: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label>Service Type</Label>
            <Input 
              value={jobCardData.serviceType} 
              onChange={(e) => setJobCardData({...jobCardData, serviceType: e.target.value})}
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea 
              value={jobCardData.description} 
              onChange={(e) => setJobCardData({...jobCardData, description: e.target.value})}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input 
                type="date"
                value={jobCardData.datePerformed} 
                onChange={(e) => setJobCardData({...jobCardData, datePerformed: e.target.value})}
              />
            </div>
            <div>
              <Label>Total Cost</Label>
              <Input 
                type="number"
                value={jobCardData.totalCost} 
                onChange={(e) => setJobCardData({...jobCardData, totalCost: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={generateJobCard} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download Job Card
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
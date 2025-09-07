'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Eye, Star } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost } from '@/lib/api'

interface Template {
  id: string
  name: string
  content: string
  isDefault: boolean
  isActive: boolean
  createdAt: string
  createdBy?: {
    name: string
    email: string
  }
}

export default function JobCardTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    content: getDefaultTemplate(),
    isDefault: false
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await apiGet('/api/job-card-templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      let currentUserId = null
      try {
        const userResponse = await apiGet('/api/auth/me')
        if (userResponse.ok) {
          const userData = await userResponse.json()
          currentUserId = userData.user?.id || userData.id
        }
      } catch (e) {
        console.error('Error getting current user:', e)
      }

      const response = await apiPost('/api/job-card-templates', {
        ...formData,
        createdById: currentUserId
      })

      if (response.ok) {
        toast.success('Template saved successfully')
        setIsDialogOpen(false)
        resetForm()
        fetchTemplates()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save template')
      }
    } catch (error) {
      console.error('Error saving template:', error)
      toast.error('Failed to save template')
    }
  }

  const resetForm = () => {
    setEditingTemplate(null)
    setFormData({
      name: '',
      content: getDefaultTemplate(),
      isDefault: false
    })
  }

  const handleEdit = (template: Template) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      content: template.content,
      isDefault: template.isDefault
    })
    setIsDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Job Card Templates</h1>
          <p className="text-gray-600 mt-1">Manage job card print templates</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Template Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Standard Job Card"
                  required
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                />
                <Label htmlFor="isDefault">Set as default template</Label>
              </div>

              <div>
                <Label>Template Content (HTML)</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="HTML template with tokens..."
                  required
                />
                <div className="text-sm text-gray-500 mt-2">
                  Available tokens: {{jobCardNo}}, {{vehicleName}}, {{vehicleIdentifier}}, {{driverName}}, 
                  {{mechanicName}}, {{reportedIssues}}, {{requestedWork}}, {{tasks}}, {{parts}}, {{totalCost}}, {{qrCode}}
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  {template.isDefault && (
                    <Badge className="bg-yellow-100 text-yellow-800">
                      <Star className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(template)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                Created: {new Date(template.createdAt).toLocaleDateString()}
                {template.createdBy && ` by ${template.createdBy.name}`}
              </div>
              <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono max-h-32 overflow-y-auto">
                {template.content.substring(0, 200)}...
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function getDefaultTemplate(): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Job Card - {{jobCardNo}}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .job-card-no { font-size: 24px; font-weight: bold; color: #333; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 16px; font-weight: bold; background: #f5f5f5; padding: 8px; border-left: 4px solid #007bff; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
    .info-item { padding: 5px 0; }
    .label { font-weight: bold; color: #555; }
    .value { margin-left: 10px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 40px; }
    .signature-box { border-top: 1px solid #333; padding-top: 10px; text-align: center; }
    .qr-code { text-align: center; margin-top: 30px; }
    .total-cost { font-size: 18px; font-weight: bold; color: #28a745; text-align: right; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>JOB CARD</h1>
    <div class="job-card-no">{{jobCardNo}}</div>
  </div>

  <div class="section">
    <div class="section-title">Vehicle Information</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="label">Vehicle:</span>
        <span class="value">{{vehicleName}}</span>
      </div>
      <div class="info-item">
        <span class="label">Registration:</span>
        <span class="value">{{vehicleIdentifier}}</span>
      </div>
      <div class="info-item">
        <span class="label">Driver:</span>
        <span class="value">{{driverName}}</span>
      </div>
      <div class="info-item">
        <span class="label">Mechanic:</span>
        <span class="value">{{mechanicName}}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Work Details</div>
    <div style="margin-top: 15px;">
      <div class="label">Reported Issues:</div>
      <div style="margin-top: 5px; padding: 10px; background: #f8f9fa; border-radius: 4px;">{{reportedIssues}}</div>
    </div>
    <div style="margin-top: 15px;">
      <div class="label">Requested Work:</div>
      <div style="margin-top: 5px; padding: 10px; background: #f8f9fa; border-radius: 4px;">{{requestedWork}}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Tasks & Parts</div>
    {{tasks}}
    {{parts}}
    <div class="total-cost">Total Cost: {{totalCost}}</div>
  </div>

  <div class="signatures">
    <div class="signature-box">
      <div>Customer Signature</div>
      <div style="margin-top: 20px;">Date: _____________</div>
    </div>
    <div class="signature-box">
      <div>Mechanic Signature</div>
      <div style="margin-top: 20px;">Date: _____________</div>
    </div>
    <div class="signature-box">
      <div>Supervisor Signature</div>
      <div style="margin-top: 20px;">Date: _____________</div>
    </div>
  </div>

  <div class="qr-code">
    <img src="{{qrCode}}" alt="QR Code" style="width: 100px; height: 100px;">
    <div style="margin-top: 10px; font-size: 12px; color: #666;">
      Scan to view job card details
    </div>
  </div>
</body>
</html>`
}
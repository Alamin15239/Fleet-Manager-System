'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FileText, Plus, Edit, Trash2, Star } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { PageHeader } from '@/components/page-header'

interface JobCardTemplate {
  id: string
  name: string
  description?: string
  layout: any
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function JobCardTemplatesPage() {
  const [templates, setTemplates] = useState<JobCardTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<JobCardTemplate | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isDefault: false,
    layout: {
      showVehicleInfo: true,
      showServiceInfo: true,
      showCostBreakdown: true,
      showSignatures: true,
      showQRCode: true,
      customFields: []
    }
  })

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/job-cards/templates')
      if (response.ok) {
        const data = await response.json()
        setTemplates(data.data || [])
      } else {
        toast.error('Failed to fetch templates')
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast.error('Failed to fetch templates')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingTemplate ? `/api/job-cards/templates/${editingTemplate.id}` : '/api/job-cards/templates'
      const method = editingTemplate ? apiPut : apiPost
      
      const response = await method(url, formData)

      if (response.ok) {
        toast.success(editingTemplate ? 'Template updated successfully' : 'Template created successfully')
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

  const handleEdit = (template: JobCardTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || '',
      isDefault: template.isDefault,
      layout: template.layout
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const response = await apiDelete(`/api/job-cards/templates/${templateId}`)
      if (response.ok) {
        toast.success('Template deleted successfully')
        fetchTemplates()
      } else {
        toast.error('Failed to delete template')
      }
    } catch (error) {
      console.error('Error deleting template:', error)
      toast.error('Failed to delete template')
    }
  }

  const resetForm = () => {
    setEditingTemplate(null)
    setFormData({
      name: '',
      description: '',
      isDefault: false,
      layout: {
        showVehicleInfo: true,
        showServiceInfo: true,
        showCostBreakdown: true,
        showSignatures: true,
        showQRCode: true,
        customFields: []
      }
    })
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
      <PageHeader 
        titleKey="Job Card Templates" 
        subtitleKey="Manage job card templates and layouts"
      >
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Template Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isDefault"
                    checked={formData.isDefault}
                    onCheckedChange={(checked) => setFormData({...formData, isDefault: checked})}
                  />
                  <Label htmlFor="isDefault">Set as Default Template</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={2}
                />
              </div>

              <div>
                <Label>Layout Options</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.layout.showVehicleInfo}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        layout: {...formData.layout, showVehicleInfo: checked}
                      })}
                    />
                    <Label>Show Vehicle Information</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.layout.showServiceInfo}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        layout: {...formData.layout, showServiceInfo: checked}
                      })}
                    />
                    <Label>Show Service Information</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.layout.showCostBreakdown}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        layout: {...formData.layout, showCostBreakdown: checked}
                      })}
                    />
                    <Label>Show Cost Breakdown</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.layout.showSignatures}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        layout: {...formData.layout, showSignatures: checked}
                      })}
                    />
                    <Label>Show Signature Fields</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.layout.showQRCode}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        layout: {...formData.layout, showQRCode: checked}
                      })}
                    />
                    <Label>Show QR Code</Label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>Job Card Templates ({templates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No templates found</p>
              <Button onClick={() => setIsDialogOpen(true)} className="mt-4">
                Create First Template
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        {template.isDefault && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {template.description || 'No description'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.isActive ? 'default' : 'secondary'}>
                        {template.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(template.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Edit, Trash2, Search, User, Wrench, Phone, Star } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { useLanguage } from '@/contexts/language-context'
import { PageHeader } from '@/components/page-header'

interface Mechanic {
  id: string
  name: string
  email?: string
  phone?: string
  specialty?: string
  isActive: boolean
  maintenanceCount?: number
}

export default function MechanicsPage() {
  const { t } = useLanguage()
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingMechanic, setEditingMechanic] = useState<Mechanic | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialty: '',
    isActive: true
  })

  useEffect(() => {
    fetchMechanics()
  }, [])

  const fetchMechanics = async () => {
    try {
      const response = await apiGet('/api/mechanics?includeInactive=true&includeCount=true')
      if (response.ok) {
        const data = await response.json()
        setMechanics(data)
      } else if (response.status === 403) {
        toast.error('You do not have permission to view mechanics')
        setMechanics([])
      } else {
        toast.error('Failed to fetch mechanics')
      }
    } catch (error) {
      console.error('Error fetching mechanics:', error)
      toast.error('Failed to fetch mechanics')
    } finally {
      setLoading(false)
    }
  }

  const filteredMechanics = (mechanics || []).filter(mechanic => {
    const matchesSearch = mechanic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (mechanic.email && mechanic.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (mechanic.specialty && mechanic.specialty.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && mechanic.isActive) ||
                         (statusFilter === 'inactive' && !mechanic.isActive)
    
    return matchesSearch && matchesStatus
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingMechanic ? `/api/mechanics/${editingMechanic.id}` : '/api/mechanics'
      const method = editingMechanic ? apiPut : apiPost
      
      const payload = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        specialty: formData.specialty || null,
        isActive: formData.isActive
      }
      
      const response = await method(url, payload)

      if (response.ok) {
        if (editingMechanic) {
          toast.success('Mechanic updated successfully')
        } else {
          toast.success('Mechanic added successfully')
        }
        setIsDialogOpen(false)
        resetForm()
        fetchMechanics()
      } else if (response.status === 403) {
        toast.error('You do not have permission to perform this action')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to save mechanic')
      }
    } catch (error) {
      console.error('Error saving mechanic:', error)
      toast.error('Failed to save mechanic')
    }
  }

  const handleEdit = (mechanic: Mechanic) => {
    setEditingMechanic(mechanic)
    setFormData({
      name: mechanic.name,
      email: mechanic.email || '',
      phone: mechanic.phone || '',
      specialty: mechanic.specialty || '',
      isActive: mechanic.isActive
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (mechanicId: string) => {
    if (confirm('Are you sure you want to delete this mechanic?')) {
      try {
        const response = await apiDelete(`/api/mechanics/${mechanicId}`)

        if (response.ok) {
          toast.success('Mechanic deleted successfully')
          fetchMechanics()
        } else if (response.status === 403) {
          toast.error('You do not have permission to delete mechanics')
        } else {
          const errorData = await response.json()
          toast.error(errorData.error || 'Failed to delete mechanic')
        }
      } catch (error) {
        console.error('Error deleting mechanic:', error)
        toast.error('Failed to delete mechanic')
      }
    }
  }

  const resetForm = () => {
    setEditingMechanic(null)
    setFormData({
      name: '',
      email: '',
      phone: '',
      specialty: '',
      isActive: true
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
        titleKey="mechanics.title" 
        subtitleKey="mechanics.subtitle"
      >
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              {t('action.add')} {t('mechanics.title').split(' ')[0]}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingMechanic ? t('mechanics.editMechanic') : t('mechanics.addMechanic')}
              </DialogTitle>
              <DialogDescription>
                {editingMechanic ? t('mechanics.updateDetails') : t('mechanics.mechanicDetails')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  {t('form.name')} *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="col-span-3"
                  required
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  {t('form.email')}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="col-span-3"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="phone" className="text-right">
                  {t('form.phone')}
                </Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="col-span-3"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="specialty" className="text-right">
                  {t('form.specialty')}
                </Label>
                <Input
                  id="specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                  className="col-span-3"
                  placeholder={t('mechanics.specialtyPlaceholder')}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isActive" className="text-right">
                  {t('table.status')}
                </Label>
                <Select value={formData.isActive ? 'true' : 'false'} onValueChange={(value) => setFormData({...formData, isActive: value === 'true'})}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t('placeholder.selectStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">{t('status.active')}</SelectItem>
                    <SelectItem value="false">{t('status.inactive')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter>
                <Button type="submit">
                  {editingMechanic ? t('action.update') + ' ' + t('mechanics.title') : t('action.add') + ' ' + t('mechanics.title')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>{t('mechanics.title')}</CardTitle>
          <CardDescription>
            {t('mechanics.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder={t('placeholder.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={t('placeholder.selectStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('status.active')} & {t('status.inactive')}</SelectItem>
                <SelectItem value="active">{t('status.active')}</SelectItem>
                <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.name')}</TableHead>
                <TableHead>{t('table.contact')}</TableHead>
                <TableHead>{t('table.specialty')}</TableHead>
                <TableHead>{t('table.status')}</TableHead>
                <TableHead>{t('table.maintenanceCount')}</TableHead>
                <TableHead className="text-right">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMechanics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Wrench className="h-8 w-8 text-gray-400" />
                      <p className="text-gray-500">{t('message.noData')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMechanics.map((mechanic) => (
                  <TableRow key={mechanic.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {mechanic.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {mechanic.email && (
                          <div className="text-sm text-gray-600">{mechanic.email}</div>
                        )}
                        {mechanic.phone && (
                          <div className="text-sm text-gray-600 flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {mechanic.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {mechanic.specialty ? (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-500" />
                          <span className="text-sm">{mechanic.specialty}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={mechanic.isActive ? "default" : "secondary"}>
                        {mechanic.isActive ? t('status.active') : t('status.inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell>{mechanic.maintenanceCount || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(mechanic)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleDelete(mechanic.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
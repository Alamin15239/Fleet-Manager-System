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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mechanics Management</h1>
          <p className="text-muted-foreground">Manage mechanics and their information</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Mechanic
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingMechanic ? 'Edit Mechanic' : 'Add New Mechanic'}
              </DialogTitle>
              <DialogDescription>
                {editingMechanic ? 'Update the mechanic information below.' : 'Enter the mechanic details to add them to the system.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name *
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
                  Email
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
                  Phone
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
                  Specialty
                </Label>
                <Input
                  id="specialty"
                  value={formData.specialty}
                  onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                  className="col-span-3"
                  placeholder="e.g., Engine Specialist, Electrician"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isActive" className="text-right">
                  Status
                </Label>
                <Select value={formData.isActive ? 'true' : 'false'} onValueChange={(value) => setFormData({...formData, isActive: value === 'true'})}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <DialogFooter>
                <Button type="submit">
                  {editingMechanic ? 'Update Mechanic' : 'Add Mechanic'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mechanics</CardTitle>
          <CardDescription>
            Manage your mechanics and their information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search mechanics..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Maintenance Count</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMechanics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Wrench className="h-8 w-8 text-gray-400" />
                      <p className="text-gray-500">No mechanics found</p>
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
                        {mechanic.isActive ? "Active" : "Inactive"}
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
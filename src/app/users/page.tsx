'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users, Plus, Edit, Trash2, Shield, UserCheck, UserX, RefreshCw, Bug } from 'lucide-react'
import { useRealtimeUsers } from '@/hooks/use-realtime-users'
import { useAuth } from '@/contexts/auth-context'
import { usePermissions } from '@/contexts/permissions-context'
import { useLanguage } from '@/contexts/language-context'
import { apiPost } from '@/lib/api'
import { toast } from '@/lib/localized-toast'

interface User {
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'MANAGER' | 'USER'
  isActive: boolean
  isApproved: boolean
  createdAt: string
  updatedAt: string
}

interface UserFormData {
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'USER'
  password: string
  isActive: boolean
}

export default function UsersPage() {
  const { t } = useLanguage()
  const { user: currentUser } = useAuth()
  const { canAccess, canCreate, canUpdate, canDelete, refreshPermissions } = usePermissions()
  const isAdmin = currentUser?.role === 'ADMIN'
  const { users, loading, error, deleteUser, createUser, updateUser, refresh } = useRealtimeUsers(canAccess('users'))
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    name: '',
    role: 'USER',
    password: '',
    isActive: true
  })
  const [dbHealth, setDbHealth] = useState<any>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [processingUserId, setProcessingUserId] = useState<string | null>(null)

  useEffect(() => {
    checkDbHealth()
  }, [])

  const checkDbHealth = async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch('/api/admin/db-health', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const health = await response.json()
        setDbHealth(health)
      }
    } catch (error) {
      console.error('Error checking database health:', error)
    }
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isSaving) return
    setIsSaving(true)
    try {
      const success = editingUser
        ? await updateUser(editingUser.id, formData)
        : await createUser(formData)

      if (success) {
        setIsDialogOpen(false)
        resetForm()
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      name: user.name || '',
      role: user.role,
      password: '',
      isActive: user.isActive
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (userId: string, userEmail: string) => {
    const confirmed = confirm(
      `${t('Are you sure you want to delete the user')} "${userEmail}"?\n\n${t('This action cannot be undone. The user will be soft-deleted and can be restored by an administrator if needed.')}`
    )
    if (!confirmed) return
    await deleteUser(userId)
  }

  const handleReactivateOrApprove = async (user: User) => {
    if (processingUserId) return
    setProcessingUserId(user.id)
    try {
      if (!user.isApproved) {
        if (!isAdmin) return
        const response = await apiPost('/api/admin/users/approve', { userId: user.id, approved: true })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.error || 'Failed to approve user')
        toast.success('User approved and activated')
      } else {
        const success = await updateUser(user.id, { isActive: true })
        if (!success) return
      }
      await refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reactivate user')
    } finally {
      setProcessingUserId(null)
    }
  }

  const handleRefreshUsers = async () => {
    await refreshPermissions()
    await refresh()
  }

  const resetForm = () => {
    setEditingUser(null)
    setFormData({
      email: '',
      name: '',
      role: 'USER',
      password: '',
      isActive: true
    })
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800'
      case 'MANAGER': return 'bg-blue-100 text-blue-800'
      case 'USER': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN': return <Shield className="h-4 w-4" />
      case 'MANAGER': return <UserCheck className="h-4 w-4" />
      case 'USER': return <Users className="h-4 w-4" />
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!currentUser || !canAccess('users')) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <LocalizedText>You do not have permission to view users.</LocalizedText>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight"><LocalizedText>User Management</LocalizedText></h1>
          <p className="text-muted-foreground"><LocalizedText>Manage user accounts and permissions</LocalizedText></p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefreshUsers}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowDebug(!showDebug)}
            size="sm"
          >
            Debug
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            {canCreate('users') && (
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
            )}
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Edit User' : 'Add New User'}
              </DialogTitle>
              <DialogDescription>
                {editingUser 
                  ? 'Update user information and permissions'
                  : 'Create a new user account with appropriate permissions'
                }
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email"><LocalizedText>Email</LocalizedText></Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name"><LocalizedText>Full Name</LocalizedText></Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role"><LocalizedText>Role</LocalizedText></Label>
                <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isAdmin && <SelectItem value="ADMIN"><LocalizedText>Administrator</LocalizedText></SelectItem>}
                    {isAdmin && <SelectItem value="MANAGER"><LocalizedText>Manager</LocalizedText></SelectItem>}
                    <SelectItem value="USER"><LocalizedText>Office User</LocalizedText></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password {editingUser && '(Leave blank to keep current)'}</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="isActive"><LocalizedText>Active Account</LocalizedText></Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {error && (
        <Alert className="mb-4">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Error loading users: {error}
            <Button variant="link" onClick={refresh} className="ml-2 p-0 h-auto">
              <LocalizedText>Try again</LocalizedText>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showDebug && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-sm"><LocalizedText>Debug Information</LocalizedText></CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <strong><LocalizedText>Frontend Status:</LocalizedText></strong>
                <ul className="mt-1 space-y-1">
                  <li>Users loaded: {users.length}</li>
                  <li>Loading: {loading ? 'Yes' : 'No'}</li>
                  <li>Error: {error || 'None'}</li>
                  <li>Last refresh: {new Date().toLocaleTimeString()}</li>
                </ul>
              </div>
              <div>
                <strong><LocalizedText>Database Health:</LocalizedText></strong>
                {dbHealth ? (
                  <ul className="mt-1 space-y-1">
                    <li>Status: {dbHealth.status}</li>
                    <li>Response time: {dbHealth.responseTime}</li>
                    <li>Total users: {dbHealth.data?.totalUsers}</li>
                    <li>Active users: {dbHealth.data?.activeUsers}</li>
                    <li>Deleted users: {dbHealth.data?.deletedUsers}</li>
                  </ul>
                ) : (
                  <p className="mt-1"><LocalizedText>Loading...</LocalizedText></p>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={checkDbHealth}
                  className="mt-2"
                >
                  <LocalizedText>Refresh DB Health</LocalizedText>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Users ({users.length})</span>
            {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>}
          </CardTitle>
          <CardDescription>
            <LocalizedText>Manage all user accounts in the system - Auto-refreshes every 10 seconds</LocalizedText>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><LocalizedText>User</LocalizedText></TableHead>
                <TableHead><LocalizedText>Role</LocalizedText></TableHead>
                <TableHead><LocalizedText>Status</LocalizedText></TableHead>
                <TableHead><LocalizedText>Created</LocalizedText></TableHead>
                <TableHead className="text-right"><LocalizedText>Actions</LocalizedText></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.isArray(users) && users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.name || 'No name'}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        <div className="flex items-center gap-1">
                          {getRoleIcon(user.role)}
                          <LocalizedText>{user.role}</LocalizedText>
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {!user.isApproved && <Badge variant="outline" className="text-amber-700"><LocalizedText>Pending approval</LocalizedText></Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {canUpdate('users') && (user.isApproved ? !user.isActive : isAdmin) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReactivateOrApprove(user)}
                            disabled={processingUserId !== null}
                          >
                            <RefreshCw className={`h-4 w-4 ${processingUserId === user.id ? 'animate-spin' : ''}`} />
                            <span className="ml-2"><LocalizedText>{user.isApproved ? 'Reactivate' : 'Approve & Activate'}</LocalizedText></span>
                          </Button>
                        )}
                        {canUpdate('users') && (isAdmin || user.role === 'USER') && (
                          <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete('users') && (isAdmin || user.role === 'USER') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(user.id, user.email)}
                            disabled={user.id === currentUser?.id}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title={user.id === currentUser?.id ? 'Cannot delete your own account' : 'Delete user'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    {loading ? 'Loading users...' : 'No users found'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

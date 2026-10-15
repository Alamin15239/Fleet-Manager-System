'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { ProfilePicture } from '@/components/profile-picture'
import { prepareProfileImage } from '@/lib/prepare-profile-image'
import { Loader2, Save, User, Mail, Phone, Building, Briefcase, Edit } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'MANAGER' | 'USER'
  isActive: boolean
  isApproved: boolean
  isEmailVerified: boolean
  profileImage: string | null
  phone: string | null
  department: string | null
  title: string | null
  bio: string | null
  createdAt: string
  updatedAt: string
}

export default function ProfilePage() {
  const { token, refreshUser, updateUser } = useAuth()
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    department: '',
    title: '',
    bio: ''
  })

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false
    const loadProfile = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        if (!response.ok) throw new Error('Unable to load profile data')

        const data = await response.json()
        const savedProfile = data.user as UserProfile
        if (cancelled) return
        setProfile(savedProfile)
        setFormData({
          name: savedProfile.name || '',
          phone: savedProfile.phone || '',
          department: savedProfile.department || '',
          title: savedProfile.title || '',
          bio: savedProfile.bio || ''
        })
        updateUser(savedProfile)
      } catch (error) {
        console.error('Error loading profile:', error)
        if (!cancelled) {
          setProfile(null)
          toast({
            title: 'Error',
            description: 'Unable to load profile data from the database',
            variant: 'destructive'
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadProfile()
    return () => { cancelled = true }
  }, [token, updateUser])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.user)
        updateUser(data.user)
        await refreshUser()
        setIsEditing(false)
        toast({
          title: 'Success',
          description: 'Profile updated successfully'
        })
      } else {
        throw new Error('Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: 'Error',
        description: 'Failed to update profile',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name || '',
        phone: profile.phone || '',
        department: profile.department || '',
        title: profile.title || '',
        bio: profile.bio || ''
      })
    }
    setIsEditing(false)
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const preparedFile = await prepareProfileImage(file)
      const formData = new FormData()
      formData.append('file', preparedFile)

      const response = await fetch('/api/upload/profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        
        // Update profile state immediately
        if (profile) {
          const updatedProfile = { ...profile, ...data.user, profileImage: data.url }
          setProfile(updatedProfile)
          updateUser(updatedProfile)
        }
        await refreshUser()

        toast({
          title: 'Success',
          description: 'Profile image updated successfully'
        })
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Upload error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })
        throw new Error(errorData.error || `Upload failed with status ${response.status}`)
      }
    } catch (error) {
      console.error('Error uploading image:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        token: token ? 'Present' : 'Missing',
        fileSize: file?.size,
        fileType: file?.type
      })
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to upload profile image',
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800'
      case 'MANAGER': return 'bg-blue-100 text-blue-800'
      case 'USER': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4"><LocalizedText>Profile not found</LocalizedText></h1>
          <p className="text-muted-foreground"><LocalizedText>Unable to load profile data</LocalizedText></p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight"><LocalizedText>Profile</LocalizedText></h1>
          <p className="text-muted-foreground"><LocalizedText>Manage your account information</LocalizedText></p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle><LocalizedText>Profile Picture</LocalizedText></CardTitle>
            <CardDescription><LocalizedText>Your profile photo</LocalizedText></CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            <ProfilePicture size="xl" editable={true} className="mb-4" />
            <div className="text-center space-y-2">
              <Badge className={getRoleColor(profile.role)}>
                {profile.role}
              </Badge>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{profile.email}</span>
                </div>
                {profile.phone && (
                  <div className="flex items-center justify-center space-x-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile.department && (
                  <div className="flex items-center justify-center space-x-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.department}</span>
                  </div>
                )}
                {profile.title && (
                  <div className="flex items-center justify-center space-x-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span>{profile.title}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Information */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle><LocalizedText>Profile Information</LocalizedText></CardTitle>
            <CardDescription>
              {isEditing ? 'Edit your profile information' : 'View your profile information'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name"><LocalizedText>Full Name</LocalizedText></Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone"><LocalizedText>Phone Number</LocalizedText></Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Enter your phone number"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department"><LocalizedText>Department</LocalizedText></Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="Enter your department"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title"><LocalizedText>Job Title</LocalizedText></Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter your job title"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio"><LocalizedText>Bio</LocalizedText></Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    placeholder="Tell us about yourself"
                    rows={4}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    <LocalizedText>Cancel</LocalizedText>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground"><LocalizedText>Full Name</LocalizedText></Label>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{profile.name || 'Not provided'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground"><LocalizedText>Email</LocalizedText></Label>
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{profile.email}</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground"><LocalizedText>Phone</LocalizedText></Label>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{profile.phone || 'Not provided'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground"><LocalizedText>Role</LocalizedText></Label>
                    <Badge className={getRoleColor(profile.role)}>
                      {profile.role}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground"><LocalizedText>Department</LocalizedText></Label>
                    <div className="flex items-center space-x-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{profile.department || 'Not provided'}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground"><LocalizedText>Job Title</LocalizedText></Label>
                    <div className="flex items-center space-x-2">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span>{profile.title || 'Not provided'}</span>
                    </div>
                  </div>
                </div>
                {profile.bio && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground"><LocalizedText>Bio</LocalizedText></Label>
                    <p className="text-sm">{profile.bio}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Account Status */}
      <Card>
        <CardHeader>
          <CardTitle><LocalizedText>Account Status</LocalizedText></CardTitle>
          <CardDescription><LocalizedText>Your account verification and approval status</LocalizedText></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${profile.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">Account {profile.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${profile.isApproved ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm">{profile.isApproved ? 'Approved' : 'Pending Approval'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${profile.isEmailVerified ? 'bg-green-500' : 'bg-yellow-500'}`} />
              <span className="text-sm">{profile.isEmailVerified ? 'Email Verified' : 'Email Not Verified'}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <LocalizedText>Member since</LocalizedText>{' '}
              {profile.createdAt && Number.isFinite(new Date(profile.createdAt).getTime())
                ? new Date(profile.createdAt).toLocaleDateString()
                : <LocalizedText>Not available</LocalizedText>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

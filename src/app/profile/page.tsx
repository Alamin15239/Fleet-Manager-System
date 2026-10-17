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
import { useLanguage } from '@/contexts/language-context'
import { useToast } from '@/hooks/use-toast'
import { ProfilePicture } from '@/components/profile-picture'
import { prepareProfileImage } from '@/lib/prepare-profile-image'
import { cn } from '@/lib/utils'
import { usePermissions } from '@/contexts/permissions-context'
import {
  BadgeCheck,
  Briefcase,
  Building,
  CalendarDays,
  CheckCircle2,
  Edit,
  Loader2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User,
  UserRound,
  XCircle,
} from 'lucide-react'

function ProfileField({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-border/70 bg-muted/20 p-3.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm ring-1 ring-border/70">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground"><LocalizedText>{label}</LocalizedText></p>
        <p className="mt-1 break-words text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

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
  const { canUpdate } = usePermissions()
  const { t } = useLanguage()
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
      case 'ADMIN': return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
      case 'MANAGER': return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300'
      case 'USER': return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
      default: return 'border-border bg-muted text-foreground'
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border bg-card px-5 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground"><LocalizedText>Loading profile</LocalizedText></span>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center p-4">
        <Card className="w-full border-dashed text-center shadow-sm">
          <CardContent className="flex flex-col items-center px-6 py-10">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><UserRound className="h-7 w-7" /></span>
            <h1 className="text-xl font-semibold"><LocalizedText>Profile not found</LocalizedText></h1>
            <p className="mt-2 text-sm text-muted-foreground"><LocalizedText>Unable to load profile data</LocalizedText></p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const memberSince = profile.createdAt && Number.isFinite(new Date(profile.createdAt).getTime())
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null

  const statusCards = [
    { label: 'Account status', value: profile.isActive ? 'Active' : 'Inactive', good: profile.isActive, Icon: profile.isActive ? CheckCircle2 : XCircle },
    { label: 'Approval', value: profile.isApproved ? 'Approved' : 'Pending Approval', good: profile.isApproved, Icon: profile.isApproved ? BadgeCheck : ShieldCheck },
    { label: 'Email verification', value: profile.isEmailVerified ? 'Verified' : 'Not Verified', good: profile.isEmailVerified, Icon: profile.isEmailVerified ? CheckCircle2 : Mail },
    { label: 'Member since', value: memberSince || 'Not available', good: Boolean(memberSince), Icon: CalendarDays },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl"><LocalizedText>Profile</LocalizedText></h1>
            <p className="mt-0.5 text-sm text-muted-foreground"><LocalizedText>Manage your account information</LocalizedText></p>
          </div>
        </div>
        {!isEditing && canUpdate('profile') && (
          <Button onClick={() => setIsEditing(true)} className="w-full rounded-xl shadow-sm sm:w-auto">
            <Edit className="me-2 h-4 w-4" />
            <LocalizedText>Edit Profile</LocalizedText>
          </Button>
        )}
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <div className="relative h-24 overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-sky-800 sm:h-32">
          <div className="absolute -end-10 -top-24 h-64 w-64 rounded-full border border-white/10" />
          <div className="absolute -end-2 -top-16 h-48 w-48 rounded-full border border-white/10" />
          <div className="absolute bottom-0 start-0 h-20 w-1/2 bg-gradient-to-r from-sky-400/20 to-transparent blur-2xl" />
        </div>
        <CardContent className="relative px-4 pb-5 sm:px-7 sm:pb-7">
          <div className="-mt-12 flex flex-col gap-4 sm:-mt-14 sm:flex-row sm:items-end sm:gap-5">
            <div className="w-fit rounded-full bg-background p-1.5 shadow-lg ring-1 ring-border/60">
              <ProfilePicture size="xl" editable={canUpdate('profile')} className="rounded-full" />
            </div>
            <div className="min-w-0 flex-1 pb-0.5 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="max-w-full truncate text-xl font-bold tracking-tight sm:text-2xl">{profile.name || <LocalizedText>User</LocalizedText>}</h2>
                <Badge className={cn('rounded-full border px-2.5 py-1', getRoleColor(profile.role))}>{profile.role}</Badge>
                <Badge variant="outline" className={cn('rounded-full bg-background/70 px-2.5 py-1', profile.isActive ? 'border-emerald-500/25 text-emerald-700 dark:text-emerald-300' : 'border-destructive/25 text-destructive')}>
                  <span className={cn('me-1.5 h-1.5 w-1.5 rounded-full', profile.isActive ? 'bg-emerald-500' : 'bg-destructive')} />
                  <LocalizedText>{profile.isActive ? 'Active' : 'Inactive'}</LocalizedText>
                </Badge>
              </div>
              <div className="mt-2 flex flex-col gap-x-5 gap-y-1.5 text-sm text-muted-foreground sm:flex-row sm:flex-wrap">
                <span className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{profile.email}</span></span>
                {profile.title && <span className="flex min-w-0 items-center gap-2"><Briefcase className="h-4 w-4 shrink-0" /><span className="truncate">{profile.title}</span></span>}
                {profile.department && <span className="flex min-w-0 items-center gap-2"><Building className="h-4 w-4 shrink-0" /><span className="truncate">{profile.department}</span></span>}
              </div>
            </div>
            {memberSince && (
              <div className="hidden shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground md:flex">
                <CalendarDays className="h-4 w-4" />
                <span><LocalizedText>Member since</LocalizedText> <strong className="ms-1 font-semibold text-foreground">{memberSince}</strong></span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="account-status-heading" className="space-y-3">
        <div className="flex items-center gap-2 px-0.5">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 id="account-status-heading" className="text-sm font-semibold"><LocalizedText>Account Status</LocalizedText></h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statusCards.map(({ label, value, good, Icon }) => (
            <Card key={label} className="border-border/70 shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', good ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>
                  <Icon className="h-[1.1rem] w-[1.1rem]" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground"><LocalizedText>{label}</LocalizedText></p>
                  <p className="mt-1 truncate text-sm font-semibold"><LocalizedText>{value}</LocalizedText></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><User className="h-5 w-5" /></span>
              <div>
                <CardTitle className="text-base"><LocalizedText>Profile Information</LocalizedText></CardTitle>
                <CardDescription className="mt-1">
                  <LocalizedText>{isEditing ? 'Edit your profile information' : 'View your profile information'}</LocalizedText>
                </CardDescription>
              </div>
            </div>
            {!isEditing && <Badge variant="secondary" className="w-fit rounded-full"><ShieldCheck className="me-1" /><LocalizedText>Private account details</LocalizedText></Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {isEditing ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="name"><LocalizedText>Full Name</LocalizedText></Label><Input id="name" className="h-11 rounded-xl" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter your full name" /></div>
                <div className="space-y-2"><Label htmlFor="phone"><LocalizedText>Phone Number</LocalizedText></Label><Input id="phone" className="h-11 rounded-xl" type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="Enter your phone number" /></div>
                <div className="space-y-2"><Label htmlFor="department"><LocalizedText>Department</LocalizedText></Label><Input id="department" className="h-11 rounded-xl" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} placeholder="Enter your department" /></div>
                <div className="space-y-2"><Label htmlFor="title"><LocalizedText>Job Title</LocalizedText></Label><Input id="title" className="h-11 rounded-xl" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Enter your job title" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="bio"><LocalizedText>Bio</LocalizedText></Label><Textarea id="bio" className="min-h-28 rounded-xl" value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} placeholder="Tell us about yourself" rows={4} /></div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" className="rounded-xl" onClick={handleCancel}><LocalizedText>Cancel</LocalizedText></Button>
                <Button type="button" className="rounded-xl" onClick={handleSave} disabled={saving || !canUpdate('profile')}>
                  {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                  <LocalizedText>Save Changes</LocalizedText>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <ProfileField icon={User} label="Full Name" value={profile.name || t('Not provided')} />
              <ProfileField icon={Mail} label="Email" value={profile.email} />
              <ProfileField icon={Phone} label="Phone" value={profile.phone || t('Not provided')} />
              <ProfileField icon={BadgeCheck} label="Role" value={t(profile.role)} />
              <ProfileField icon={Building} label="Department" value={profile.department || t('Not provided')} />
              <ProfileField icon={Briefcase} label="Job Title" value={profile.title || t('Not provided')} />
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 sm:col-span-2">
                <p className="text-xs font-medium text-muted-foreground"><LocalizedText>Bio</LocalizedText></p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{profile.bio || t('Not provided')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

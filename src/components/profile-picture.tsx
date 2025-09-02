'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Camera, Upload, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { apiPost, apiDelete } from '@/lib/api'

interface ProfilePictureProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  editable?: boolean
  className?: string
}

export function ProfilePicture({ size = 'md', editable = false, className = '' }: ProfilePictureProps) {
  const { user, updateUser } = useAuth()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24'
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('profilePicture', file)

      const response = await fetch('/api/profile/picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        updateUser({ profileImage: data.user.profileImage })
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to upload profile picture')
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error)
      alert('Failed to upload profile picture')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemovePicture = async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) return

    setUploading(true)

    try {
      const response = await fetch('/api/profile/picture', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      })

      if (response.ok) {
        updateUser({ profileImage: null })
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Failed to remove profile picture')
      }
    } catch (error) {
      console.error('Error removing profile picture:', error)
      alert('Failed to remove profile picture')
    } finally {
      setUploading(false)
    }
  }

  const getInitials = () => {
    if (user?.name) {
      return user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    return user?.email?.[0]?.toUpperCase() || 'U'
  }

  if (!editable) {
    return (
      <Avatar className={`${sizeClasses[size]} ${className}`}>
        <AvatarImage src={user?.profileImage || undefined} alt={user?.name || 'Profile'} />
        <AvatarFallback>{getInitials()}</AvatarFallback>
      </Avatar>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <Avatar className={sizeClasses[size]}>
        <AvatarImage src={user?.profileImage || undefined} alt={user?.name || 'Profile'} />
        <AvatarFallback>{getInitials()}</AvatarFallback>
      </Avatar>
      
      {editable && (
        <div className="absolute -bottom-1 -right-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 rounded-full p-0 bg-white border-2 border-white shadow-md"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
            ) : (
              <Camera className="h-3 w-3" />
            )}
          </Button>
        </div>
      )}

      {editable && user?.profileImage && (
        <div className="absolute -top-1 -right-1">
          <Button
            size="sm"
            variant="destructive"
            className="h-6 w-6 rounded-full p-0"
            onClick={handleRemovePicture}
            disabled={uploading}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
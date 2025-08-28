'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, Shield, Clock, User, Mail, Building, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

export default function PendingApprovalPage() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [checkingStatus, setCheckingStatus] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    // Check status every 30 seconds
    const interval = setInterval(checkApprovalStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const checkApprovalStatus = async () => {
    setCheckingStatus(true)
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.user.isApproved) {
          // User is now approved, redirect to dashboard
          router.push('/')
        }
      }
    } catch (error) {
      console.error('Error checking approval status:', error)
    } finally {
      setCheckingStatus(false)
      setLastChecked(new Date())
    }
  }

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex justify-center">
            <div className="flex items-center space-x-2">
              <Truck className="h-8 w-8 text-blue-600" />
              <Shield className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Account Pending Approval
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Your account is waiting for administrator approval
          </p>
        </div>

        {/* Pending Approval Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center flex items-center justify-center">
              <Clock className="mr-2 h-6 w-6 text-yellow-600" />
              Approval Required
            </CardTitle>
            <CardDescription className="text-center">
              Your account has been created but requires administrator approval before you can access the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* User Information */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Full Name</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.email || 'user@example.com'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Email Address</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Building className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user?.role || 'USER'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                    Pending Approval
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    Your account is currently under review by an administrator
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button 
                onClick={checkApprovalStatus} 
                className="w-full" 
                disabled={checkingStatus}
              >
                {checkingStatus ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Checking Status...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Check Approval Status
                  </>
                )}
              </Button>

              <Button 
                variant="outline" 
                onClick={handleLogout} 
                className="w-full"
              >
                Logout
              </Button>
            </div>

            {/* Last Checked */}
            {lastChecked && (
              <div className="text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Last checked: {lastChecked.toLocaleTimeString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                What happens next?
              </h3>
              <div className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                <p>• An administrator will review your account request</p>
                <p>• You'll receive an email when your account is approved</p>
                <p>• This page automatically checks for approval status</p>
                <p>• Contact your system administrator if approval takes too long</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
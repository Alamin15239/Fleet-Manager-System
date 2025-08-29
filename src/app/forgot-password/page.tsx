'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, Lock, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      if (response.ok) {
        const data = await response.json()
        setSuccess(true)
        toast.success('Password reset link sent to your email!')
        
        // Show the reset link for testing
        if (data.resetLink) {
          console.log('Reset link:', data.resetLink)
        }
      } else {
        const data = await response.json().catch(() => ({}))
        console.error('API Error:', response.status, data)
        setError(data.error || `API Error: ${response.status} - ${response.statusText}`)
      }
    } catch (error) {
      console.error('Forgot password error:', error)
      setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Reset Link Sent!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                If your email address is in our database, you will receive a password reset link shortly.
                Please check your email and follow the instructions to reset your password.
              </p>
              <div className="space-y-2">
                <Button 
                  onClick={() => router.push('/login')}
                  className="w-full"
                >
                  Return to Login
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSuccess(false)
                    setEmail('')
                  }}
                  className="w-full"
                >
                  Try Another Email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex justify-center">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Forgot Password
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter your email address and we'll send you a link to reset your password
          </p>
        </div>

        {/* Forgot Password Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Reset Password</CardTitle>
            <CardDescription className="text-center">
              We'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !email}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link 
                href="/login"
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Password Reset Information
              </h3>
              <div className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                <p>• The reset link will expire in 1 hour</p>
                <p>• Check your spam folder if you don't see the email</p>
                <p>• Only active accounts can request password resets</p>
                <p>• Contact admin if you need further assistance</p>
                <p>• Current URL: https://fleet-manager-system-aco7r5xah-alamins-projects-d8a281b1.vercel.app</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
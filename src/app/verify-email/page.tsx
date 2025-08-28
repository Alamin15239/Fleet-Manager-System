'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, CheckCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

function VerifyEmailForm() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Get email from URL if present
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam))
    }
    
    // Check if already verified via URL token
    const urlToken = searchParams.get('token')
    if (urlToken && !success) {
      setToken(urlToken)
      handleVerifyEmail(new Event('submit') as any)
    }
  }, [searchParams, success, router])

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      })

      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        toast.success('Email verified successfully!')
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/login?verified=true')
        }, 2000)
      } else {
        setError(data.error || 'Failed to verify email')
      }
    } catch (error) {
      console.error('Email verification error:', error)
      setError('An error occurred while verifying your email')
    } finally {
      setLoading(false)
    }
  }

  const handleResendEmail = async () => {
    if (!email) {
      setError('Please enter your email address first')
      return
    }

    setResendLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Verification email resent successfully!')
      } else {
        setError(data.error || 'Failed to resend verification email')
      }
    } catch (error) {
      setError('An error occurred while resending verification email')
    } finally {
      setResendLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Email Verified Successfully!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Your email has been verified. You will be redirected to the login page...
              </p>
              <Link href="/login">
                <Button>
                  Go to Login
                </Button>
              </Link>
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
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
              Verify Your Email
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Enter the verification token sent to your email
            </p>
          </div>

          {/* Verify Email Card */}
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">Email Verification</CardTitle>
              <CardDescription className="text-center">
                Check your email for the verification link or enter the token manually
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyEmail} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="token">Verification Token</Label>
                  <Input
                    id="token"
                    type="text"
                    placeholder="Enter verification token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500">
                    If you clicked the verification link in your email, this field should be auto-filled.
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || !token || !email}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Email'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Didn't receive the verification email?
                </p>
                <Button 
                  variant="outline" 
                  onClick={handleResendEmail}
                  disabled={resendLoading || !email}
                  className="w-full"
                >
                  {resendLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resending...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Resend Email
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-4 text-center">
                <Link 
                  href="/login"
                  className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
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
                  Email Verification Information
                </h3>
                <div className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                  <p>• Check your spam folder if you don't see the email</p>
                  <p>• Verification links expire in 24 hours</p>
                  <p>• You must verify your email before requesting admin approval</p>
                  <p>• Contact admin if you need help with verification</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  )
}
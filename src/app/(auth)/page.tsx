'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Truck, Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function VerifyEmailPage() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Get token from URL parameters
    const urlToken = searchParams.get('token')
    if (urlToken) {
      setToken(urlToken)
      // Auto-verify if token is in URL
      handleVerify(urlToken)
    }
  }, [searchParams])

  const handleVerify = async (verificationToken?: string) => {
    const tokenToVerify = verificationToken || token
    if (!tokenToVerify) {
      setError('Verification token is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: tokenToVerify })
      })

      const data = await response.json()

      if (response.ok) {
        setVerified(true)
        toast.success('Email verified successfully! You can now login after admin approval.')
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } else {
        setError(data.error || 'Failed to verify email')
      }
    } catch (error) {
      console.error('Verification error:', error)
      setError('An error occurred during verification')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleVerify()
  }

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-16 w-16 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Email Verified Successfully!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Your email has been verified. You will be redirected to the login page...
              </p>
              <Button onClick={() => router.push('/login')}>
                Go to Login
              </Button>
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
            <div className="flex items-center space-x-2">
              <Truck className="h-8 w-8 text-blue-600" />
              <Shield className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Verify Email
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter your verification token to verify your email address
          </p>
        </div>

        {/* Verification Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Email Verification</CardTitle>
            <CardDescription className="text-center">
              Please check your email for the verification link or enter the token manually
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
                <Label htmlFor="token">Verification Token</Label>
                <Input
                  id="token"
                  type="text"
                  placeholder="Enter verification token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !token}
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
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Didn't receive the email? Check your spam folder or{' '}
                <button 
                  onClick={() => router.push('/signup')}
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  sign up again
                </button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                Verification Information
              </h3>
              <div className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                <p>• Verification link expires in 24 hours</p>
                <p>• You must verify your email before logging in</p>
                <p>• After verification, your account needs admin approval</p>
                <p>• Check your spam folder if you don't see the email</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
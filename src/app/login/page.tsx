'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { Truck, Shield, Mail, Loader2, Clock, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { TruckLoader } from '@/components/ui/truck-loader'
import Link from 'next/link'

function SearchParamsHandler() {
  const searchParams = useSearchParams()
  
  useEffect(() => {
    // Check for redirect parameter
    const redirect = searchParams.get('redirect')
    if (redirect) {
      localStorage.setItem('redirectAfterLogin', redirect)
    }
  }, [searchParams])
  
  return null
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password')
  const { login, isAuthenticated, isLoading } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()

  // Redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    // Handle OTP cooldown timer
    let timer: NodeJS.Timeout
    if (otpCooldown > 0) {
      timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [otpCooldown])



  const handleRequestOtp = async () => {
    if (otpCooldown > 0) return
    
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
        setOtpRequested(true)
        setOtpCooldown(60) // 60 seconds cooldown
        toast.success('OTP sent to your email!')
      } else {
        setError(data.error || 'Failed to send OTP')
      }
    } catch (error) {
      console.error('OTP request error:', error)
      setError('An error occurred while requesting OTP')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('authToken', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        
        setIsRedirecting(true)
        toast.success('Login successful!')
        
        const redirectPath = localStorage.getItem('redirectAfterLogin') || '/'
        localStorage.removeItem('redirectAfterLogin')
        window.location.href = redirectPath
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const success = await login(email, otp)

      if (success) {
        setIsRedirecting(true)
        toast.success('Login successful!')
        
        const redirectPath = localStorage.getItem('redirectAfterLogin') || '/'
        localStorage.removeItem('redirectAfterLogin')
        window.location.href = redirectPath
      }
    } catch (error: any) {
      console.error('Login error:', error)
      
      if (error.message.includes('verify your email')) {
        setError('Please verify your email address first.')
        setTimeout(() => {
          router.push('/verify-email?email=' + encodeURIComponent(email))
        }, 2000)
      } else if (error.message.includes('pending admin approval')) {
        setError('Your account is pending admin approval.')
        setTimeout(() => {
          router.push('/pending-approval')
        }, 2000)
      } else {
        setError(error.message || 'OTP verification failed')
      }
    } finally {
      setLoading(false)
    }
  }

  // Show loading if auth is loading or redirecting
  if (isLoading || isRedirecting || (!isLoading && isAuthenticated)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <TruckLoader size="md" className="mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            {isRedirecting ? 'Redirecting...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <TruckLoader size="lg" className="mx-auto" />
      </div>
    }>
      <SearchParamsHandler />
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
            {t('auth.welcome')}
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('auth.loginSubtitle')}
          </p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">{t('auth.signIn')}</CardTitle>
            <CardDescription className="text-center">
              Choose your preferred login method
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Login Method Toggle */}
            <div className="flex rounded-lg bg-gray-100 p-1 mb-4">
              <button
                type="button"
                onClick={() => setLoginMethod('password')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  loginMethod === 'password'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🔐 Password
              </button>
              <button
                type="button"
                onClick={() => setLoginMethod('otp')}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  loginMethod === 'otp'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📧 OTP
              </button>
            </div>

            <form onSubmit={loginMethod === 'password' ? handlePasswordLogin : handleOtpLogin} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {loginMethod === 'password' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !email || !password}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In with Password'
                    )}
                  </Button>
                </>
              ) : (
                <>
                  {!otpRequested ? (
                    <Button 
                      type="button" 
                      className="w-full" 
                      disabled={loading || !email || otpCooldown > 0}
                      onClick={handleRequestOtp}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending OTP...
                        </>
                      ) : otpCooldown > 0 ? (
                        <>
                          <Clock className="mr-2 h-4 w-4" />
                          Wait {otpCooldown}s
                        </>
                      ) : (
                        'Send OTP'
                      )}
                    </Button>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="otp">One-Time Password</Label>
                        <Input
                          id="otp"
                          type="text"
                          placeholder="Enter OTP from email"
                          value={otp}
                          onChange={(e) => setOtp(e.target.value)}
                          required
                        />
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={loading || !otp}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          'Verify OTP & Sign In'
                        )}
                      </Button>
                      
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full" 
                        disabled={loading || otpCooldown > 0}
                        onClick={handleRequestOtp}
                      >
                        {otpCooldown > 0 ? (
                          <>
                            <Clock className="mr-2 h-4 w-4" />
                            Resend in {otpCooldown}s
                          </>
                        ) : (
                          'Resend OTP'
                        )}
                      </Button>
                    </>
                  )}
                </>
              )}
            </form>

            <div className="mt-4 text-center space-y-2">
              {loginMethod === 'password' && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <Link 
                    href="/forgot-password"
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Forgot your password?
                  </Link>
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <Link 
                  href="/signup"
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                OTP Authentication
              </h3>
              <div className="space-y-1 text-xs text-blue-700 dark:text-blue-300">
                <p>• Choose between password or OTP login</p>
                <p>• OTP is sent to your registered email address</p>
                <p>• Your account must be verified and approved</p>
                <p>• Contact admin if you have login issues</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </Suspense>
  )
}
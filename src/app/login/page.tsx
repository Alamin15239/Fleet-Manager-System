'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

import { Mail, Loader2, Clock, Lock, Building2 } from 'lucide-react'
import { toast } from '@/lib/localized-toast'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { TruckLoader } from '@/components/ui/truck-loader'
import Link from 'next/link'
import { LegalDocumentLinks } from '@/components/legal-document-links'
import { AuthDivider, GoogleAuthButton } from '@/components/google-auth-button'

const GOOGLE_AUTH_ERROR_KEYS: Record<string, string> = {
  not_configured: 'auth.googleNotConfigured',
  invalid_organization: 'auth.googleInvalidOrganization',
  pending_approval: 'auth.googlePendingApproval',
  account_deleted: 'auth.googleAccountDeleted',
  account_disabled: 'auth.googleAccountDisabled',
  email_unverified: 'auth.googleEmailUnverified',
  cancelled: 'auth.googleCancelled',
  session: 'auth.googleSessionFailed',
  failed: 'auth.googleFailed',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [organizationSlug, setOrganizationSlug] = useState('')
  const [organizationResolved, setOrganizationResolved] = useState(false)
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [googleErrorCode, setGoogleErrorCode] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [otpCooldown, setOtpCooldown] = useState(0)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password')
  const { login, user, isAuthenticated, isLoading } = useAuth()
  const { t } = useLanguage()
  const router = useRouter()
  const switchingOrganization = useRef(false)
  const googleCompletionStarted = useRef(false)
  const googleError = googleErrorCode
    ? t(GOOGLE_AUTH_ERROR_KEYS[googleErrorCode] || 'auth.googleFailed')
    : ''

  // An organization login link is also a workspace switch. Drop the current
  // browser session before rendering its data, then ask for the target org login.
  useEffect(() => {
    if (isLoading || !isAuthenticated || !organizationResolved) return
    if (organizationSlug && user?.organizationSlug !== organizationSlug) {
      if (switchingOrganization.current) return
      switchingOrganization.current = true
      localStorage.removeItem('authToken')
      localStorage.removeItem('user')
      window.location.replace(window.location.href)
      return
    }
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard')
    }
  }, [organizationSlug, organizationResolved, isAuthenticated, isLoading, router, user?.organizationSlug])

  useEffect(() => {
    // Handle OTP cooldown timer
    let timer: NodeJS.Timeout
    if (otpCooldown > 0) {
      timer = setTimeout(() => setOtpCooldown(otpCooldown - 1), 1000)
    }
    return () => clearTimeout(timer)
  }, [otpCooldown])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      setOrganizationSlug(searchParams.get('org') || '')
      const redirect = searchParams.get('redirect')
      if (redirect) localStorage.setItem('redirectAfterLogin', redirect)
      setOrganizationResolved(true)

      const googleStatus = searchParams.get('google')
      if (googleStatus === 'complete' && !googleCompletionStarted.current) {
        googleCompletionStarted.current = true
        setIsRedirecting(true)
        void (async () => {
          try {
            const response = await fetch('/api/auth/google/session', {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
            })
            const data = await response.json()
            if (!response.ok || !data.token || !data.user) {
              setGoogleErrorCode(response.status === 403 ? 'pending_approval' : 'session')
              return
            }

            localStorage.setItem('authToken', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))
            const requestedRedirect = localStorage.getItem('redirectAfterLogin') || '/'
            localStorage.removeItem('redirectAfterLogin')
            const redirectPath = requestedRedirect.startsWith('/') && !requestedRedirect.startsWith('//')
              ? requestedRedirect
              : '/'
            window.location.replace(redirectPath)
          } catch {
            console.error('Could not finish Google sign-in')
            setGoogleErrorCode('session')
          } finally {
            setIsRedirecting(false)
          }
        })()
      } else if (googleStatus) {
        setGoogleErrorCode(googleStatus)
      }
    }
  }, [])



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
        body: JSON.stringify({ email, organizationSlug: organizationSlug || undefined })
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
      const success = await login(email, password, false, organizationSlug || undefined)

      if (success) {
        setIsRedirecting(true)
        toast.success('Login successful!')
        
        const redirectPath = localStorage.getItem('redirectAfterLogin') || '/'
        localStorage.removeItem('redirectAfterLogin')
        window.location.href = redirectPath
      }
    } catch (error: any) {
      console.error('Login error:', error)
      setError(error.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const success = await login(email, otp, true, organizationSlug || undefined)

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
          <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            {t('Sign in to Fleet Manager Pro')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isRedirecting ? 'Redirecting...' : 'Loading...'}
          </p>
        </div>
      </div>
    )
  }

  return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex justify-center">
            <Image src="/fleet-manager-mark.svg" alt="Fleet Manager Pro" width={72} height={72} priority className="h-[4.5rem] w-[4.5rem] rounded-2xl shadow-lg shadow-blue-950/15" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            {t('Sign in to Fleet Manager Pro')}
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
              <LocalizedText>Choose your preferred login method</LocalizedText>
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
              {(error || googleError) && (
                <Alert variant="destructive">
                  <AlertDescription>{error || googleError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="organization"><LocalizedText>Organization code</LocalizedText></Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="organization"
                    placeholder="Use the code provided by your organization"
                    value={organizationSlug}
                    onChange={(e) => setOrganizationSlug(e.target.value.trim().toLowerCase())}
                    className="pl-10"
                    autoComplete="organization"
                  />
                </div>
                <p className="text-xs text-muted-foreground"><LocalizedText>Leave blank for the original Fleet Manager organization.</LocalizedText></p>
              </div>

              <GoogleAuthButton organizationSlug={organizationSlug} flow="login" />
              <AuthDivider />

              <div className="space-y-2">
                <Label htmlFor="email"><LocalizedText>Email</LocalizedText></Label>
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
                    <Label htmlFor="password"><LocalizedText>Password</LocalizedText></Label>
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
                        <Label htmlFor="otp"><LocalizedText>One-Time Password</LocalizedText></Label>
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
                    href={organizationSlug ? `/forgot-password?org=${encodeURIComponent(organizationSlug)}` : '/forgot-password'}
                    className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    <LocalizedText>Forgot your password?</LocalizedText>
                  </Link>
                </p>
              )}
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <Link 
                  href={organizationSlug ? `/signup?org=${encodeURIComponent(organizationSlug)}` : '/signup'}
                  className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <LocalizedText>Sign up</LocalizedText>
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <LegalDocumentLinks />

        {/* Info Card */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="text-center">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                <LocalizedText>OTP Authentication</LocalizedText>
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
  )
}

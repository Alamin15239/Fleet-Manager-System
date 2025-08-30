'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

function VerifyEmailRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/verify-otp')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
    </div>
  )


}

export default function VerifyEmailPage() {
  return <VerifyEmailRedirect />
}
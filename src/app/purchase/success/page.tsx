'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ArrowRight } from 'lucide-react'

export default function PurchaseSuccessPage() {
  const [workspaceCode, setWorkspaceCode] = useState('')
  const router = useRouter()

  function openWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const code = workspaceCode.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-')
    if (code) router.push(`/login?org=${encodeURIComponent(code)}`)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl dark:border-white/10 dark:bg-slate-900 sm:p-12">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><CheckCircle2 className="h-7 w-7" /></div>
        <h1 className="mt-5 text-2xl font-bold">Thank you for your purchase</h1>
        <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">Gumroad is confirming your membership. Your separate organization database and administrator sign-in become available after the verified purchase notification is processed.</p>
        <form onSubmit={openWorkspace} className="mx-auto mt-7 max-w-sm text-left">
          <label className="block text-sm font-medium">Workspace code
            <input required minLength={2} maxLength={48} value={workspaceCode} onChange={event => setWorkspaceCode(event.target.value)} placeholder="your-company" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-950" />
          </label>
          <button type="submit" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">Continue to sign in <ArrowRight className="h-4 w-4" /></button>
        </form>
        <p className="mt-4 text-sm text-slate-500">Use the code you chose on the purchase page. Sign in with the email used at checkout.</p>
      </section>
    </main>
  )
}

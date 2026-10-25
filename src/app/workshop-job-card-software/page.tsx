import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, ClipboardCheck, FileText, Wrench, CheckCircle2 } from 'lucide-react'
import { SeoReveal, SeoStagger, SeoStaggerItem } from '@/components/seo-motion'

const siteUrl = 'https://fleetmaintenance.site'

export const metadata: Metadata = {
  title: 'Workshop Job Card Software for Fleet Repairs | Fleet Manager Pro',
  description: 'Create and manage truck and trailer workshop job cards with reported issues, checklists, work performed, parts, approvals, and printable records.',
  alternates: { canonical: `${siteUrl}/workshop-job-card-software` },
  openGraph: {
    title: 'Workshop Job Card Software for Fleet Repairs | Fleet Manager Pro',
    description: 'Organize fleet repair job cards, workshop checklists, parts used, approvals, and printable maintenance records.',
    url: `${siteUrl}/workshop-job-card-software`,
    siteName: 'Fleet Manager Pro',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

const steps = [
  { icon: ClipboardCheck, title: 'Document the reported issue', text: 'Create a job card linked to a truck or trailer and record the issue or work requested.' },
  { icon: Wrench, title: 'Record workshop work', text: 'Use checklist items and record work performed and parts used as part of the repair record.' },
  { icon: FileText, title: 'Keep a usable record', text: 'Use the available print and PDF options and approval fields to support workshop documentation.' },
]

export default function WorkshopJobCardSoftwarePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50 text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Link href="/" className="font-bold tracking-tight">Fleet Manager Pro</Link>
        <Link href="/signup" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Get started</Link>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pb-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-white/10 dark:bg-white/5 dark:text-emerald-200"><ClipboardCheck className="h-4 w-4" /> Digital workshop records</p>
        <SeoReveal><h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">Workshop job card software for truck and trailer maintenance</h1></SeoReveal>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">Replace scattered repair notes with structured digital job cards. Fleet Manager Pro helps teams document reported problems, checklist items, workshop work, parts, and approvals against the relevant truck or trailer.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">Create an account <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold hover:bg-white dark:border-white/15 dark:hover:bg-white/5">Explore fleet tools</Link>
        </div>
        <SeoStagger className="mt-12 grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }) => <SeoStaggerItem key={title}><article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900"><Icon className="h-6 w-6 text-emerald-700 dark:text-emerald-300" /><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">{text}</p></article></SeoStaggerItem>)}
        </SeoStagger>
        <SeoReveal><section className="mt-14 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-white/[0.03]">
          <h2 className="text-2xl font-bold">Keep repair history connected to the vehicle</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">A job card is more useful when the team can find it alongside the vehicle's maintenance history. Link workshop documentation to fleet operations so maintenance staff and managers have a clearer record of reported issues and completed work.</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {['Vehicle-linked repair records', 'Checklist and work details', 'Parts and approval fields', 'Print and PDF options'].map((item) => <li key={item} className="flex gap-3 leading-7 text-slate-700 dark:text-slate-200"><CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />{item}</li>)}
          </ul>
        </section></SeoReveal>
        <section className="mt-14">
          <h2 className="text-2xl font-bold">Part of a fleet maintenance workspace</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">Fleet Manager Pro combines workshop job cards with truck and trailer records, tire management, oil changes, vehicle document reminders, and fleet reports. This helps transport teams keep routine service and repair information in one place.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-blue-700 dark:text-blue-300">
            <Link href="/truck-fleet-maintenance-software" className="underline underline-offset-4">Truck fleet maintenance</Link>
            <Link href="/tire-inventory-management" className="underline underline-offset-4">Tire inventory management</Link>
          </div>
        </section>
      </section>
      <footer className="border-t border-slate-200 px-5 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">Fleet Manager Pro · Workshop job card software</footer>
    </main>
  )
}

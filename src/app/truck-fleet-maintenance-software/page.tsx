import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Truck, Wrench, ClipboardCheck, BarChart3 } from 'lucide-react'
import { SeoReveal, SeoStagger, SeoStaggerItem } from '@/components/seo-motion'
import { WebsiteLaunchBadge } from '@/components/website-launch-badge'

const siteUrl = 'https://fleetmaintenance.site'

export const metadata: Metadata = {
  title: 'Truck Fleet Maintenance Software | Fleet Manager Pro',
  description: 'Organize truck and trailer service history, preventive maintenance, workshop job cards, breakdown records, and fleet reports with Fleet Manager Pro.',
  alternates: { canonical: `${siteUrl}/truck-fleet-maintenance-software` },
  openGraph: {
    title: 'Truck Fleet Maintenance Software | Fleet Manager Pro',
    description: 'Manage truck and trailer maintenance records, job cards, service history, and fleet reports in one workspace.',
    url: `${siteUrl}/truck-fleet-maintenance-software`,
    siteName: 'Fleet Manager Pro',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

const benefits = [
  'Keep truck and trailer details, mileage, assignments, and service history together.',
  'Record workshop jobs, reported problems, work performed, and parts used.',
  'Track tire activity and oil changes alongside vehicle maintenance records.',
  'Review maintenance activity, expenses, and fleet reports to support operational decisions.',
  'Keep vehicle and driver document expiry dates visible with reminders.',
]

export default function TruckFleetMaintenanceSoftwarePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50 text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Link href="/" className="font-bold tracking-tight">Fleet Manager Pro</Link>
        <Link href="/signup" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Get started</Link>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pb-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 dark:border-white/10 dark:bg-white/5 dark:text-blue-200"><Truck className="h-4 w-4" /> Fleet maintenance for transport teams</p>
        <SeoReveal><h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">Truck fleet maintenance software for trucks and trailers</h1></SeoReveal>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">Fleet Manager Pro gives transport operators and workshop teams one place to organize vehicle records, service history, preventive maintenance, repair job cards, tire records, oil changes, and fleet reports.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">Create an account <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/purchase" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold hover:bg-white dark:border-white/15 dark:hover:bg-white/5">View plans</Link>
        </div>
        <SeoStagger className="mt-12 grid gap-4 sm:grid-cols-2">
          {[
            { icon: Truck, title: 'Truck and trailer records', text: 'Keep vehicle details, mileage, operating status, and service history organized by vehicle.' },
            { icon: Wrench, title: 'Maintenance and repair tracking', text: 'Record maintenance work and follow upcoming or overdue service tasks.' },
            { icon: ClipboardCheck, title: 'Workshop job cards', text: 'Document reported issues, checklists, work performed, parts, and approvals.' },
            { icon: BarChart3, title: 'Fleet reports', text: 'Review maintenance activity and fleet expenses through available reports and analytics.' },
          ].map(({ icon: Icon, title, text }) => <SeoStaggerItem key={title}><article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900"><Icon className="h-6 w-6 text-blue-700 dark:text-blue-300" /><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">{text}</p></article></SeoStaggerItem>)}
        </SeoStagger>
        <SeoReveal><section className="mt-14 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-white/[0.03]">
          <h2 className="text-2xl font-bold">What can your team organize?</h2>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {benefits.map((benefit) => <li key={benefit} className="flex gap-3 leading-7 text-slate-700 dark:text-slate-200"><CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-600" />{benefit}</li>)}
          </ul>
        </section></SeoReveal>
        <section className="mt-14">
          <h2 className="text-2xl font-bold">Fleet maintenance software for Saudi and international operators</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">Whether you manage a transport fleet, logistics operation, or an in-house workshop, organized maintenance records help your team see vehicle history and keep service information accessible. Fleet Manager Pro supports English and Arabic interfaces.</p>
          <h2 className="mt-8 text-2xl font-bold">Related fleet tools</h2>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-blue-700 dark:text-blue-300">
            <Link href="/tire-inventory-management" className="underline underline-offset-4">Tire inventory management</Link>
            <Link href="/workshop-job-card-software" className="underline underline-offset-4">Workshop job card software</Link>
            <Link href="/" className="underline underline-offset-4">All fleet management features</Link>
          </div>
        </section>
      </section>
      <footer className="border-t border-slate-200 px-5 py-6 dark:border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400 sm:flex-row">
          <span>Fleet Manager Pro · Truck and trailer fleet maintenance software</span>
          <WebsiteLaunchBadge />
          <nav aria-label="Public site links" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <Link href="/" className="hover:text-blue-700 dark:hover:text-blue-300">Home</Link>
            <Link href="/help" className="hover:text-blue-700 dark:hover:text-blue-300">Help</Link>
            <Link href="/privacy" className="hover:text-blue-700 dark:hover:text-blue-300">Privacy</Link>
            <Link href="/agreement" className="hover:text-blue-700 dark:hover:text-blue-300">User agreement</Link>
          </nav>
        </div>
      </footer>
    </main>
  )
}

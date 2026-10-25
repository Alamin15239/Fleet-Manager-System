import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, CircleDot, ClipboardList, Truck, History } from 'lucide-react'

const siteUrl = 'https://fleetmaintenance.site'

export const metadata: Metadata = {
  title: 'Fleet Tire Inventory Management Software | Fleet Manager Pro',
  description: 'Track truck tire serial numbers, sizes, issue dates, drivers, and vehicle assignments with tire management tools built for fleet maintenance teams.',
  alternates: { canonical: `${siteUrl}/tire-inventory-management` },
  openGraph: {
    title: 'Fleet Tire Inventory Management Software | Fleet Manager Pro',
    description: 'Keep tire records, serial numbers, vehicle assignments, drivers, and issue dates organized for your fleet.',
    url: `${siteUrl}/tire-inventory-management`,
    siteName: 'Fleet Manager Pro',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

const features = [
  { icon: CircleDot, title: 'Tire identification', text: 'Record tire serial numbers and sizes so each tire entry can be traced in your records.' },
  { icon: Truck, title: 'Vehicle and driver assignment', text: 'Associate tire issue records with the relevant vehicle, driver, and issue date.' },
  { icon: ClipboardList, title: 'Tire issue history', text: 'Keep tire issue and return activity available for fleet maintenance follow-up.' },
  { icon: History, title: 'Maintenance context', text: 'Review tire activity alongside your wider truck, trailer, and workshop maintenance records.' },
]

export default function TireInventoryManagementPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-sky-50 text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Link href="/" className="font-bold tracking-tight">Fleet Manager Pro</Link>
        <Link href="/signup" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">Get started</Link>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-10 sm:px-8 sm:pb-20">
        <p className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-2 text-sm font-semibold text-orange-800 dark:border-white/10 dark:bg-white/5 dark:text-orange-200"><CircleDot className="h-4 w-4" /> Tire records for fleet teams</p>
        <h1 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">Tire inventory management software for truck fleets</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 dark:text-slate-300">Fleet Manager Pro helps maintenance teams keep tire records organized by serial number, size, vehicle, driver, and issue date. Use these records to improve traceability when tires are issued or moved between fleet vehicles.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">Get started <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold hover:bg-white dark:border-white/15 dark:hover:bg-white/5">Explore all features</Link>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900"><Icon className="h-6 w-6 text-orange-700 dark:text-orange-300" /><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-2 leading-7 text-slate-600 dark:text-slate-300">{text}</p></article>)}
        </div>
        <section className="mt-14 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-white/[0.03]">
          <h2 className="text-2xl font-bold">What tire information can you keep?</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">Use the available tire management records to keep serial number, tire size, vehicle registration, driver, and issue date together. Recording this information consistently makes it easier to review tire history and identify which vehicle a tire was assigned to.</p>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">The goal is a clearer maintenance record—not a claim that the system automatically measures tire wear or predicts tire failure.</p>
        </section>
        <section className="mt-14">
          <h2 className="text-2xl font-bold">Connect tire records with fleet maintenance</h2>
          <p className="mt-4 max-w-3xl leading-7 text-slate-600 dark:text-slate-300">Tire records are most useful when your team can refer to the related truck or trailer and its maintenance history. Fleet Manager Pro brings tire activity into the same fleet workspace as vehicle records, job cards, oil changes, and reports.</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-blue-700 dark:text-blue-300">
            <Link href="/truck-fleet-maintenance-software" className="underline underline-offset-4">Truck fleet maintenance</Link>
            <Link href="/workshop-job-card-software" className="underline underline-offset-4">Workshop job cards</Link>
          </div>
        </section>
      </section>
      <footer className="border-t border-slate-200 px-5 py-6 text-center text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">Fleet Manager Pro · Fleet tire inventory management</footer>
    </main>
  )
}

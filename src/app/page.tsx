import Image from 'next/image'
import Link from 'next/link'
import { HomeDashboardRedirect } from '@/components/home-dashboard-redirect'
import { WebsiteLaunchBadge } from '@/components/website-launch-badge'
import type { Metadata } from 'next'
import {
  ArrowRight,
  BarChart3,
  CircleDot,
  ClipboardCheck,
  Droplets,
  FileText,
  ShieldCheck,
  Truck,
  Wrench,
} from 'lucide-react'

const siteUrl = 'https://fleetmaintenance.site'

export const metadata: Metadata = {
  title: 'Fleet Maintenance Software for Trucks & Trailers | Fleet Manager Pro',
  description:
    'Manage truck and trailer maintenance, workshop job cards, tire records, oil changes, vehicle documents, expenses, and fleet reports in one fleet maintenance system for transport teams.',
  keywords: [
    'fleet maintenance software',
    'fleet management software',
    'fleet management software Saudi Arabia',
    'fleet maintenance software Saudi Arabia',
    'fleet maintenance software KSA',
    'fleet management system for logistics companies',
    'fleet management software for transport companies',
    'truck fleet maintenance system',
    'truck maintenance software Saudi Arabia',
    'truck and trailer fleet management software',
    'trailer fleet management software',
    'vehicle maintenance tracking software',
    'preventive fleet maintenance software',
    'fleet breakdown tracking system',
    'workshop job card software',
    'vehicle repair job card management',
    'fleet tire management software',
    'truck tire inventory management software',
    'fleet tyre inventory management',
    'fleet oil change tracking',
    'fleet expense and invoice management',
    'fleet maintenance reports and analytics',
    'Excel fleet maintenance management',
    'OneDrive fleet management integration',
    'vehicle document expiry reminders',
    'fleet operations software',
    'برنامج إدارة الأسطول',
    'برنامج إدارة أسطول الشاحنات',
    'برنامج إدارة صيانة الأسطول',
    'برنامج صيانة الشاحنات',
    'برنامج صيانة المركبات',
    'نظام إدارة صيانة المركبات',
  ],
  alternates: { canonical: siteUrl },
  openGraph: {
    title: 'Fleet Maintenance Software for Trucks & Trailers | Fleet Manager Pro',
    description:
      'Track truck and trailer service history, workshop job cards, tire records, oil changes, document reminders, expenses, and fleet reports with Fleet Manager Pro.',
    url: siteUrl,
    siteName: 'Fleet Manager Pro',
    type: 'website',
    images: [{ url: '/logo.svg', width: 1200, height: 630, alt: 'Fleet Manager Pro' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fleet Maintenance Software for Trucks & Trailers | Fleet Manager Pro',
    description: 'Manage truck and trailer maintenance, job cards, tire records, oil changes, vehicle documents, expenses, and fleet reports.',
    images: ['/logo.svg'],
  },
  robots: { index: true, follow: true },
}

const siteStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': siteUrl + '/#organization',
      name: 'Fleet Manager Pro',
      url: siteUrl,
      logo: siteUrl + '/fleet-manager-mark.svg',
      email: 'alaminkhan.xiaomi@gmail.com',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'alaminkhan.xiaomi@gmail.com',
        contactType: 'customer support',
        availableLanguage: ['English', 'Arabic'],
      },
      description:
        'Fleet maintenance and operations software for transport teams to manage trucks, trailers, workshop job cards, tire and tyre records, oil changes, vehicle document expiry, and fleet expenses.',
    },
    {
      '@type': 'WebSite',
      '@id': siteUrl + '/#website',
      name: 'Fleet Manager Pro',
      url: siteUrl,
      inLanguage: ['en', 'ar'],
      publisher: { '@id': siteUrl + '/#organization' },
    },
    {
      '@type': 'WebPage',
      '@id': siteUrl + '/#webpage',
      name: 'Fleet Maintenance Software for Trucks and Trailers',
      url: siteUrl,
      description:
        'Fleet maintenance software for truck and trailer fleets, with workshop job cards, tire and tyre management, oil change tracking, document expiry reminders, invoices, and reports.',
      isPartOf: { '@id': siteUrl + '/#website' },
      about: { '@id': siteUrl + '/#organization' },
      inLanguage: 'en',
    },
  ],
}

const features = [
  {
    icon: Truck,
    title: 'Truck and trailer records',
    description:
      'Keep vehicle details, assignments, mileage, service history, and operating status together for each unit.',
    color: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-400/10',
  },
  {
    icon: Wrench,
    title: 'Preventive maintenance',
    description:
      'Schedule service, follow maintenance status, record work performed, and spot upcoming or overdue jobs.',
    color: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-400/10',
  },
  {
    icon: ClipboardCheck,
    title: 'Workshop job cards',
    description:
      'Create structured job cards with vehicle details, reported issues, checklist items, parts, and approvals.',
    color: 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-400/10',
  },
  {
    icon: CircleDot,
    title: 'Tire management',
    description:
      'Record tire size, serial number, vehicle, driver, quantity, and date for traceable tire activity.',
    color: 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-400/10',
  },
  {
    icon: Droplets,
    title: 'Oil and filter changes',
    description:
      'Track oil service against vehicles and mileage to keep service history available to the team.',
    color: 'text-cyan-700 bg-cyan-100 dark:text-cyan-300 dark:bg-cyan-400/10',
  },
  {
    icon: FileText,
    title: 'Invoices and fleet reports',
    description:
      'Assign maintenance and parts expenses to a truck or trailer, separate VAT, and generate fleet cost reports.',
    color: 'text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-400/10',
  },
  {
    icon: ShieldCheck,
    title: 'Vehicle document expiry reminders',
    description:
      'Track important vehicle and driver document dates and see upcoming expiry reminders in one place.',
    color: 'text-teal-700 bg-teal-100 dark:text-teal-300 dark:bg-teal-400/10',
  },
  {
    icon: BarChart3,
    title: 'Fleet data and Excel sync',
    description:
      'Connect a OneDrive workbook, sync fleet records, and review workbook changes before applying them.',
    color: 'text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-400/10',
  },
]

const faqs = [
  {
    question: 'What does fleet maintenance software help a team manage?',
    answer:
      'It keeps vehicle records, maintenance history, workshop job cards, tire and tyre activity, oil changes, document expiry dates, and vehicle expenses organized for the team.',
  },
  {
    question: 'Can Fleet Manager Pro manage both trucks and trailers?',
    answer:
      'Yes. Teams can maintain separate truck and trailer records and assign relevant service and expense entries to the correct vehicle.',
  },
  {
    question: 'Can I track fleet maintenance costs and VAT?',
    answer:
      'Purchase invoices can assign expense lines to trucks or trailers and record VAT separately for VAT invoices. Reports help review fleet and maintenance activity.',
  },
  {
    question: 'Does Fleet Manager Pro support Arabic and English?',
    answer:
      'The app supports English and Arabic. Teams can use the fleet workspace and available tools in either language.',
  },
]

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-sky-50 text-slate-950 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-50">
      <HomeDashboardRedirect />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(siteStructuredData).replace(/</g, '\\u003c'),
        }}
      />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Fleet Manager Pro home">
          <Image src="/fleet-manager-mark.svg" alt="" width={44} height={44} priority />
          <span className="text-base font-bold tracking-tight sm:text-lg">Fleet Manager Pro</span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-2 sm:gap-5">
          <a className="hidden text-sm font-medium text-slate-600 hover:text-blue-700 dark:text-slate-300 sm:inline" href="#features">Features</a>
          <Link
            href="/login"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800"
          >
            Get started
          </Link>
          <Link
            href="/purchase"
            className="hidden rounded-xl border border-blue-200 bg-white/70 px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-blue-200 sm:inline-flex"
          >
            Plans
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[1.08fr_.92fr] lg:gap-14">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-white/75 px-3.5 py-2 text-xs font-semibold text-blue-800 shadow-sm backdrop-blur dark:border-blue-300/15 dark:bg-white/5 dark:text-blue-200 sm:text-sm">
            <Truck className="h-4 w-4" />
            Fleet maintenance software for transport teams
          </div>
          <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Fleet maintenance software for trucks, trailers, and transport teams
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg sm:leading-8">
            Track truck and trailer service history, preventive maintenance, workshop job cards, tire records, oil changes, vehicle documents, and fleet expenses in one organized workspace. Fleet Manager Pro helps transport teams keep maintenance records and reports together.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white shadow-xl shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-blue-800"
            >
              Start managing your fleet <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white/75 px-6 py-3 font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              Sign in to your workspace
            </Link>
            <Link
              href="/purchase"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-200 bg-white/75 px-6 py-3 font-semibold text-blue-800 shadow-sm backdrop-blur transition hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-blue-200 dark:hover:bg-white/10"
            >
              View plans and request a workspace
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Available in English and Arabic, with separate workspaces for organizations.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-br from-blue-300/35 via-cyan-200/20 to-emerald-200/25 blur-3xl dark:from-blue-500/15 dark:via-cyan-400/10 dark:to-emerald-400/10" />
          <div className="relative rounded-[2rem] border border-white/80 bg-white/75 p-5 shadow-2xl shadow-slate-900/10 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/75 sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
              <div>
                <p className="text-sm font-semibold">Fleet overview</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your fleet activity in one workspace</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-300">Fleet operations</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/5">
                <Truck className="h-5 w-5 text-blue-700 dark:text-blue-300" />
                <p className="mt-4 text-sm font-semibold">Vehicles</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Trucks and trailers</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/5">
                <Wrench className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                <p className="mt-4 text-sm font-semibold">Maintenance</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Schedules and work</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/5">
                <CircleDot className="h-5 w-5 text-orange-700 dark:text-orange-300" />
                <p className="mt-4 text-sm font-semibold">Tires and service</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Traceable records</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-white/5">
                <BarChart3 className="h-5 w-5 text-violet-700 dark:text-violet-300" />
                <p className="mt-4 text-sm font-semibold">Reports</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Fleet and cost insights</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-blue-50 p-4 dark:bg-blue-400/10">
              <ShieldCheck className="h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />
              <p className="text-xs leading-5 text-slate-700 dark:text-slate-200">
                Role permissions help keep each workspace’s fleet data under its organization’s control.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-slate-200/70 bg-white/55 py-16 dark:border-white/10 dark:bg-white/[0.02] sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Fleet tools, connected</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Fleet maintenance and operations in one system</h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
              Keep everyday fleet records connected to service work, vehicle costs, and reporting.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description, color }) => (
              <article key={title} className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-slate-900/70">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="fleet-solutions-heading" className="border-y border-slate-200/70 bg-sky-50/70 py-16 dark:border-white/10 dark:bg-white/[0.02] sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Explore fleet solutions</p>
            <h2 id="fleet-solutions-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Tools for the work your fleet team does every day</h2>
            <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">Learn how Fleet Manager Pro helps organize maintenance work, tire records, and workshop job cards.</p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            <Link href="/truck-fleet-maintenance-software" className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-slate-900">
              <h3 className="text-lg font-semibold group-hover:text-blue-700 dark:group-hover:text-blue-300">Truck fleet maintenance software</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Organize vehicle service history, preventive maintenance, breakdown records, and fleet reports.</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Explore maintenance <ArrowRight className="h-4 w-4" /></span>
            </Link>
            <Link href="/tire-inventory-management" className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-slate-900">
              <h3 className="text-lg font-semibold group-hover:text-blue-700 dark:group-hover:text-blue-300">Tire inventory management</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Keep tire serial numbers, sizes, vehicle assignments, drivers, and issue dates traceable.</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Explore tire tracking <ArrowRight className="h-4 w-4" /></span>
            </Link>
            <Link href="/workshop-job-card-software" className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-white/10 dark:bg-slate-900">
              <h3 className="text-lg font-semibold group-hover:text-blue-700 dark:group-hover:text-blue-300">Workshop job card software</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Record reported issues, checklist items, work performed, parts, and approvals for repairs.</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">Explore job cards <ArrowRight className="h-4 w-4" /></span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Built for daily fleet work</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Know what each vehicle needs and what it costs</h2>
          <p className="mt-4 leading-7 text-slate-600 dark:text-slate-300">
            Give your operations and workshop teams a shared place to update truck and trailer details,
            document repairs, follow service intervals, manage tire records, and review maintenance spending.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            'Vehicle-specific service history',
            'Maintenance reports and analytics',
            'Vendor invoices with VAT breakdown',
            'Workbook updates through OneDrive sync',
            'Role-based access for team members',
            'Separate fleet workspaces by organization',
          ].map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
              <span className="text-sm font-medium leading-6">{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section lang="ar" dir="rtl" className="border-y border-blue-100 bg-blue-50/70 py-14 dark:border-white/10 dark:bg-blue-400/[0.04]">
        <div className="mx-auto max-w-5xl px-5 text-center sm:px-8">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">إدارة أسطول المركبات وصيانتها</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">نظام إدارة الأسطول وصيانة الشاحنات والمقطورات</h2>
          <p className="mx-auto mt-4 max-w-3xl leading-8 text-slate-700 dark:text-slate-200">
            يساعد Fleet Manager Pro شركات النقل والورش على إدارة أسطول الشاحنات والمقطورات، ومتابعة صيانة المركبات
            وبطاقات العمل، وإدارة الإطارات والزيوت والفلاتر، ومراقبة انتهاء صلاحية المستندات، والفواتير والتقارير في مكان واحد.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="rounded-[2rem] bg-gradient-to-br from-blue-800 to-slate-900 px-6 py-10 text-white shadow-2xl shadow-blue-950/20 sm:px-12 sm:py-14">
          <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Bring your fleet records together</h2>
              <p className="mt-3 max-w-2xl leading-7 text-blue-100">
                Start with a dedicated organization workspace for your trucks, trailers, maintenance, and team.
              </p>
            </div>
            <Link href="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-blue-900 transition hover:bg-blue-50">
              Create an account <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="fleet-faq-heading" className="border-y border-slate-200/70 bg-white/55 py-16 dark:border-white/10 dark:bg-white/[0.02] sm:py-20">
        <div className="mx-auto max-w-4xl px-5 sm:px-8">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Fleet management questions</p>
            <h2 id="fleet-faq-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Fleet maintenance software for everyday operations</h2>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2">
            {faqs.map(({ question, answer }) => (
              <article key={question} className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
                <h3 className="font-semibold">{question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/70 px-5 py-8 dark:border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Image src="/fleet-manager-mark.svg" alt="" width={28} height={28} />
            <span>Fleet Manager Pro · Fleet maintenance software</span>
          </div>
          <WebsiteLaunchBadge />
          <nav aria-label="Legal and help links" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/help" className="hover:text-blue-700 dark:hover:text-blue-300">User guide</Link>
            <Link href="/privacy" className="hover:text-blue-700 dark:hover:text-blue-300">Privacy</Link>
            <Link href="/agreement" className="hover:text-blue-700 dark:hover:text-blue-300">User agreement</Link>
            <Link href="/login" className="hover:text-blue-700 dark:hover:text-blue-300">Sign in</Link>
          </nav>
        </div>
      </footer>
    </main>
  )
}

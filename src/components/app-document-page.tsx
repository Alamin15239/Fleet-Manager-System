'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, ArrowRight, BookOpen, FileText, ShieldCheck } from 'lucide-react'
import { useLanguage } from '@/contexts/language-context'

export type DocumentSection = {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  links?: { href: string; label: string }[]
}

export type DocumentCopy = {
  title: string
  subtitle: string
  updatedLabel: string
  contentsLabel: string
  sections: DocumentSection[]
}

type Props = {
  english: DocumentCopy
  arabic: DocumentCopy
  icon: LucideIcon
  showContents?: boolean
}

const navigation = {
  en: [
    { href: '/help', label: 'User guide', icon: BookOpen },
    { href: '/privacy', label: 'Privacy policy', icon: ShieldCheck },
    { href: '/agreement', label: 'User agreement', icon: FileText },
  ],
  ar: [
    { href: '/help', label: 'دليل المستخدم', icon: BookOpen },
    { href: '/privacy', label: 'سياسة الخصوصية', icon: ShieldCheck },
    { href: '/agreement', label: 'اتفاقية المستخدم', icon: FileText },
  ],
}

export function AppDocumentPage({ english, arabic, icon: Icon, showContents = true }: Props) {
  const { language } = useLanguage()
  const pathname = usePathname()
  const isArabic = language === 'ar'
  const copy = isArabic ? arabic : english
  const links = navigation[language]

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="min-h-full px-4 py-6 sm:px-6 lg:px-8">
      <article className="mx-auto max-w-5xl space-y-6 pb-10">
        <nav aria-label={isArabic ? 'مستندات التطبيق' : 'App documents'} className="flex flex-wrap gap-2">
          {links.map(({ href, label, icon: LinkIcon }) => (
            <Link
              key={href}
              href={href}
              aria-current={href === pathname ? 'page' : undefined}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              <LinkIcon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <header className="overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-sm sm:p-9">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3">
              <Icon className="h-7 w-7 text-sky-300" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
                {copy.updatedLabel}: {isArabic ? '17 أكتوبر 2026' : '17 October 2026'}
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-4xl">{copy.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 sm:text-base">{copy.subtitle}</p>
            </div>
          </div>
        </header>

        {showContents && (
          <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6" aria-label={copy.contentsLabel}>
            <h2 className="text-sm font-semibold text-foreground">{copy.contentsLabel}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {copy.sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground">
                  {section.title}
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="space-y-4">
          {copy.sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-sm font-bold text-blue-700 dark:text-blue-300">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold tracking-tight sm:text-xl">{section.title}</h2>
                  {section.paragraphs?.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex} className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">{paragraph}</p>
                  ))}
                  {section.bullets && (
                    <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-7 text-muted-foreground sm:text-base">
                      {section.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}
                    </ul>
                  )}
                  {section.links && (
                    <ul className="mt-3 space-y-2 text-sm">
                      {section.links.map((link) => (
                        <li key={link.href}><a href={link.href} target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline underline-offset-4 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200">{link.label}</a></li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>

        <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-medium transition hover:bg-accent">
          {isArabic ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : <ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          {isArabic ? 'العودة إلى لوحة التحكم' : 'Back to the dashboard'}
        </Link>
      </article>
    </div>
  )
}

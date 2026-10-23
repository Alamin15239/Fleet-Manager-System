import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fleet Maintenance Software Login | Fleet Manager Pro',
  description:
    'Sign in to Fleet Manager Pro to access your truck and trailer fleet maintenance workspace, job cards, service records, and reports.',
  alternates: { canonical: 'https://fleetmaintenance.site/login' },
}

export default function LoginLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children
}

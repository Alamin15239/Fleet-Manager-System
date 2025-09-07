'use client'

import { PageHeader } from '@/components/page-header'

export default function JobCardsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        titleKey="Job Cards Management" 
        subtitleKey="Manage and track maintenance job cards"
      />
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold mb-4">Job Cards Feature</h2>
        <p className="text-gray-600">Job Cards system is now available!</p>
        <p className="text-sm text-gray-500 mt-2">API endpoints and database are ready.</p>
      </div>
    </div>
  )
}
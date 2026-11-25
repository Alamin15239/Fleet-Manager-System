import { LocalizedText } from '@/components/localized-text'
import dynamic from 'next/dynamic'
import { FileText, Loader2 } from 'lucide-react'
import { JobCardBulkUpload } from '@/components/job-card-bulk-upload'

const WorkshopJobCards = dynamic(() => import('@/components/workshop-job-cards'), {
  loading: () => <div role="status" className="flex min-h-[50vh] items-center justify-center gap-2 rounded-2xl border bg-muted/30 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><LocalizedText>Loading...</LocalizedText></div>,
})

export default function JobCardsPage() {
  return <main className="container mx-auto max-w-[1600px] space-y-6 p-3 sm:p-5 lg:p-7">
    <header className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><FileText className="h-4 w-4"/> Fleet maintenance</div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl"><LocalizedText>Workshop Job Cards · بطاقات أوامر العمل</LocalizedText></h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground"><LocalizedText>Central register for workshop visits, linked maintenance activities, approvals and service history.</LocalizedText></p>
      </div>
      <div className="text-xs text-muted-foreground">Workshop / Job Cards</div>
    </header>
    <JobCardBulkUpload />
    <WorkshopJobCards />
  </main>
}

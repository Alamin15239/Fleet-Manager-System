import { LocalizedText } from '@/components/localized-text'
import dynamic from 'next/dynamic'
import { FileText } from 'lucide-react'

const WorkshopJobCards = dynamic(() => import('@/components/workshop-job-cards'), {
  loading: () => <div aria-hidden="true" className="min-h-[50vh] animate-pulse rounded-2xl border bg-muted/30" />,
})

export default function JobCardsPage() {
  return <div className="container mx-auto space-y-6 p-4 sm:p-6">
    <header><h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"><FileText className="h-7 w-7 text-primary"/><LocalizedText>Workshop Job Cards · بطاقات أوامر العمل</LocalizedText></h1><p className="mt-1 text-sm text-muted-foreground"><LocalizedText>Create and manage bilingual workshop job cards</LocalizedText></p></header>
    <WorkshopJobCards />
  </div>
}

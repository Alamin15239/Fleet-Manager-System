import WorkshopJobCards from '@/components/workshop-job-cards'
import { FileText } from 'lucide-react'

export default function JobCardsPage() {
  return <div className="container mx-auto space-y-6 p-4 sm:p-6">
    <header><h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"><FileText className="h-7 w-7 text-primary"/>Workshop Job Cards · بطاقات أوامر العمل</h1><p className="mt-1 text-sm text-muted-foreground">Create and manage bilingual workshop job cards</p></header>
    <WorkshopJobCards />
  </div>
}

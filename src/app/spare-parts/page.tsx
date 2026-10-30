import { SparePartsInventory } from '@/components/spare-parts-inventory'
import { LocalizedText } from '@/components/localized-text'
import { Boxes } from 'lucide-react'

export default function SparePartsPage() {
  return <main className="container mx-auto space-y-6 p-4 sm:p-6">
    <header><h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl"><Boxes className="h-7 w-7 text-primary" /><LocalizedText>Spare Parts & Consumables</LocalizedText></h1>
    <p className="mt-1 text-sm text-muted-foreground"><LocalizedText>Stock balances, receipts, issues, returns and a searchable transaction ledger</LocalizedText></p></header>
    <SparePartsInventory />
  </main>
}

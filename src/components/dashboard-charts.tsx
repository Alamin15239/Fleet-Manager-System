'use client'

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

interface DashboardChartsProps {
  monthlyCostData: { month: string; cost: number }[]
  maintenanceTypeData: { type: string; count: number }[]
  monthlyTitle: string
  monthlyDescription: string
  typesTitle: string
  typesDescription: string
}

export default function DashboardCharts({
  monthlyCostData,
  maintenanceTypeData,
  monthlyTitle,
  monthlyDescription,
  typesTitle,
  typesDescription,
}: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-7">
      <Card className="min-w-0 xl:col-span-4">
        <CardHeader>
          <CardTitle>{monthlyTitle}</CardTitle>
          <CardDescription>{monthlyDescription}</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <ChartContainer config={{}} className="h-[260px] sm:h-[300px]">
            <LineChart data={monthlyCostData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="cost" stroke="#8884d8" strokeWidth={2} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="min-w-0 xl:col-span-3">
        <CardHeader>
          <CardTitle>{typesTitle}</CardTitle>
          <CardDescription>{typesDescription}</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <ChartContainer config={{}} className="h-[260px] sm:h-[300px]">
            <BarChart data={maintenanceTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="#82ca9d" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}

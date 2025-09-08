'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

interface QuickStatsProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  trend?: {
    value: number
    label: string
    direction: 'up' | 'down' | 'neutral'
  }
  progress?: {
    value: number
    max: number
    color?: string
  }
  color?: string
  onClick?: () => void
}

export function QuickStats({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  progress,
  color = 'text-muted-foreground',
  onClick 
}: QuickStatsProps) {
  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up': return <ArrowUp className="h-3 w-3" />
      case 'down': return <ArrowDown className="h-3 w-3" />
      default: return <Minus className="h-3 w-3" />
    }
  }

  const getTrendColor = (direction: string) => {
    switch (direction) {
      case 'up': return 'text-green-600 bg-green-100'
      case 'down': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <Card 
      className={`transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-105' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={color}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-1">{value}</div>
        
        {subtitle && (
          <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>
        )}
        
        {trend && (
          <div className="flex items-center gap-2 mb-2">
            <Badge 
              variant="secondary" 
              className={`text-xs px-2 py-1 ${getTrendColor(trend.direction)}`}
            >
              {getTrendIcon(trend.direction)}
              <span className="ml-1">{trend.value}%</span>
            </Badge>
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          </div>
        )}
        
        {progress && (
          <div className="space-y-1">
            <Progress 
              value={(progress.value / progress.max) * 100} 
              className="h-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.value}</span>
              <span>{progress.max}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
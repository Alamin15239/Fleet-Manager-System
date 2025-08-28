import { db } from './db'

interface AnalyticsTimeSeries {
  period: string
  value: number
  count: number
}

interface AnalyticsComparison {
  currentPeriod: number
  previousPeriod: number
  change: number
  changePercent: number
}

interface MaintenanceAnalytics {
  totalCost: number
  totalRecords: number
  averageCostPerRecord: number
  costByType: Record<string, number>
  costByMonth: AnalyticsTimeSeries[]
  downtimeAnalysis: {
    totalDowntime: number
    averageDowntimePerRecord: number
    downtimeByReason: Record<string, number>
  }
  predictiveAccuracy: {
    totalPredictions: number
    accuratePredictions: number
    accuracyRate: number
    accuracyByType: Record<string, { total: number; accurate: number; rate: number }>
  }
}

interface FleetAnalytics {
  totalTrucks: number
  activeTrucks: number
  averageHealthScore: number
  healthDistribution: Record<string, number>
  riskDistribution: Record<string, number>
  utilization: {
    averageUtilization: number
    utilizationByTruck: Record<string, number>
  }
  costPerMile: number
  totalMileage: number
}

interface FinancialAnalytics {
  totalMaintenanceCost: number
  totalFuelCost: number
  totalLaborCost: number
  totalPartsCost: number
  costPerTruck: number
  costPerMile: number
  costTrends: AnalyticsTimeSeries[]
  budgetVariance: {
    budgeted: number
    actual: number
    variance: number
    variancePercent: number
  }
  roi: {
    maintenanceInvestment: number
    savingsFromPrevention: number
    roi: number
  }
}

export class AdvancedAnalyticsEngine {
  /**
   * Generate comprehensive maintenance analytics
   */
  static async getMaintenanceAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<MaintenanceAnalytics> {
    try {
      const dateFilter: any = {}
      if (startDate || endDate) {
        dateFilter.datePerformed = {}
        if (startDate) dateFilter.datePerformed.gte = startDate
        if (endDate) dateFilter.datePerformed.lte = endDate
      }

      const [records, totalCostResult, totalCountResult] = await Promise.all([
        db.maintenanceRecord.findMany({
          where: { ...dateFilter, isDeleted: false },
          include: {
            truck: {
              select: { make: true, model: true, licensePlate: true }
            }
          }
        }),
        db.maintenanceRecord.aggregate({
          where: { ...dateFilter, isDeleted: false },
          _sum: { totalCost: true }
        }),
        db.maintenanceRecord.count({
          where: { ...dateFilter, isDeleted: false }
        })
      ])

      const totalCost = totalCostResult._sum.totalCost || 0
      const totalRecords = totalCountResult

      // Cost analysis by type
      const costByType: Record<string, number> = {}
      records.forEach(record => {
        const type = record.serviceType
        costByType[type] = (costByType[type] || 0) + (record.totalCost || 0)
      })

      // Monthly cost trends
      const costByMonth = await this.getMonthlyCostTrends(startDate, endDate)

      // Downtime analysis
      const downtimeAnalysis = await this.analyzeDowntime(records)

      // Predictive accuracy analysis
      const predictiveAccuracy = await this.analyzePredictiveAccuracy(records)

      return {
        totalCost,
        totalRecords,
        averageCostPerRecord: totalRecords > 0 ? totalCost / totalRecords : 0,
        costByType,
        costByMonth,
        downtimeAnalysis,
        predictiveAccuracy
      }
    } catch (error) {
      console.error('Error generating maintenance analytics:', error)
      throw error
    }
  }

  /**
   * Generate fleet analytics
   */
  static async getFleetAnalytics(): Promise<FleetAnalytics> {
    try {
      const trucks = await db.truck.findMany({
        where: { isDeleted: false },
        include: {
          maintenanceRecords: {
            where: { isDeleted: false },
            select: { totalCost: true, downtimeHours: true }
          },

        }
      })

      const totalTrucks = trucks.length
      const activeTrucks = trucks.filter(t => t.status === 'ACTIVE').length
      const totalMileage = trucks.reduce((sum, t) => sum + (t.currentMileage || 0), 0)

      // Health score analysis
      const averageHealthScore = trucks.reduce((sum, t) => sum + (t.healthScore || 50), 0) / totalTrucks

      // Health distribution
      const healthDistribution = {
        excellent: trucks.filter(t => (t.healthScore || 0) >= 80).length,
        good: trucks.filter(t => (t.healthScore || 0) >= 60 && (t.healthScore || 0) < 80).length,
        fair: trucks.filter(t => (t.healthScore || 0) >= 40 && (t.healthScore || 0) < 60).length,
        poor: trucks.filter(t => (t.healthScore || 0) < 40).length
      }

      // Risk distribution
      const riskDistribution = {
        LOW: trucks.filter(t => t.riskLevel === 'LOW').length,
        MEDIUM: trucks.filter(t => t.riskLevel === 'MEDIUM').length,
        HIGH: trucks.filter(t => t.riskLevel === 'HIGH').length,
        CRITICAL: trucks.filter(t => t.riskLevel === 'CRITICAL').length
      }

      // Utilization analysis (simplified)
      const utilization = {
        averageUtilization: 0.75, // Would be calculated from actual usage data
        utilizationByTruck: {} as Record<string, number>
      }

      trucks.forEach(truck => {
        utilization.utilizationByTruck[truck.id] = 0.5 + Math.random() * 0.5 // Simulated 50-100%
      })

      utilization.averageUtilization = Object.values(utilization.utilizationByTruck)
        .reduce((sum, val) => sum + val, 0) / totalTrucks

      // Cost per mile calculation
      const totalMaintenanceCost = trucks.reduce((sum, t) => 
        sum + t.maintenanceRecords.reduce((recordSum, record) => 
          recordSum + (record.totalCost || 0), 0), 0)
      const costPerMile = totalMileage > 0 ? totalMaintenanceCost / totalMileage : 0

      return {
        totalTrucks,
        activeTrucks,
        averageHealthScore,
        healthDistribution,
        riskDistribution,
        utilization,
        costPerMile,
        totalMileage
      }
    } catch (error) {
      console.error('Error generating fleet analytics:', error)
      throw error
    }
  }

  /**
   * Generate financial analytics
   */
  static async getFinancialAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<FinancialAnalytics> {
    try {
      const dateFilter: any = {}
      if (startDate || endDate) {
        dateFilter.datePerformed = {}
        if (startDate) dateFilter.datePerformed.gte = startDate
        if (endDate) dateFilter.datePerformed.lte = endDate
      }

      const records = await db.maintenanceRecord.findMany({
        where: { ...dateFilter, isDeleted: false },
        select: {
          totalCost: true,
          partsCost: true,
          laborCost: true,
          datePerformed: true
        }
      })

      const totalMaintenanceCost = records.reduce((sum, r) => sum + (r.totalCost || 0), 0)
      const totalPartsCost = records.reduce((sum, r) => sum + (r.partsCost || 0), 0)
      const totalLaborCost = records.reduce((sum, r) => sum + (r.laborCost || 0), 0)

      // Estimate fuel cost (simplified calculation)
      const totalFuelCost = await this.estimateFuelCost(startDate, endDate)

      const totalTrucks = await db.truck.count({ where: { isDeleted: false } })
      const costPerTruck = totalTrucks > 0 ? totalMaintenanceCost / totalTrucks : 0

      const totalMileage = await this.getTotalMileage(startDate, endDate)
      const costPerMile = totalMileage > 0 ? totalMaintenanceCost / totalMileage : 0

      // Cost trends
      const costTrends = await this.getMonthlyCostTrends(startDate, endDate)

      // Budget variance (simplified - would use actual budget data)
      const budgetVariance = {
        budgeted: totalMaintenanceCost * 1.1, // Assume 10% budget buffer
        actual: totalMaintenanceCost,
        variance: totalMaintenanceCost * 0.1,
        variancePercent: 10
      }

      // ROI calculation
      const roi = await this.calculateROI(records, startDate, endDate)

      return {
        totalMaintenanceCost,
        totalFuelCost,
        totalLaborCost,
        totalPartsCost,
        costPerTruck,
        costPerMile,
        costTrends,
        budgetVariance,
        roi
      }
    } catch (error) {
      console.error('Error generating financial analytics:', error)
      throw error
    }
  }

  /**
   * Get monthly cost trends
   */
  private static async getMonthlyCostTrends(
    startDate?: Date,
    endDate?: Date
  ): Promise<AnalyticsTimeSeries[]> {
    try {
      const start = startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Default to 1 year
      const end = endDate || new Date()

      const records = await db.maintenanceRecord.findMany({
        where: {
          datePerformed: { gte: start, lte: end },
          isDeleted: false
        },
        select: {
          totalCost: true,
          datePerformed: true
        }
      })

      // Group by month
      const monthlyData: Record<string, { total: number; count: number }> = {}

      records.forEach(record => {
        const month = new Date(record.datePerformed).toISOString().substring(0, 7) // YYYY-MM
        if (!monthlyData[month]) {
          monthlyData[month] = { total: 0, count: 0 }
        }
        monthlyData[month].total += record.totalCost || 0
        monthlyData[month].count += 1
      })

      return Object.entries(monthlyData).map(([period, data]) => ({
        period,
        value: data.total,
        count: data.count
      })).sort((a, b) => a.period.localeCompare(b.period))
    } catch (error) {
      console.error('Error getting monthly cost trends:', error)
      return []
    }
  }

  /**
   * Analyze downtime
   */
  private static async analyzeDowntime(records: any[]) {
    const totalDowntime = records.reduce((sum, r) => sum + (r.downtimeHours || 0), 0)
    const averageDowntimePerRecord = records.length > 0 ? totalDowntime / records.length : 0

    const downtimeByReason: Record<string, number> = {}
    records.forEach(record => {
      const reason = record.failureMode || 'Unknown'
      downtimeByReason[reason] = (downtimeByReason[reason] || 0) + (record.downtimeHours || 0)
    })

    return {
      totalDowntime,
      averageDowntimePerRecord,
      downtimeByReason
    }
  }

  /**
   * Analyze predictive accuracy
   */
  private static async analyzePredictiveAccuracy(records: any[]) {
    const predictedRecords = records.filter(r => r.wasPredicted)
    const totalPredictions = predictedRecords.length

    if (totalPredictions === 0) {
      return {
        totalPredictions: 0,
        accuratePredictions: 0,
        accuracyRate: 0,
        accuracyByType: {}
      }
    }

    // Simplified accuracy calculation - in practice, this would be more sophisticated
    const accuratePredictions = predictedRecords.filter(r => {
      // Consider a prediction accurate if it prevented major failure
      return (r.downtimeHours || 0) < 4 // Less than 4 hours downtime
    }).length

    const accuracyRate = totalPredictions > 0 ? accuratePredictions / totalPredictions : 0

    // Accuracy by failure type
    const accuracyByType: Record<string, { total: number; accurate: number; rate: number }> = {}
    
    predictedRecords.forEach(record => {
      const type = record.failureMode || 'Unknown'
      if (!accuracyByType[type]) {
        accuracyByType[type] = { total: 0, accurate: 0, rate: 0 }
      }
      accuracyByType[type].total += 1
      if ((record.downtimeHours || 0) < 4) {
        accuracyByType[type].accurate += 1
      }
    })

    // Calculate rates
    Object.keys(accuracyByType).forEach(type => {
      const data = accuracyByType[type]
      data.rate = data.total > 0 ? data.accurate / data.total : 0
    })

    return {
      totalPredictions,
      accuratePredictions,
      accuracyRate,
      accuracyByType
    }
  }

  /**
   * Estimate fuel cost
   */
  private static async estimateFuelCost(startDate?: Date, endDate?: Date) {
    // Simplified fuel cost estimation
    const trucks = await db.truck.findMany({
      where: { isDeleted: false },
      select: { currentMileage: true, fuelEfficiency: true }
    })

    const totalMileage = trucks.reduce((sum, t) => sum + (t.currentMileage || 0), 0)
    const avgFuelEfficiency = trucks.reduce((sum, t) => sum + (t.fuelEfficiency || 20), 0) / trucks.length
    const fuelConsumed = totalMileage / avgFuelEfficiency
    const fuelCostPerGallon = 3.50 // Would be configurable

    return fuelConsumed * fuelCostPerGallon
  }

  /**
   * Get total mileage for period
   */
  private static async getTotalMileage(startDate?: Date, endDate?: Date) {
    // Simplified - would use actual mileage tracking over time
    const trucks = await db.truck.findMany({
      where: { isDeleted: false },
      select: { currentMileage: true }
    })

    return trucks.reduce((sum, t) => sum + (t.currentMileage || 0), 0)
  }

  /**
   * Calculate ROI
   */
  private static async calculateROI(records: any[], startDate?: Date, endDate?: Date) {
    const maintenanceInvestment = records.reduce((sum, r) => sum + (r.totalCost || 0), 0)
    
    // Estimate savings from preventive maintenance
    const predictedRecords = records.filter(r => r.wasPredicted)
    const preventedBreakdowns = predictedRecords.filter(r => (r.downtimeHours || 0) < 4).length
    const savingsFromPrevention = preventedBreakdowns * 2500 // Average cost of breakdown

    const roi = maintenanceInvestment > 0 ? (savingsFromPrevention - maintenanceInvestment) / maintenanceInvestment : 0

    return {
      maintenanceInvestment,
      savingsFromPrevention,
      roi
    }
  }

  /**
   * Generate comprehensive analytics report
   */
  static async generateComprehensiveReport(
    startDate?: Date,
    endDate?: Date
  ) {
    try {
      const [maintenanceAnalytics, fleetAnalytics, financialAnalytics] = await Promise.all([
        this.getMaintenanceAnalytics(startDate, endDate),
        this.getFleetAnalytics(),
        this.getFinancialAnalytics(startDate, endDate)
      ])

      // Calculate key performance indicators
      const kpis = {
        fleetHealth: fleetAnalytics.averageHealthScore,
        costEfficiency: financialAnalytics.costPerMile,
        maintenanceEfficiency: maintenanceAnalytics.averageCostPerRecord,
        predictiveAccuracy: maintenanceAnalytics.predictiveAccuracy.accuracyRate,
        fleetUtilization: fleetAnalytics.utilization.averageUtilization,
        roi: financialAnalytics.roi.roi
      }

      // Generate insights and recommendations
      const insights = this.generateInsights({
        maintenanceAnalytics,
        fleetAnalytics,
        financialAnalytics,
        kpis
      })

      return {
        period: {
          startDate: startDate?.toISOString() || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: endDate?.toISOString() || new Date().toISOString()
        },
        executiveSummary: this.generateExecutiveSummary(insights),
        kpis,
        maintenanceAnalytics,
        fleetAnalytics,
        financialAnalytics,
        insights,
        generatedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error generating comprehensive report:', error)
      throw error
    }
  }

  /**
   * Generate executive summary
   */
  private static generateExecutiveSummary(insights: any[]) {
    const positiveInsights = insights.filter(i => i.type === 'positive')
    const negativeInsights = insights.filter(i => i.type === 'negative')
    const recommendations = insights.filter(i => i.type === 'recommendation')

    return {
      overview: `Fleet performance shows ${positiveInsights.length} strengths and ${negativeInsights.length} areas for improvement. Key focus areas include ${recommendations.slice(0, 3).map(r => r.title.toLowerCase()).join(', ')}.`,
      keyHighlights: positiveInsights.slice(0, 3).map(i => i.title),
      keyChallenges: negativeInsights.slice(0, 3).map(i => i.title),
      topRecommendations: recommendations.slice(0, 3).map(i => i.title)
    }
  }

  /**
   * Generate insights from analytics data
   */
  private static generateInsights(data: any) {
    const insights = []

    // Fleet health insights
    if (data.fleetAnalytics.averageHealthScore > 80) {
      insights.push({
        type: 'positive',
        category: 'Fleet Health',
        title: 'Excellent Fleet Health',
        description: `Fleet health score of ${data.fleetAnalytics.averageHealthScore.toFixed(1)}% indicates well-maintained vehicles.`
      })
    } else if (data.fleetAnalytics.averageHealthScore < 60) {
      insights.push({
        type: 'negative',
        category: 'Fleet Health',
        title: 'Fleet Health Concerns',
        description: `Fleet health score of ${data.fleetAnalytics.averageHealthScore.toFixed(1)}% requires attention to prevent breakdowns.`
      })
    }

    // Cost efficiency insights
    if (data.financialAnalytics.costPerMile > 0.50) {
      insights.push({
        type: 'negative',
        category: 'Cost Efficiency',
        title: 'High Cost Per Mile',
        description: `Cost per mile of $${data.financialAnalytics.costPerMile.toFixed(2)} is above industry average.`
      })
    }

    // Predictive accuracy insights
    if (data.maintenanceAnalytics.predictiveAccuracy.accuracyRate > 0.80) {
      insights.push({
        type: 'positive',
        category: 'Predictive Maintenance',
        title: 'High Prediction Accuracy',
        description: `Predictive maintenance accuracy of ${(data.maintenanceAnalytics.predictiveAccuracy.accuracyRate * 100).toFixed(1)}% demonstrates effective AI implementation.`
      })
    }

    // ROI insights
    if (data.financialAnalytics.roi.roi > 2.0) {
      insights.push({
        type: 'positive',
        category: 'Financial Performance',
        title: 'Excellent ROI',
        description: `Maintenance ROI of ${(data.financialAnalytics.roi.roi * 100).toFixed(1)}% indicates strong cost optimization.`
      })
    }

    // Recommendations
    insights.push({
      type: 'recommendation',
      category: 'Optimization',
      title: 'Implement Predictive Maintenance',
      description: 'Expand predictive maintenance program to reduce unplanned downtime.'
    })

    insights.push({
      type: 'recommendation',
      category: 'Cost Management',
      title: 'Optimize Parts Procurement',
      description: 'Negotiate bulk purchasing discounts and optimize inventory management.'
    })

    return insights
  }
}
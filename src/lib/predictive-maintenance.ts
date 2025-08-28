import { db } from './db'

interface MaintenanceRecord {
  id: string
  truckId: string
  serviceType: string
  datePerformed: Date
  totalCost: number
  currentMileage?: number
  wasPredicted: boolean
  failureMode?: string
}

interface Truck {
  id: string
  vin: string
  make: string
  model: string
  year: number
  currentMileage: number
  engineHours?: number
  lastOilChange?: Date
  healthScore?: number
  riskLevel: string
  fuelEfficiency?: number
  avgDailyMileage?: number
}



interface PredictionResult {
  truckId: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  healthScore: number
  predictions: {
    type: string
    probability: number
    timeframe: string
    recommendedAction: string
    costImpact: number
  }[]
  nextMaintenance: {
    oilChange?: Date
    inspection?: Date
    tireRotation?: Date
  }
}

export class PredictiveMaintenanceEngine {
  /**
   * Analyze truck health and generate predictive insights
   */
  static async analyzeTruckHealth(truckId: string): Promise<PredictionResult> {
    try {
      // Fetch truck data
      const truck = await db.truck.findUnique({
        where: { id: truckId },
        include: {
          maintenanceRecords: {
            orderBy: { datePerformed: 'desc' },
            take: 50
          },

        }
      })

      if (!truck) {
        throw new Error('Truck not found')
      }

      // Calculate health score based on multiple factors
      const healthScore = this.calculateHealthScore(truck)
      
      // Generate predictions using ML algorithms
      const predictions = await this.generatePredictions(truck)
      
      // Determine overall risk level
      const riskLevel = this.calculateRiskLevel(healthScore, predictions)
      
      // Calculate next maintenance dates
      const nextMaintenance = this.calculateNextMaintenance(truck)

      return {
        truckId,
        riskLevel,
        healthScore,
        predictions,
        nextMaintenance
      }
    } catch (error) {
      console.error('Error in predictive analysis:', error)
      throw error
    }
  }

  /**
   * Calculate overall health score (0-100)
   */
  private static calculateHealthScore(truck: any): number {
    let score = 100 // Start with perfect health

    // Age-based deduction
    const currentYear = new Date().getFullYear()
    const age = currentYear - truck.year
    score -= Math.min(age * 2, 30) // Max 30 points deduction for age

    // Mileage-based deduction
    const mileageDeduction = Math.min(truck.currentMileage / 10000, 25) // Max 25 points
    score -= mileageDeduction

    // Maintenance history deduction
    const recentMaintenance = truck.maintenanceRecords?.filter(
      (record: any) => {
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
        return new Date(record.datePerformed) > sixMonthsAgo
      }
    )

    if (recentMaintenance.length < 2) {
      score -= 15 // Poor maintenance history
    }



    // Fuel efficiency analysis
    if (truck.fuelEfficiency && truck.fuelEfficiency < 15) {
      score -= 10 // Poor fuel efficiency
    }

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  /**
   * Generate failure predictions using ML algorithms
   */
  private static async generatePredictions(truck: any): Promise<any[]> {
    const predictions: any[] = []

    // Engine failure prediction
    const engineRisk = await this.predictEngineFailure(truck)
    if (engineRisk.probability > 0.3) {
      predictions.push(engineRisk)
    }

    // Transmission failure prediction
    const transmissionRisk = await this.predictTransmissionFailure(truck)
    if (transmissionRisk.probability > 0.3) {
      predictions.push(transmissionRisk)
    }

    // Brake system prediction
    const brakeRisk = await this.predictBrakeFailure(truck)
    if (brakeRisk.probability > 0.3) {
      predictions.push(brakeRisk)
    }

    // Tire failure prediction
    const tireRisk = await this.predictTireFailure(truck)
    if (tireRisk.probability > 0.3) {
      predictions.push(tireRisk)
    }

    // Battery failure prediction
    const batteryRisk = await this.predictBatteryFailure(truck)
    if (batteryRisk.probability > 0.3) {
      predictions.push(batteryRisk)
    }

    return predictions.sort((a, b) => b.probability - a.probability)
  }

  /**
   * Predict engine failure based on various factors
   */
  private static async predictEngineFailure(truck: any): Promise<any> {
    let probability = 0.1 // Base probability
    
    // Age factor
    const age = new Date().getFullYear() - truck.year
    probability += age * 0.02

    // Mileage factor
    probability += (truck.currentMileage / 100000) * 0.15

    // Maintenance history
    const oilChanges = truck.maintenanceRecords?.filter(
      (record: any) => record.serviceType.toLowerCase().includes('oil')
    )
    
    if (!oilChanges || oilChanges.length === 0) {
      probability += 0.3
    } else {
      const lastOilChange = new Date(oilChanges[0].datePerformed)
      const monthsSinceOilChange = (Date.now() - lastOilChange.getTime()) / (1000 * 60 * 60 * 24 * 30)
      
      if (monthsSinceOilChange > 6) {
        probability += 0.2
      }
    }



    return {
      type: 'ENGINE_FAILURE',
      probability: Math.min(probability, 0.95),
      timeframe: this.getTimeframe(probability),
      recommendedAction: 'Schedule engine inspection and oil change',
      costImpact: 2500 + Math.random() * 3000
    }
  }

  /**
   * Predict transmission failure
   */
  private static async predictTransmissionFailure(truck: any): Promise<any> {
    let probability = 0.05 // Lower base probability for transmission

    // Mileage is a big factor for transmission
    probability += (truck.currentMileage / 150000) * 0.25

    // Age factor
    const age = new Date().getFullYear() - truck.year
    probability += age * 0.01

    // Maintenance history
    const transmissionService = truck.maintenanceRecords?.filter(
      (record: any) => 
        record.serviceType.toLowerCase().includes('transmission') ||
        record.serviceType.toLowerCase().includes('fluid')
    )

    if (!transmissionService || transmissionService.length === 0) {
      probability += 0.2
    }

    return {
      type: 'TRANSMISSION_FAILURE',
      probability: Math.min(probability, 0.8),
      timeframe: this.getTimeframe(probability),
      recommendedAction: 'Check transmission fluid and schedule service',
      costImpact: 1800 + Math.random() * 2200
    }
  }

  /**
   * Predict brake system failure
   */
  private static async predictBrakeFailure(truck: any): Promise<any> {
    let probability = 0.08

    // Mileage factor
    probability += (truck.currentMileage / 50000) * 0.15

    // Maintenance history
    const brakeService = truck.maintenanceRecords?.filter(
      (record: any) => 
        record.serviceType.toLowerCase().includes('brake') ||
        record.serviceType.toLowerCase().includes('pad')
    )

    if (!brakeService || brakeService.length === 0) {
      probability += 0.3
    } else {
      const lastBrakeService = new Date(brakeService[0].datePerformed)
      const monthsSinceBrakeService = (Date.now() - lastBrakeService.getTime()) / (1000 * 60 * 60 * 24 * 30)
      
      if (monthsSinceBrakeService > 12) {
        probability += 0.25
      }
    }



    return {
      type: 'BRAKE_FAILURE',
      probability: Math.min(probability, 0.9),
      timeframe: this.getTimeframe(probability),
      recommendedAction: 'Immediate brake inspection and pad replacement',
      costImpact: 800 + Math.random() * 1200
    }
  }

  /**
   * Predict tire failure
   */
  private static async predictTireFailure(truck: any): Promise<any> {
    let probability = 0.06

    // Mileage factor
    probability += (truck.currentMileage / 40000) * 0.2

    // Age factor
    const age = new Date().getFullYear() - truck.year
    probability += age * 0.015

    // Maintenance history
    const tireService = truck.maintenanceRecords?.filter(
      (record: any) => 
        record.serviceType.toLowerCase().includes('tire') ||
        record.serviceType.toLowerCase().includes('rotation')
    )

    if (!tireService || tireService.length === 0) {
      probability += 0.25
    }



    return {
      type: 'TIRE_FAILURE',
      probability: Math.min(probability, 0.85),
      timeframe: this.getTimeframe(probability),
      recommendedAction: 'Check tire pressure and inspect for wear',
      costImpact: 400 + Math.random() * 800
    }
  }

  /**
   * Predict battery failure
   */
  private static async predictBatteryFailure(truck: any): Promise<any> {
    let probability = 0.04

    // Age factor (batteries typically last 3-5 years)
    const age = new Date().getFullYear() - truck.year
    if (age > 3) {
      probability += (age - 3) * 0.15
    }



    return {
      type: 'BATTERY_FAILURE',
      probability: Math.min(probability, 0.7),
      timeframe: this.getTimeframe(probability),
      recommendedAction: 'Test battery and charging system',
      costImpact: 200 + Math.random() * 300
    }
  }

  /**
   * Calculate risk level based on health score and predictions
   */
  private static calculateRiskLevel(healthScore: number, predictions: any[]): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (healthScore >= 80 && predictions.length === 0) {
      return 'LOW'
    } else if (healthScore >= 60 && predictions.filter((p: any) => p.probability > 0.5).length === 0) {
      return 'MEDIUM'
    } else if (healthScore >= 40 && predictions.filter((p: any) => p.probability > 0.7).length === 0) {
      return 'HIGH'
    } else {
      return 'CRITICAL'
    }
  }

  /**
   * Calculate next maintenance dates
   */
  private static calculateNextMaintenance(truck: any): any {
    const nextMaintenance: any = {}
    const currentDate = new Date()

    // Oil change calculation
    const lastOilChange = truck.lastOilChange ? new Date(truck.lastOilChange) : null
    if (lastOilChange) {
      const monthsSinceOilChange = (currentDate.getTime() - lastOilChange.getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (monthsSinceOilChange > 3) {
        nextMaintenance.oilChange = new Date(currentDate.getTime() + (6 - monthsSinceOilChange) * 30 * 24 * 60 * 60 * 1000)
      }
    } else {
      nextMaintenance.oilChange = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days
    }

    // Inspection calculation
    const lastInspection = truck.lastInspection ? new Date(truck.lastInspection) : null
    if (lastInspection) {
      const monthsSinceInspection = (currentDate.getTime() - lastInspection.getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (monthsSinceInspection > 10) {
        nextMaintenance.inspection = new Date(currentDate.getTime() + (12 - monthsSinceInspection) * 30 * 24 * 60 * 60 * 1000)
      }
    } else {
      nextMaintenance.inspection = new Date(currentDate.getTime() + 90 * 24 * 60 * 60 * 1000) // 90 days
    }

    // Tire rotation calculation
    const tireRotations = truck.maintenanceRecords?.filter(
      (record: any) => record.serviceType.toLowerCase().includes('rotation')
    )
    
    if (!tireRotations || tireRotations.length === 0) {
      nextMaintenance.tireRotation = new Date(currentDate.getTime() + 60 * 24 * 60 * 60 * 1000) // 60 days
    } else {
      const lastRotation = new Date(tireRotations[0].datePerformed)
      const monthsSinceRotation = (currentDate.getTime() - lastRotation.getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (monthsSinceRotation > 5) {
        nextMaintenance.tireRotation = new Date(currentDate.getTime() + (6 - monthsSinceRotation) * 30 * 24 * 60 * 60 * 1000)
      }
    }

    return nextMaintenance
  }

  /**
   * Get timeframe based on probability
   */
  private static getTimeframe(probability: number): string {
    if (probability > 0.8) return 'Immediate (0-30 days)'
    if (probability > 0.6) return 'Short-term (1-3 months)'
    if (probability > 0.4) return 'Medium-term (3-6 months)'
    return 'Long-term (6+ months)'
  }

  /**
   * Generate predictive alerts for all trucks
   */
  static async generateFleetWideAlerts(): Promise<any[]> {
    try {
      const trucks = await db.truck.findMany({
        where: { isDeleted: false, status: 'ACTIVE' }
      })

      const alerts: any[] = []

      for (const truck of trucks) {
        const analysis = await this.analyzeTruckHealth(truck.id)
        
        // Generate alerts for high-risk predictions
        for (const prediction of analysis.predictions) {
          if (prediction.probability > 0.6) {
            const existingAlert = await db.predictiveAlert.findFirst({
              where: {
                truckId: truck.id,
                alertType: 'PREDICTIVE_FAILURE',
                isResolved: false
              }
            })

            if (!existingAlert) {
              const alert = await db.predictiveAlert.create({
                data: {
                  truckId: truck.id,
                  alertType: 'PREDICTIVE_FAILURE',
                  title: `${prediction.type.replace('_', ' ')} Risk Detected`,
                  description: `AI analysis predicts ${prediction.probability * 100}% probability of ${prediction.type.replace('_', ' ').toLowerCase()} within ${prediction.timeframe}`,
                  severity: prediction.probability > 0.8 ? 'CRITICAL' : prediction.probability > 0.7 ? 'HIGH' : 'MEDIUM',
                  confidence: prediction.probability,
                  predictedFailureDate: new Date(Date.now() + this.getTimeframeInDays(prediction.timeframe) * 24 * 60 * 60 * 1000),
                  recommendedAction: prediction.recommendedAction,
                  costImpact: prediction.costImpact,
                  probability: prediction.probability
                }
              })
              alerts.push(alert)
            }
          }
        }

        // Update truck health score and risk level
        await db.truck.update({
          where: { id: truck.id },
          data: {
            healthScore: analysis.healthScore,
            riskLevel: analysis.riskLevel
          }
        })
      }

      return alerts
    } catch (error) {
      console.error('Error generating fleet-wide alerts:', error)
      throw error
    }
  }

  /**
   * Convert timeframe string to days
   */
  private static getTimeframeInDays(timeframe: string): number {
    if (timeframe.includes('Immediate')) return 15
    if (timeframe.includes('Short-term')) return 60
    if (timeframe.includes('Medium-term')) return 135
    return 180
  }


}
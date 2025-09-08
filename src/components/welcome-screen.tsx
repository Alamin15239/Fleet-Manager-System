'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Truck, 
  Wrench, 
  Users, 
  BarChart3, 
  Shield, 
  Plus, 
  ArrowRight,
  CheckCircle,
  Clock,
  Target
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface WelcomeScreenProps {
  userName?: string
  userRole?: string
}

export function WelcomeScreen({ userName, userRole }: WelcomeScreenProps) {
  const router = useRouter()

  const quickActions = [
    {
      title: 'Add Your First Truck',
      description: 'Start by adding trucks to your fleet',
      icon: <Truck className="h-8 w-8 text-blue-600" />,
      action: () => router.push('/trucks'),
      color: 'bg-blue-50 border-blue-200',
      primary: true
    },
    {
      title: 'Schedule Maintenance',
      description: 'Set up maintenance schedules',
      icon: <Wrench className="h-8 w-8 text-green-600" />,
      action: () => router.push('/maintenance'),
      color: 'bg-green-50 border-green-200'
    },
    {
      title: 'Add Mechanics',
      description: 'Register your maintenance team',
      icon: <Users className="h-8 w-8 text-purple-600" />,
      action: () => router.push('/mechanics'),
      color: 'bg-purple-50 border-purple-200'
    },
    {
      title: 'Tire Management',
      description: 'Track tire inventory and usage',
      icon: <Target className="h-8 w-8 text-orange-600" />,
      action: () => router.push('/tire-management'),
      color: 'bg-orange-50 border-orange-200'
    }
  ]

  const features = [
    {
      title: 'Fleet Tracking',
      description: 'Monitor all your vehicles in one place',
      icon: <Truck className="h-6 w-6 text-blue-600" />
    },
    {
      title: 'Maintenance Scheduling',
      description: 'Never miss important maintenance dates',
      icon: <Clock className="h-6 w-6 text-green-600" />
    },
    {
      title: 'Analytics & Reports',
      description: 'Get insights into your fleet performance',
      icon: <BarChart3 className="h-6 w-6 text-purple-600" />
    },
    {
      title: 'Security & Access Control',
      description: 'Role-based permissions and audit trails',
      icon: <Shield className="h-6 w-6 text-red-600" />
    }
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
          <Truck className="h-10 w-10 text-blue-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900">
          Welcome to Fleet Manager{userName && `, ${userName}`}!
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Your comprehensive solution for managing truck fleet maintenance, tracking, and analytics.
          Let's get you started with setting up your fleet.
        </p>
        {userRole && (
          <Badge variant="outline" className="text-sm px-3 py-1">
            {userRole} Account
          </Badge>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Plus className="h-6 w-6 text-blue-600" />
            Quick Setup
          </CardTitle>
          <p className="text-gray-600">Get started with these essential steps</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, index) => (
              <Card 
                key={index}
                className={`cursor-pointer hover:shadow-lg transition-all duration-200 ${action.color} ${
                  action.primary ? 'ring-2 ring-blue-300' : ''
                }`}
                onClick={action.action}
              >
                <CardContent className="p-6 text-center space-y-3">
                  <div className="flex justify-center">
                    {action.icon}
                  </div>
                  <h3 className="font-semibold text-lg">{action.title}</h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                  <Button 
                    variant={action.primary ? "default" : "outline"} 
                    size="sm"
                    className="w-full"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <CheckCircle className="h-6 w-6 text-green-600" />
            What You Can Do
          </CardTitle>
          <p className="text-gray-600">Explore the powerful features available to you</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-4 p-4 rounded-lg border bg-gray-50">
                <div className="flex-shrink-0">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Getting Started Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Getting Started Checklist</CardTitle>
          <p className="text-gray-600">Follow these steps to set up your fleet management system</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg border">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Add Your Trucks</h3>
                <p className="text-gray-600">Register all vehicles in your fleet with details like VIN, make, model, and license plate</p>
              </div>
              <Button variant="outline" onClick={() => router.push('/trucks')}>
                Add Trucks
              </Button>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg border">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold">2</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Register Mechanics</h3>
                <p className="text-gray-600">Add your maintenance team members to assign them to service jobs</p>
              </div>
              <Button variant="outline" onClick={() => router.push('/mechanics')}>
                Add Mechanics
              </Button>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg border">
              <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Schedule Maintenance</h3>
                <p className="text-gray-600">Set up regular maintenance schedules and track service history</p>
              </div>
              <Button variant="outline" onClick={() => router.push('/maintenance')}>
                Schedule Service
              </Button>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-lg border">
              <div className="flex-shrink-0 w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-600 font-bold">4</span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Explore Analytics</h3>
                <p className="text-gray-600">View reports and analytics to optimize your fleet performance</p>
              </div>
              <Button variant="outline" onClick={() => router.push('/analytics')}>
                View Analytics
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help & Support */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-8 text-center">
          <h3 className="text-2xl font-bold mb-4">Need Help Getting Started?</h3>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            Our comprehensive documentation and support team are here to help you make the most of your fleet management system.
          </p>
          <div className="flex justify-center gap-4">
            <Button variant="outline">
              View Documentation
            </Button>
            <Button>
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Truck, 
  Heart, 
  Github, 
  Mail, 
  Phone, 
  MapPin,
  Shield,
  Clock,
  Users
} from 'lucide-react'

export function AppFooter() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="mt-auto border-t bg-gray-50/50">
      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-lg">Fleet Manager</span>
            </div>
            <p className="text-sm text-gray-600">
              Comprehensive fleet maintenance and tire management system for modern transportation businesses.
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Secure
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                24/7 Support
              </Badge>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Features</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Fleet Tracking & Management</li>
              <li>• Maintenance Scheduling</li>
              <li>• Tire Inventory Management</li>
              <li>• Analytics & Reporting</li>
              <li>• Predictive Maintenance</li>
              <li>• User Management</li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Support</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <a href="#" className="hover:text-blue-600 transition-colors flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  support@fleetmanager.com
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-600 transition-colors flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  +1 (555) 123-4567
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-blue-600 transition-colors flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Help Center
                </a>
              </li>
            </ul>
          </div>

          {/* System Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">System</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Version:</span>
                <Badge variant="secondary">v1.0.0</Badge>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <Badge className="bg-green-100 text-green-800">Online</Badge>
              </div>
              <div className="flex justify-between">
                <span>Uptime:</span>
                <span>99.9%</span>
              </div>
              <div className="flex justify-between">
                <span>Users:</span>
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 pt-8 border-t border-gray-200">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>© {currentYear} Fleet Manager System.</span>
              <span>Built with</span>
              <Heart className="h-4 w-4 text-red-500" />
              <span>for transportation excellence.</span>
            </div>
            
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm">
                Privacy Policy
              </Button>
              <Button variant="ghost" size="sm">
                Terms of Service
              </Button>
              <Button variant="ghost" size="sm">
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </Button>
            </div>
          </div>
          
          <div className="mt-4 text-center text-xs text-gray-500">
            <p>
              Next.js 15 • TypeScript • Tailwind CSS • Prisma • PostgreSQL/SQLite
            </p>
            <p className="mt-1">
              Designed for scalability, security, and performance
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Filter, Wrench, Plus } from 'lucide-react'
import { apiGet } from '@/lib/api'

interface MaintenanceJob {
  id: string
  name: string
  category: string
  parts?: string
  notes?: string
  isActive: boolean
}

interface MaintenanceJobSelectorProps {
  onSelectJobs: (jobs: MaintenanceJob[]) => void
  selectedJobs?: MaintenanceJob[]
  children: React.ReactNode
  multiple?: boolean
}

export function MaintenanceJobSelector({ onSelectJobs, selectedJobs = [], children, multiple = false }: MaintenanceJobSelectorProps) {
  const [jobs, setJobs] = useState<MaintenanceJob[]>([])
  const [filteredJobs, setFilteredJobs] = useState<MaintenanceJob[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    filterJobs()
  }, [jobs, searchTerm, categoryFilter])

  const fetchJobs = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/maintenance-jobs')
      if (response.ok) {
        const data = await response.json()
        setJobs(data)
      }
    } catch (error) {
      console.error('Error fetching maintenance jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterJobs = () => {
    let filtered = jobs

    if (searchTerm) {
      filtered = filtered.filter(job =>
        job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.parts && job.parts.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (job.notes && job.notes.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(job => job.category === categoryFilter)
    }

    setFilteredJobs(filtered)
  }

  const categories = Array.from(new Set(jobs.map(job => job.category))).sort()

  const handleSelectJob = (job: MaintenanceJob) => {
    if (multiple) {
      const isSelected = selectedJobs.some(j => j.id === job.id)
      const newSelection = isSelected 
        ? selectedJobs.filter(j => j.id !== job.id)
        : [...selectedJobs, job]
      onSelectJobs(newSelection)
    } else {
      onSelectJobs([job])
      setIsDialogOpen(false)
      setSearchTerm('')
      setCategoryFilter('all')
    }
  }
  
  const handleConfirmSelection = () => {
    setIsDialogOpen(false)
    setSearchTerm('')
    setCategoryFilter('all')
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Brakes': 'bg-red-100 text-red-800',
      'Electrical': 'bg-yellow-100 text-yellow-800',
      'Suspension': 'bg-blue-100 text-blue-800',
      'Engine': 'bg-green-100 text-green-800',
      'Drivetrain': 'bg-purple-100 text-purple-800',
      'Transmission': 'bg-indigo-100 text-indigo-800',
      'Tires': 'bg-orange-100 text-orange-800',
      'Exhaust': 'bg-gray-100 text-gray-800',
      'HVAC': 'bg-cyan-100 text-cyan-800',
      'Fuel System': 'bg-amber-100 text-amber-800',
      'Body': 'bg-teal-100 text-teal-800',
      'Interior': 'bg-pink-100 text-pink-800',
      'Steering': 'bg-lime-100 text-lime-800',
      'Trailer': 'bg-emerald-100 text-emerald-800',
      'Cooling': 'bg-sky-100 text-sky-800',
      'Preventive': 'bg-lavender-100 text-lavender-800',
      'Welding': 'bg-rose-100 text-rose-800',
      'Hydraulics': 'bg-fuchsia-100 text-fuchsia-800',
      'General': 'bg-slate-100 text-slate-800',
      'Tanker Trailer': 'bg-violet-100 text-violet-800',
      'Trailer Body': 'bg-purple-100 text-purple-800',
      'Trailer Coupling': 'bg-fuchsia-100 text-fuchsia-800',
      'Cooling/Heating': 'bg-sky-100 text-sky-800',
      'Recovery/Equipment': 'bg-rose-100 text-rose-800',
      'Tires/Suspension': 'bg-mint-100 text-mint-800',
      'Welding/Coupling': 'bg-salmon-100 text-salmon-800'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-lg">Select Jobs</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="text-xs text-gray-600">
            {filteredJobs.length} jobs found
          </div>

          <div className="border rounded max-h-[40vh] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-xs text-gray-600">Loading...</p>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 text-sm">No jobs found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredJobs.map((job) => (
                  <div key={job.id} className="p-3 hover:bg-gray-50 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedJobs.some(j => j.id === job.id)}
                      onChange={() => handleSelectJob(job)}
                      className="w-4 h-4 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{job.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`text-xs ${getCategoryColor(job.category)}`}>
                          {job.category}
                        </Badge>
                        {job.notes && (
                          <span className="text-xs text-gray-500 truncate">{job.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedJobs.length > 0 && (
            <div className="border-t pt-3">
              <div className="bg-blue-50 p-3 rounded">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    Selected ({selectedJobs.length})
                  </span>
                  <Button size="sm" onClick={handleConfirmSelection}>
                    Confirm
                  </Button>
                </div>
                <div className="space-y-1">
                  {selectedJobs.map(job => (
                    <div key={job.id} className="flex items-center justify-between bg-white p-2 rounded text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{job.name}</span>
                        <Badge className={`text-xs ${getCategoryColor(job.category)}`}>
                          {job.category}
                        </Badge>
                      </div>
                      <button
                        onClick={() => handleSelectJob(job)}
                        className="text-red-600 hover:text-red-700 ml-2 flex-shrink-0"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
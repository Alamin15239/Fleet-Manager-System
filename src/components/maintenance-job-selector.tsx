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
  onSelectJob: (job: MaintenanceJob) => void
  selectedJob?: MaintenanceJob | null
  children: React.ReactNode
}

export function MaintenanceJobSelector({ onSelectJob, selectedJob, children }: MaintenanceJobSelectorProps) {
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
    onSelectJob(job)
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
      <DialogContent className="sm:max-w-[900px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Maintenance Job</DialogTitle>
          <DialogDescription>
            Search and select a predefined maintenance job from the list below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search and Filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search jobs by name, category, parts, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
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
          </div>

          {/* Results Count */}
          <div className="text-sm text-gray-600">
            {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} found
          </div>

          {/* Jobs Table */}
          <div className="border rounded-lg max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Common Parts</TableHead>
                  <TableHead>Notes / Frequency</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                      <p className="mt-2 text-sm text-gray-600">Loading maintenance jobs...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No maintenance jobs found</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Try adjusting your search or filters
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map((job) => (
                    <TableRow key={job.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">
                        {job.name}
                      </TableCell>
                      <TableCell>
                        <Badge className={getCategoryColor(job.category)}>
                          {job.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {job.parts || '-'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {job.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleSelectJob(job)}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Selected Job Info */}
          {selectedJob && (
            <div className="border-t pt-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Currently Selected Job</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-700">Name:</span>
                    <span className="ml-2 text-blue-900">{selectedJob.name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Category:</span>
                    <Badge className={`ml-2 ${getCategoryColor(selectedJob.category)}`}>
                      {selectedJob.category}
                    </Badge>
                  </div>
                  {selectedJob.parts && (
                    <div className="col-span-2">
                      <span className="font-medium text-blue-700">Common Parts:</span>
                      <span className="ml-2 text-blue-900">{selectedJob.parts}</span>
                    </div>
                  )}
                  {selectedJob.notes && (
                    <div className="col-span-2">
                      <span className="font-medium text-blue-700">Notes:</span>
                      <span className="ml-2 text-blue-900">{selectedJob.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
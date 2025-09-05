'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  FileText, Plus, Search, Eye, Trash2, Edit, Share2,
  Calendar, User, Grid, List, ArrowLeft, MoreVertical,
  Loader2, Filter, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/contexts/auth-context';
import { TruckLoader } from '@/components/ui/truck-loader';

export default function DocumentsPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState<'title' | 'createdAt' | 'updatedAt' | 'type'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, byType: {} });

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchDocuments();
    }
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm, filterType, sortBy, sortOrder]);

  const fetchDocuments = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/documents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      } else {
        toast.error('Failed to fetch documents');
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Error loading documents');
    } finally {
      setIsLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = documents;

    if (searchTerm) {
      filtered = filtered.filter((doc: any) =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.createdBy?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.createdBy?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter((doc: any) => doc.type === filterType);
    }

    // Sort documents
    filtered.sort((a: any, b: any) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];
      
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredDocuments(filtered);
    
    // Update stats
    const typeStats = filtered.reduce((acc: any, doc: any) => {
      acc[doc.type] = (acc[doc.type] || 0) + 1;
      return acc;
    }, {});
    setStats({ total: filtered.length, byType: typeStats });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        toast.success('Document deleted successfully');
        fetchDocuments();
      } else {
        toast.error('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error deleting document');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf': return '📄';
      case 'text': return '📝';
      case 'table': return '📊';
      case 'excel': return '📈';
      case 'image': return '🖼️';
      default: return '📄';
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/30 flex items-center justify-center">
        <TruckLoader size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Document Library</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">
                Manage and organize your documents ({stats.total} total)
              </p>
            </div>
          </div>
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'USER') && (
            <Button onClick={() => router.push('/documents/create')} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              {isMobile ? 'New' : 'New Document'}
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-gray-500">Total Documents</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📝</span>
                <div>
                  <div className="text-2xl font-bold">{stats.byType.text || 0}</div>
                  <div className="text-xs text-gray-500">Text Documents</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📄</span>
                <div>
                  <div className="text-2xl font-bold">{stats.byType.pdf || 0}</div>
                  <div className="text-xs text-gray-500">PDF Files</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <div>
                  <div className="text-2xl font-bold">{(stats.byType.table || 0) + (stats.byType.excel || 0)}</div>
                  <div className="text-xs text-gray-500">Tables & Sheets</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search documents, creators..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types ({stats.total})</SelectItem>
                    <SelectItem value="text">Text ({stats.byType.text || 0})</SelectItem>
                    <SelectItem value="pdf">PDF ({stats.byType.pdf || 0})</SelectItem>
                    <SelectItem value="table">Table ({stats.byType.table || 0})</SelectItem>
                    <SelectItem value="excel">Excel ({stats.byType.excel || 0})</SelectItem>
                    <SelectItem value="image">Image ({stats.byType.image || 0})</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
                  const [field, order] = value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                }}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updatedAt-desc">Latest First</SelectItem>
                    <SelectItem value="updatedAt-asc">Oldest First</SelectItem>
                    <SelectItem value="title-asc">Title A-Z</SelectItem>
                    <SelectItem value="title-desc">Title Z-A</SelectItem>
                    <SelectItem value="type-asc">Type A-Z</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-1">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents Grid/List */}
        {filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || filterType !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Create your first document to get started'
                }
              </p>
              <Button onClick={() => router.push('/documents/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6'
            : 'space-y-4'
          }>
            {filteredDocuments.map((doc: any) => (
              <Card key={doc.id} className="hover:shadow-md transition-all duration-200 group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xl sm:text-2xl flex-shrink-0">{getTypeIcon(doc.type)}</span>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-medium truncate group-hover:text-blue-600 transition-colors">
                          {doc.title}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {doc.type}
                          </Badge>
                          <span className="text-xs text-gray-500">v{doc.version}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-2 text-xs text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </div>
                    {doc.createdBy && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="truncate">{doc.createdBy?.name || doc.createdBy?.email || 'Unknown'}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/documents/${doc.id}`)}
                      className="flex-1"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="px-2">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(user?.role === 'ADMIN' || user?.role === 'MANAGER' || doc.createdBy?.id === user?.id) && (
                          <DropdownMenuItem onClick={() => router.push(`/documents/${doc.id}/edit`)}>
                            <Edit className="h-3 w-3 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => {
                          const url = `${window.location.origin}/documents/${doc.id}`;
                          navigator.clipboard.writeText(url);
                          toast.success('Link copied to clipboard');
                        }}>
                          <Share2 className="h-3 w-3 mr-2" />
                          Share
                        </DropdownMenuItem>
                        {(user?.role === 'ADMIN' || user?.role === 'MANAGER' || doc.createdBy?.id === user?.id) && (
                          <DropdownMenuItem 
                            onClick={() => handleDelete(doc.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
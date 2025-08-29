'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, Plus, Search, Eye, Trash2, 
  Calendar, User, Grid, List, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

export default function DocumentsPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    checkAuth();
    fetchDocuments();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/login');
        return;
      }
      
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const user = await response.json();
        setUserRole(user.role);
      } else {
        router.push('/login');
      }
    } catch (error) {
      router.push('/login');
    }
  };

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm, filterType]);

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
        doc.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter((doc: any) => doc.type === filterType);
    }

    setFilteredDocuments(filtered);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">All Documents</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage and view your documents</p>
            </div>
          </div>
          {(userRole === 'ADMIN' || userRole === 'MANAGER' || userRole === 'USER') && (
            <Button onClick={() => router.push('/editor')} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              {isMobile ? 'New' : 'New Document'}
            </Button>
          )}
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search documents..."
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
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
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
              <Button onClick={() => router.push('/editor')}>
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
              <Card key={doc.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xl sm:text-2xl flex-shrink-0">{getTypeIcon(doc.type)}</span>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-sm font-medium truncate">
                          {doc.title}
                        </CardTitle>
                        <Badge variant="secondary" className="text-xs mt-1">
                          {doc.type.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                    {doc.createdBy && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {doc.createdBy.name || doc.createdBy.email}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/document/${doc.id}`)}
                      className="flex-1"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View
                    </Button>
                    {(userRole === 'ADMIN' || userRole === 'MANAGER' || doc.createdBy?.id === localStorage.getItem('userId')) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(doc.id)}
                        className="px-2"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
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
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  FileText, Users, Clock, TrendingUp, Download, Share, 
  Eye, Edit, MessageSquare, CheckCircle, AlertTriangle,
  Calendar, BarChart3, PieChart as PieChartIcon, Activity
} from 'lucide-react';

interface DocumentStats {
  totalDocuments: number;
  totalWords: number;
  totalCollaborators: number;
  totalComments: number;
  documentsCreatedThisMonth: number;
  averageWordsPerDocument: number;
  mostActiveUser: string;
  documentTypes: { type: string; count: number; percentage: number }[];
  activityData: { date: string; created: number; edited: number; viewed: number }[];
  collaborationData: { name: string; documents: number; comments: number; edits: number }[];
  wordCountTrend: { month: string; words: number; documents: number }[];
  readabilityScores: { document: string; score: number; level: string }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function DocumentAnalytics() {
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setStats({
        totalDocuments: 156,
        totalWords: 45230,
        totalCollaborators: 23,
        totalComments: 89,
        documentsCreatedThisMonth: 12,
        averageWordsPerDocument: 290,
        mostActiveUser: 'John Doe',
        documentTypes: [
          { type: 'Reports', count: 45, percentage: 28.8 },
          { type: 'Letters', count: 38, percentage: 24.4 },
          { type: 'Memos', count: 32, percentage: 20.5 },
          { type: 'Invoices', count: 25, percentage: 16.0 },
          { type: 'Proposals', count: 16, percentage: 10.3 }
        ],
        activityData: [
          { date: '2024-01-01', created: 5, edited: 12, viewed: 45 },
          { date: '2024-01-02', created: 3, edited: 8, viewed: 38 },
          { date: '2024-01-03', created: 7, edited: 15, viewed: 52 },
          { date: '2024-01-04', created: 4, edited: 10, viewed: 41 },
          { date: '2024-01-05', created: 6, edited: 14, viewed: 48 },
          { date: '2024-01-06', created: 2, edited: 6, viewed: 35 },
          { date: '2024-01-07', created: 8, edited: 18, viewed: 55 }
        ],
        collaborationData: [
          { name: 'John Doe', documents: 23, comments: 45, edits: 78 },
          { name: 'Jane Smith', documents: 18, comments: 32, edits: 56 },
          { name: 'Mike Johnson', documents: 15, comments: 28, edits: 42 },
          { name: 'Sarah Wilson', documents: 12, comments: 21, edits: 35 },
          { name: 'Tom Brown', documents: 9, comments: 15, edits: 28 }
        ],
        wordCountTrend: [
          { month: 'Jan', words: 12500, documents: 25 },
          { month: 'Feb', words: 15200, documents: 32 },
          { month: 'Mar', words: 18900, documents: 38 },
          { month: 'Apr', words: 22100, documents: 45 },
          { month: 'May', words: 19800, documents: 41 },
          { month: 'Jun', words: 25600, documents: 52 }
        ],
        readabilityScores: [
          { document: 'Q1 Fleet Report', score: 8.5, level: 'Easy' },
          { document: 'Maintenance Manual', score: 12.2, level: 'Moderate' },
          { document: 'Safety Guidelines', score: 6.8, level: 'Very Easy' },
          { document: 'Technical Specifications', score: 15.4, level: 'Difficult' },
          { document: 'User Manual', score: 9.1, level: 'Easy' }
        ]
      });
      setLoading(false);
    }, 1000);
  };

  const exportReport = (format: 'pdf' | 'excel') => {
    console.log(`Exporting analytics report as ${format}`);
    // In real implementation, generate and download report
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Analytics</h1>
          <p className="text-muted-foreground">Insights into document usage and collaboration</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => exportReport('pdf')}>
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => exportReport('excel')}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.documentsCreatedThisMonth} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Words</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalWords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              ~{stats.averageWordsPerDocument} avg per document
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Collaborators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCollaborators}</div>
            <p className="text-xs text-muted-foreground">
              Most active: {stats.mostActiveUser}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Comments & Reviews</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalComments}</div>
            <p className="text-xs text-muted-foreground">
              Across all documents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="types">Document Types</TabsTrigger>
          <TabsTrigger value="collaboration">Collaboration</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="readability">Readability</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Activity</CardTitle>
              <CardDescription>Daily document creation, editing, and viewing activity</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={stats.activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="viewed" stackId="1" stroke="#8884d8" fill="#8884d8" />
                  <Area type="monotone" dataKey="edited" stackId="1" stroke="#82ca9d" fill="#82ca9d" />
                  <Area type="monotone" dataKey="created" stackId="1" stroke="#ffc658" fill="#ffc658" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Document Types Distribution</CardTitle>
                <CardDescription>Breakdown of document types in your system</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={stats.documentTypes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {stats.documentTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Document Type Details</CardTitle>
                <CardDescription>Detailed breakdown with counts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.documentTypes.map((type, index) => (
                    <div key={type.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{type.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{type.count}</Badge>
                        <span className="text-sm text-muted-foreground">{type.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="collaboration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Collaborators</CardTitle>
              <CardDescription>Most active users in document creation and collaboration</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.collaborationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="documents" fill="#8884d8" name="Documents" />
                  <Bar dataKey="comments" fill="#82ca9d" name="Comments" />
                  <Bar dataKey="edits" fill="#ffc658" name="Edits" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.collaborationData.slice(0, 3).map((user, index) => (
              <Card key={user.name}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{user.name}</CardTitle>
                  <CardDescription>Top Contributor #{index + 1}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Documents</span>
                      <Badge>{user.documents}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Comments</span>
                      <Badge variant="secondary">{user.comments}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Edits</span>
                      <Badge variant="outline">{user.edits}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Word Count Trends</CardTitle>
              <CardDescription>Monthly word count and document creation trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.wordCountTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="right" dataKey="documents" fill="#82ca9d" name="Documents" />
                  <Line yAxisId="left" type="monotone" dataKey="words" stroke="#8884d8" name="Words" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="readability" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Readability Analysis</CardTitle>
              <CardDescription>Flesch-Kincaid readability scores for your documents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.readabilityScores.map((doc) => (
                  <div key={doc.document} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{doc.document}</h4>
                      <p className="text-sm text-muted-foreground">
                        Reading Level: {doc.level}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold">{doc.score}</div>
                        <div className="text-xs text-muted-foreground">Score</div>
                      </div>
                      <Progress 
                        value={(doc.score / 20) * 100} 
                        className="w-24"
                      />
                      <Badge 
                        variant={
                          doc.score < 8 ? 'default' : 
                          doc.score < 12 ? 'secondary' : 
                          'destructive'
                        }
                      >
                        {doc.level}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium mb-2">Readability Scale</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <Badge className="mb-1">Very Easy</Badge>
                    <p>0-6: Elementary school level</p>
                  </div>
                  <div>
                    <Badge variant="secondary" className="mb-1">Easy</Badge>
                    <p>6-10: Middle school level</p>
                  </div>
                  <div>
                    <Badge variant="destructive" className="mb-1">Difficult</Badge>
                    <p>12+: College level</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
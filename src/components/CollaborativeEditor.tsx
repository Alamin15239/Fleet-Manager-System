'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, MessageSquare, Eye, Edit, Share, Clock, 
  CheckCircle, AlertCircle, UserPlus, Send, X
} from 'lucide-react';
import MicrosoftWordEditor from './MicrosoftWordEditor';

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  cursor?: {
    x: number;
    y: number;
  };
}

interface Comment {
  id: string;
  content: string;
  author: User;
  createdAt: string;
  resolved: boolean;
  position?: {
    start: number;
    end: number;
  };
  replies?: Comment[];
}

interface Change {
  id: string;
  type: 'insert' | 'delete' | 'format';
  content: string;
  author: User;
  timestamp: string;
  accepted?: boolean;
  position: {
    start: number;
    end: number;
  };
}

interface CollaborativeEditorProps {
  documentId: string;
  initialContent?: string;
  initialTitle?: string;
  onSave?: (content: string, title: string) => void;
  currentUser: User;
}

export default function CollaborativeEditor({
  documentId,
  initialContent = '',
  initialTitle = 'Untitled Document',
  onSave,
  currentUser
}: CollaborativeEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [collaborators, setCollaborators] = useState<User[]>([currentUser]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [isTrackingChanges, setIsTrackingChanges] = useState(false);
  const [showComments, setShowComments] = useState(true);
  const [showChanges, setShowChanges] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');
  const editorRef = useRef<HTMLDivElement>(null);

  // Simulate real-time collaboration
  useEffect(() => {
    // Simulate other users joining/leaving
    const interval = setInterval(() => {
      const mockUsers: User[] = [
        {
          id: '1',
          name: 'John Doe',
          email: 'john@example.com',
          isOnline: Math.random() > 0.3,
          cursor: { x: Math.random() * 800, y: Math.random() * 600 }
        },
        {
          id: '2',
          name: 'Jane Smith',
          email: 'jane@example.com',
          isOnline: Math.random() > 0.5,
          cursor: { x: Math.random() * 800, y: Math.random() * 600 }
        }
      ];
      
      setCollaborators([currentUser, ...mockUsers.filter(u => u.isOnline)]);
    }, 5000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const addComment = () => {
    if (!newComment.trim() || !selectedText) return;

    const comment: Comment = {
      id: Date.now().toString(),
      content: newComment,
      author: currentUser,
      createdAt: new Date().toISOString(),
      resolved: false,
      position: {
        start: 0, // In real implementation, get actual selection position
        end: selectedText.length
      }
    };

    setComments([...comments, comment]);
    setNewComment('');
    setIsAddingComment(false);
    setSelectedText('');
  };

  const resolveComment = (commentId: string) => {
    setComments(comments.map(comment =>
      comment.id === commentId ? { ...comment, resolved: true } : comment
    ));
  };

  const acceptChange = (changeId: string) => {
    setChanges(changes.map(change =>
      change.id === changeId ? { ...change, accepted: true } : change
    ));
  };

  const rejectChange = (changeId: string) => {
    setChanges(changes.filter(change => change.id !== changeId));
  };

  const shareDocument = () => {
    // In real implementation, send invitation email
    console.log(`Sharing document with ${shareEmail} with ${sharePermission} permission`);
    setShareEmail('');
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    
    if (isTrackingChanges) {
      // Simulate change tracking
      const change: Change = {
        id: Date.now().toString(),
        type: 'insert',
        content: 'New content added',
        author: currentUser,
        timestamp: new Date().toISOString(),
        position: { start: 0, end: 10 }
      };
      setChanges([...changes, change]);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString());
    }
  };

  return (
    <div className="h-screen flex">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Collaboration Bar */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">
                {collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="flex -space-x-2">
              {collaborators.slice(0, 5).map((user) => (
                <Avatar key={user.id} className="h-8 w-8 border-2 border-white">
                  <AvatarImage src={user.avatar} />
                  <AvatarFallback className="text-xs">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
              ))}
              {collaborators.length > 5 && (
                <div className="h-8 w-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium">
                  +{collaborators.length - 5}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={isTrackingChanges ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsTrackingChanges(!isTrackingChanges)}
            >
              <Edit className="h-4 w-4 mr-1" />
              Track Changes
            </Button>
            
            <Button
              variant={showComments ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowComments(!showComments)}
            >
              <MessageSquare className="h-4 w-4 mr-1" />
              Comments ({comments.filter(c => !c.resolved).length})
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Share className="h-4 w-4 mr-1" />
                  Share
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Document</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Email address</label>
                    <Input
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="Enter email address"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Permission</label>
                    <select
                      value={sharePermission}
                      onChange={(e) => setSharePermission(e.target.value as 'view' | 'edit')}
                      className="w-full p-2 border rounded"
                    >
                      <option value="view">Can view</option>
                      <option value="edit">Can edit</option>
                    </select>
                  </div>
                  <Button onClick={shareDocument} className="w-full">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send Invitation
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1" onMouseUp={handleTextSelection}>
          <MicrosoftWordEditor
            value={content}
            title={title}
            onChange={handleContentChange}
            onTitleChange={setTitle}
            onSave={() => onSave?.(content, title)}
          />
        </div>

        {/* Add Comment Dialog */}
        <Dialog open={isAddingComment} onOpenChange={setIsAddingComment}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Comment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Selected text:</label>
                <p className="text-sm bg-yellow-100 p-2 rounded italic">
                  "{selectedText}"
                </p>
              </div>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add your comment..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button onClick={addComment}>
                  <Send className="h-4 w-4 mr-2" />
                  Add Comment
                </Button>
                <Button variant="outline" onClick={() => setIsAddingComment(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sidebar */}
      <div className="w-80 border-l bg-gray-50 flex flex-col">
        {/* Comments Panel */}
        {showComments && (
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Comments</h3>
              <Button
                size="sm"
                onClick={() => selectedText && setIsAddingComment(true)}
                disabled={!selectedText}
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-3">
              {comments.map((comment) => (
                <Card key={comment.id} className={comment.resolved ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={comment.author.avatar} />
                          <AvatarFallback className="text-xs">
                            {comment.author.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{comment.author.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {comment.resolved ? (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Resolved
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resolveComment(comment.id)}
                          >
                            <CheckCircle className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm">{comment.content}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(comment.createdAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}

              {comments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No comments yet</p>
                  <p className="text-xs">Select text and add a comment</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Changes Panel */}
        {showChanges && isTrackingChanges && (
          <div className="border-t p-4">
            <h3 className="font-medium mb-4">Tracked Changes</h3>
            
            <div className="space-y-2">
              {changes.map((change) => (
                <Card key={change.id} className="text-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={change.type === 'insert' ? 'default' : 'destructive'}>
                          {change.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {change.author.name}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => acceptChange(change.id)}
                          className="h-6 w-6 p-0"
                        >
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => rejectChange(change.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3 text-red-600" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs">{change.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(change.timestamp).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}

              {changes.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <Edit className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No changes tracked</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
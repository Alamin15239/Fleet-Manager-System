export interface Document {
  id: string;
  title: string;
  type: 'text' | 'table' | 'excel' | 'image' | 'pdf';
  description?: string;
  fileUrl?: string;
  editorState?: any;
  version: number;
  createdById?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentRequest {
  title: string;
  type: 'text' | 'table' | 'excel' | 'image' | 'pdf';
  description?: string;
  fileUrl?: string;
  editorState?: any;
}

export interface UpdateDocumentRequest {
  title?: string;
  description?: string;
  editorState?: any;
  fileUrl?: string;
}
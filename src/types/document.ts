export interface Document {
  id: string;
  title: string;
  type: 'text' | 'table' | 'excel' | 'image' | 'pdf';
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
  fileUrl?: string;
  editorState?: any;
}

export interface UpdateDocumentRequest {
  title?: string;
  editorState?: any;
  fileUrl?: string;
}
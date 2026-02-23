export interface MaskRect {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
}

export interface UploadedFile {
  file: File;
  previewUrl: string;
  type: 'image' | 'pdf';
  pageCount?: number;
}

export interface SignatureRegion {
  dataUrl: string;
  mask: MaskRect;
  naturalWidth: number;
  naturalHeight: number;
}

export interface VerificationJob {
  id: string;
  file1_name: string;
  file2_name: string;
  file1_path: string;
  file2_path: string;
  mask1: MaskRect | null;
  mask2: MaskRect | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  confidence_score: number | null;
  result_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  mask1: MaskRect;
  mask2: MaskRect;
  created_at: string;
}

export type AppStep = 'upload' | 'mask' | 'preview' | 'results';

export interface ProcessResponse {
  jobId: string;
  confidenceScore: number;
  status: string;
  resultUrl: string;
}

export type AppView =
  | 'app'
  | 'profile'
  | 'api-keys'
  | 'api-docs'
  | 'api-test'
  | 'customers'
  | 'theming';

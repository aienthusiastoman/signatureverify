export interface MaskRect {
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
  anchorText?: string;
  pageThumbnail?: string;
  pageThumbnailMaskFrac?: { x: number; y: number; w: number; h: number };
  autoDetect?: boolean;
}

export interface MaskRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MaskDefinition {
  id: string;
  label: string;
  page?: number;
  anchorText?: string;
  pageThumbnail?: string;
  pageThumbnailMaskFrac?: { x: number; y: number; w: number; h: number };
  autoDetect?: boolean;
  regions: MaskRegion[];
  weight?: number;
  regionWeights?: number[];
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

export interface MultiSignatureRegion {
  dataUrl: string;
  maskDef: MaskDefinition;
  page: number;
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
  masks2?: MaskDefinition[] | null;
  created_at: string;
}

export type AppStep = 'upload' | 'mask' | 'preview' | 'results';

export interface MaskScoreBreakdown {
  maskIndex: number;
  maskLabel: string;
  page: number;
  score: number;
  weight?: number;
  sigDataUrl?: string;
}

export interface ProcessResponse {
  jobId: string;
  confidenceScore: number;
  status: string;
  resultUrl: string;
  matchedPage1?: number;
  matchedPage2?: number;
  mode?: 'lenient' | 'strict' | 'super_lenient';
  maskBreakdown?: MaskScoreBreakdown[];
}

export type CompareMode = 'lenient' | 'strict' | 'super_lenient';

export type AppView =
  | 'app'
  | 'history'
  | 'masks'
  | 'profile'
  | 'api-keys'
  | 'api-docs'
  | 'api-test'
  | 'customers'
  | 'theming'
  | 'templates';

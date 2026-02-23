import { useRef, useState, useCallback } from 'react';
import { Upload, X, ImageIcon, FileText, Loader2 } from 'lucide-react';
import type { UploadedFile } from '../types';
import { getPdfPageCount } from '../lib/imageUtils';

interface Props {
  label: string;
  file: UploadedFile | null;
  onFile: (f: UploadedFile) => void;
  onClear: () => void;
}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024;

export default function FileDropZone({ label, file, onFile, onClear }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const processFile = useCallback(async (f: File) => {
    setError(null);
    if (!ACCEPTED.includes(f.type)) {
      setError('Unsupported format. Use PDF, PNG, JPG, or JPEG.');
      return;
    }
    if (f.size > MAX_SIZE) {
      setError('File too large. Maximum size is 10MB.');
      return;
    }
    setProcessing(true);
    const url = URL.createObjectURL(f);
    let pageCount: number | undefined;
    if (f.type === 'application/pdf') {
      try { pageCount = await getPdfPageCount(f); } catch { pageCount = 1; }
    }
    onFile({
      file: f,
      previewUrl: url,
      type: f.type === 'application/pdf' ? 'pdf' : 'image',
      pageCount,
    });
    setProcessing(false);
  }, [onFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) processFile(dropped);
  }, [processFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) processFile(picked);
  };

  if (file) {
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-2xl overflow-hidden">
        <div className="p-4 flex items-start gap-3">
          <div className="p-2 bg-teal-600/20 rounded-lg shrink-0">
            {file.type === 'pdf' ? (
              <FileText size={20} className="text-teal-400" />
            ) : (
              <ImageIcon size={20} className="text-teal-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">{file.file.name}</p>
            <p className="text-slate-400 text-xs mt-0.5">
              {(file.file.size / 1024).toFixed(0)} KB &middot; {file.type.toUpperCase()}
              {file.pageCount && file.pageCount > 1 && (
                <span className="ml-1 text-teal-400">&middot; {file.pageCount} pages</span>
              )}
            </p>
          </div>
          <button
            onClick={onClear}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {file.type === 'image' && (
          <div className="px-4 pb-4">
            <img
              src={file.previewUrl}
              alt="Preview"
              className="w-full h-36 object-contain bg-slate-900 rounded-xl border border-slate-700"
            />
          </div>
        )}
        {file.type === 'pdf' && (
          <div className="px-4 pb-4">
            <div className="w-full h-20 bg-slate-900 rounded-xl border border-slate-700 flex items-center justify-center gap-3">
              <FileText size={24} className="text-slate-500" />
              <p className="text-slate-400 text-xs">
                {file.pageCount === 1 ? '1 page' : `${file.pageCount} pages`}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer ${
        dragging
          ? 'border-teal-400 bg-teal-500/10'
          : 'border-slate-600 hover:border-slate-400 hover:bg-slate-800/50'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !processing && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        onChange={onInputChange}
      />
      <div className="p-8 flex flex-col items-center gap-3 text-center">
        <div className={`p-3 rounded-2xl transition-colors ${dragging ? 'bg-teal-500/20' : 'bg-slate-800'}`}>
          {processing ? (
            <Loader2 size={24} className="text-teal-400 animate-spin" />
          ) : (
            <Upload size={24} className={dragging ? 'text-teal-400' : 'text-slate-400'} />
          )}
        </div>
        <div>
          <p className="text-white font-medium text-sm">{processing ? 'Reading file...' : label}</p>
          <p className="text-slate-400 text-xs mt-1">Drag and drop or click to browse</p>
          <p className="text-slate-500 text-xs mt-1">PDF, PNG, JPG up to 10MB</p>
        </div>
        {error && (
          <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

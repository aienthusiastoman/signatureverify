import { useState, useCallback } from 'react';
import { supabase, UPLOADS_BUCKET, RESULTS_BUCKET, getPublicUrl } from '../lib/supabase';
import { canvasToBlob, dataUrlToBlob } from '../lib/imageUtils';
import type { SignatureRegion, VerificationJob, ProcessResponse } from '../types';

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signature-process`;

export function useSignatureProcess() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<VerificationJob | null>(null);
  const [result, setResult] = useState<ProcessResponse | null>(null);

  const processSignatures = useCallback(async (
    file1: File,
    file2: File,
    region1: SignatureRegion,
    region2: SignatureRegion,
    scaleFile2: number = 1.5
  ) => {
    setLoading(true);
    setError(null);
    setJob(null);
    setResult(null);

    try {
      const ts = Date.now();
      const ext1 = file1.name.split('.').pop() || 'png';
      const ext2 = file2.name.split('.').pop() || 'png';
      const path1 = `uploads/${ts}_1.${ext1}`;
      const path2 = `uploads/${ts}_2.${ext2}`;

      const [upload1, upload2] = await Promise.all([
        supabase.storage.from(UPLOADS_BUCKET).upload(path1, file1, { upsert: true }),
        supabase.storage.from(UPLOADS_BUCKET).upload(path2, file2, { upsert: true }),
      ]);

      if (upload1.error) throw new Error(`Upload 1 failed: ${upload1.error.message}`);
      if (upload2.error) throw new Error(`Upload 2 failed: ${upload2.error.message}`);

      const sig1Blob = dataUrlToBlob(region1.dataUrl);
      const sig2Blob = dataUrlToBlob(region2.dataUrl);

      const formData = new FormData();
      formData.append('signature1', sig1Blob, 'sig1.png');
      formData.append('signature2', sig2Blob, 'sig2.png');
      formData.append('file1_name', file1.name);
      formData.append('file2_name', file2.name);
      formData.append('file1_path', path1);
      formData.append('file2_path', path2);
      formData.append('mask1', JSON.stringify(region1.mask));
      formData.append('mask2', JSON.stringify(region2.mask));
      formData.append('scale_file2', String(scaleFile2));

      const response = await fetch(EDGE_FN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Processing failed: ${errText}`);
      }

      const data: ProcessResponse = await response.json();
      setResult(data);

      const { data: jobData } = await supabase
        .from('verification_jobs')
        .select('*')
        .eq('id', data.jobId)
        .maybeSingle();

      if (jobData) setJob(jobData as VerificationJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, job, result, processSignatures };
}

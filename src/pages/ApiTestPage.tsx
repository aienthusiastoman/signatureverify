import { useState, useEffect, useCallback } from 'react';
import { FlaskConical, Play, Copy, CheckCircle, Loader2, Upload, X, ChevronDown, LayoutTemplate, Layers } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { renderPdfPageToCanvas, canvasToBlob, findPageByAnchorText, findPageBySignatureBlob, extractRegion, extractCompositeRegion } from '../lib/imageUtils';
import type { SavedTemplate, MaskRect, MaskDefinition } from '../types';

type Language = 'curl' | 'javascript' | 'python' | 'php' | 'go';
type CompareMode = 'lenient' | 'strict' | 'super_lenient';

const LANG_LABELS: Record<Language, string> = {
  curl: 'cURL',
  javascript: 'JavaScript',
  python: 'Python',
  php: 'PHP',
  go: 'Go',
};

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
}

interface MaskInput {
  x: string;
  y: string;
  width: string;
  height: string;
  page: string;
  anchorText?: string;
}

const BLANK_MASK: MaskInput = { x: '100', y: '400', width: '300', height: '100', page: '1' };

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signature-process`;

function maskToInput(m: MaskRect): MaskInput {
  return {
    x: String(m.x),
    y: String(m.y),
    width: String(m.width),
    height: String(m.height),
    page: String(m.page ?? 1),
    anchorText: m.anchorText,
  };
}

function buildCode(
  lang: Language,
  file1Name: string,
  file2Name: string,
  mask1: MaskInput,
  mask2: MaskInput,
  keyLabel: string,
  mode: CompareMode,
  templateId?: string,
  templateName?: string,
): string {
  const m1 = `{"x":${mask1.x},"y":${mask1.y},"width":${mask1.width},"height":${mask1.height},"page":${mask1.page}}`;
  const m2 = `{"x":${mask2.x},"y":${mask2.y},"width":${mask2.width},"height":${mask2.height},"page":${mask2.page}}`;

  if (templateId) {
    const nameComment = templateName ? ` # ${templateName}` : '';

    if (lang === 'curl') return `curl -X POST "${ENDPOINT}" \\
  -H "Authorization: Bearer ${keyLabel}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template_id": "${templateId}",${nameComment}
    "file1_base64": "<BASE64_OF_${file1Name.toUpperCase()}>",
    "file2_base64": "<BASE64_OF_${file2Name.toUpperCase()}>",
    "file1_name": "${file1Name}",
    "file2_name": "${file2Name}",
    "mode": "${mode}"
  }'`;

    if (lang === 'javascript') return `const toB64 = f => new Promise(r => {
  const reader = new FileReader();
  reader.onload = () => r(reader.result.split(',')[1]);
  reader.readAsDataURL(f);
});

const res = await fetch('${ENDPOINT}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${keyLabel}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    template_id: '${templateId}', // ${templateName ?? ''}
    file1_base64: await toB64(file1),
    file2_base64: await toB64(file2),
    file1_name: '${file1Name}',
    file2_name: '${file2Name}',
    mode: '${mode}',
  }),
});
const data = await res.json();
console.log(data.confidenceScore, data.mode);`;

    if (lang === 'python') return `import requests, base64

def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode()

res = requests.post(
    '${ENDPOINT}',
    headers={
        'Authorization': 'Bearer ${keyLabel}',
        'Content-Type': 'application/json',
    },
    json={
        'template_id': '${templateId}',  # ${templateName ?? ''}
        'file1_base64': b64('${file1Name}'),
        'file2_base64': b64('${file2Name}'),
        'file1_name': '${file1Name}',
        'file2_name': '${file2Name}',
        'mode': '${mode}',
    }
)
print(res.json())`;

    if (lang === 'php') return `<?php
$payload = json_encode([
    'template_id'  => '${templateId}', // ${templateName ?? ''}
    'file1_base64' => base64_encode(file_get_contents('${file1Name}')),
    'file2_base64' => base64_encode(file_get_contents('${file2Name}')),
    'file1_name'   => '${file1Name}',
    'file2_name'   => '${file2Name}',
    'mode'         => '${mode}',
]);
$ch = curl_init('${ENDPOINT}');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ${keyLabel}',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => $payload,
]);
echo curl_exec($ch);`;

    if (lang === 'go') return `package main

import (
    "bytes", "encoding/base64", "encoding/json",
    "fmt", "io", "net/http", "os"
)

func main() {
    payload, _ := json.Marshal(map[string]any{
        "template_id": "${templateId}", // ${templateName ?? ''}
        "file1_base64": func() string {
            d, _ := os.ReadFile("${file1Name}"); return base64.StdEncoding.EncodeToString(d)
        }(),
        "file2_base64": func() string {
            d, _ := os.ReadFile("${file2Name}"); return base64.StdEncoding.EncodeToString(d)
        }(),
        "file1_name": "${file1Name}",
        "file2_name": "${file2Name}",
        "mode": "${mode}",
    })
    req, _ := http.NewRequest("POST", "${ENDPOINT}", bytes.NewReader(payload))
    req.Header.Set("Authorization", "Bearer ${keyLabel}")
    req.Header.Set("Content-Type", "application/json")
    resp, _ := http.DefaultClient.Do(req)
    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}`;
  }

  if (lang === 'curl') return `curl -X POST "${ENDPOINT}" \\
  -H "Authorization: Bearer ${keyLabel}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "file1_base64": "<BASE64_OF_${file1Name.toUpperCase()}>",
    "file2_base64": "<BASE64_OF_${file2Name.toUpperCase()}>",
    "file1_name": "${file1Name}",
    "file2_name": "${file2Name}",
    "mask1": ${m1},
    "mask2": ${m2},
    "mode": "${mode}"
  }'`;

  if (lang === 'javascript') return `const toB64 = f => new Promise(r => {
  const reader = new FileReader();
  reader.onload = () => r(reader.result.split(',')[1]);
  reader.readAsDataURL(f);
});

const res = await fetch('${ENDPOINT}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ${keyLabel}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    file1_base64: await toB64(file1),
    file2_base64: await toB64(file2),
    file1_name: '${file1Name}',
    file2_name: '${file2Name}',
    mask1: ${m1},
    mask2: ${m2},
    mode: '${mode}',
  }),
});
const data = await res.json();
console.log(data.confidenceScore, data.mode);`;

  if (lang === 'python') return `import requests, base64

def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode()

res = requests.post(
    '${ENDPOINT}',
    headers={
        'Authorization': 'Bearer ${keyLabel}',
        'Content-Type': 'application/json',
    },
    json={
        'file1_base64': b64('${file1Name}'),
        'file2_base64': b64('${file2Name}'),
        'file1_name': '${file1Name}',
        'file2_name': '${file2Name}',
        'mask1': ${m1},
        'mask2': ${m2},
        'mode': '${mode}',
    }
)
print(res.json())`;

  if (lang === 'php') return `<?php
$payload = json_encode([
    'file1_base64' => base64_encode(file_get_contents('${file1Name}')),
    'file2_base64' => base64_encode(file_get_contents('${file2Name}')),
    'file1_name'   => '${file1Name}',
    'file2_name'   => '${file2Name}',
    'mask1' => json_decode('${m1}', true),
    'mask2' => json_decode('${m2}', true),
    'mode'  => '${mode}',
]);
$ch = curl_init('${ENDPOINT}');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ${keyLabel}',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => $payload,
]);
echo curl_exec($ch);`;

  if (lang === 'go') return `package main

import (
    "bytes", "encoding/base64", "encoding/json",
    "fmt", "io", "net/http", "os"
)

func main() {
    payload, _ := json.Marshal(map[string]any{
        "file1_base64": func() string {
            d, _ := os.ReadFile("${file1Name}"); return base64.StdEncoding.EncodeToString(d)
        }(),
        "file2_base64": func() string {
            d, _ := os.ReadFile("${file2Name}"); return base64.StdEncoding.EncodeToString(d)
        }(),
        "file1_name": "${file1Name}",
        "file2_name": "${file2Name}",
        "mask1": map[string]int{"x":${mask1.x},"y":${mask1.y},"width":${mask1.width},"height":${mask1.height},"page":${mask1.page}},
        "mask2": map[string]int{"x":${mask2.x},"y":${mask2.y},"width":${mask2.width},"height":${mask2.height},"page":${mask2.page}},
        "mode": "${mode}",
    })
    req, _ := http.NewRequest("POST", "${ENDPOINT}", bytes.NewReader(payload))
    req.Header.Set("Authorization", "Bearer ${keyLabel}")
    req.Header.Set("Content-Type", "application/json")
    resp, _ := http.DefaultClient.Do(req)
    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}`;

  return '';
}

function MaskFields({ label, value, onChange }: { label: string; value: MaskInput; onChange: (v: MaskInput) => void }) {
  const field = (key: keyof MaskInput, placeholder: string) => (
    <div className="space-y-1">
      <label className="text-slate-500 text-xs">{placeholder}</label>
      <input
        type="number"
        value={value[key]}
        onChange={e => onChange({ ...value, [key]: e.target.value })}
        className="w-full bg-slate-800 border border-slate-700 focus:border-teal-500 text-white text-sm rounded-lg px-3 py-2 outline-none transition-colors"
        placeholder="0"
      />
    </div>
  );
  return (
    <div>
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">{label}</p>
      <div className="grid grid-cols-5 gap-2">
        {field('x', 'X')} {field('y', 'Y')} {field('width', 'Width')}
        {field('height', 'Height')} {field('page', 'Page')}
      </div>
    </div>
  );
}

export default function ApiTestPage() {
  const { user, session } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState('');
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [useTemplate, setUseTemplate] = useState(false);
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [mask1, setMask1] = useState<MaskInput>(BLANK_MASK);
  const [mask2, setMask2] = useState<MaskInput>(BLANK_MASK);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [responseOk, setResponseOk] = useState(true);
  const [lang, setLang] = useState<Language>('curl');
  const [compareMode, setCompareMode] = useState<CompareMode>('lenient');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  const fetchKeys = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    const keys = (data as ApiKey[]) ?? [];
    setApiKeys(keys);
    if (keys.length > 0) setSelectedKeyId(keys[0].id);
  }, [user]);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('templates')
      .select('id, name, mask1, mask2, masks2, created_at')
      .order('created_at', { ascending: false });
    setTemplates((data as SavedTemplate[]) ?? []);
  }, [user]);

  useEffect(() => { fetchKeys(); fetchTemplates(); }, [fetchKeys, fetchTemplates]);

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  const activeMask1 = useTemplate && selectedTemplate ? maskToInput(selectedTemplate.mask1) : mask1;
  const activeMask2 = useTemplate && selectedTemplate ? maskToInput(selectedTemplate.mask2) : mask2;

  const selectedKey = apiKeys.find(k => k.id === selectedKeyId);
  const keyLabel = selectedKey ? `${selectedKey.key_prefix}••••••••••••` : 'svk_live_YOUR_KEY';

  const toBase64 = async (file: File, pageNum = 1): Promise<string> => {
    if (file.type === 'application/pdf') {
      const canvas = await renderPdfPageToCanvas(file, pageNum);
      const blob = await canvasToBlob(canvas);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.includes(',') ? result.split(',')[1] : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const resolvePageForFile = async (file: File, mask: MaskInput, scanPages: boolean): Promise<number> => {
    const defaultPage = +mask.page || 1;
    if (file.type !== 'application/pdf' || !scanPages) return defaultPage;
    const m = { x: +mask.x, y: +mask.y, width: +mask.width, height: +mask.height };

    const canvas = await renderPdfPageToCanvas(file, defaultPage);
    const pw = canvas.width, ph = canvas.height;
    if (pw > 0 && ph > 0 && m.width > 5 && m.height > 5) {
      const frac = { x: m.x / pw, y: m.y / ph, w: m.width / pw, h: m.height / ph };
      return await findPageBySignatureBlob(file, frac);
    }

    if (mask.anchorText?.trim()) {
      const found = await findPageByAnchorText(file, mask.anchorText, m);
      if (found !== null) return found;
    }

    return defaultPage;
  };

  const renderFilePageCanvas = async (file: File, page: number): Promise<HTMLCanvasElement> => {
    if (file.type === 'application/pdf') return renderPdfPageToCanvas(file, page);
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const resolveMaskDefPage = async (file: File, maskDef: MaskDefinition): Promise<number> => {
    if (file.type !== 'application/pdf') return maskDef.page ?? 1;
    const firstRegion = maskDef.regions[0];
    if (firstRegion && firstRegion.width > 5) {
      const refCanvas = await renderPdfPageToCanvas(file, maskDef.page ?? 1);
      const rw = refCanvas.width, rh = refCanvas.height;
      if (rw > 0 && rh > 0) {
        const frac = { x: firstRegion.x / rw, y: firstRegion.y / rh, w: firstRegion.width / rw, h: firstRegion.height / rh };
        return findPageBySignatureBlob(file, frac);
      }
    }
    if (maskDef.anchorText?.trim()) {
      const pseudoMask: MaskRect = firstRegion
        ? { x: firstRegion.x, y: firstRegion.y, width: firstRegion.width, height: firstRegion.height, page: maskDef.page }
        : { x: 0, y: 0, width: 0, height: 0, page: maskDef.page };
      const found = await findPageByAnchorText(file, maskDef.anchorText, pseudoMask);
      if (found !== null) return found;
    }
    return maskDef.page ?? 1;
  };

  const handleRun = async () => {
    if (!file1 || !file2) return;
    setLoading(true);
    setResponse(null);

    try {
      const isMultiMaskTemplate = useTemplate && selectedTemplate?.masks2 && selectedTemplate.masks2.length > 1;

      if (isMultiMaskTemplate && selectedTemplate?.masks2) {
        const masks2 = selectedTemplate.masks2;

        const page1 = await resolvePageForFile(file1, activeMask1, false);
        const c1 = await renderFilePageCanvas(file1, page1);
        const mask1Rect: MaskRect = { x: +activeMask1.x, y: +activeMask1.y, width: +activeMask1.width, height: +activeMask1.height, page: page1 };
        const crop1Canvas = extractRegion(c1, mask1Rect);
        const sig1Blob = await canvasToBlob(crop1Canvas);

        const formData = new FormData();
        formData.append('signature1', sig1Blob, 'sig1.png');
        formData.append('file1_name', file1.name);
        formData.append('file2_name', file2.name);
        formData.append('mask1', JSON.stringify(mask1Rect));
        formData.append('matched_page1', String(page1));
        formData.append('mode', compareMode);
        formData.append('multi_mask_mode', 'true');

        for (let i = 0; i < masks2.length; i++) {
          const maskDef = masks2[i];
          const resolvedPage = await resolveMaskDefPage(file2, maskDef);
          const c2 = await renderFilePageCanvas(file2, resolvedPage);
          const cropCanvas = extractCompositeRegion(c2, maskDef.regions.length > 0 ? maskDef.regions : [{ x: 0, y: 0, width: c2.width, height: c2.height }]);
          const sigBlob = await canvasToBlob(cropCanvas);
          formData.append(`signature2_${i}`, sigBlob, `sig2_${i}.png`);
          formData.append(`mask2_${i}_label`, maskDef.label);
          formData.append(`mask2_${i}_page`, String(resolvedPage));
        }
        formData.append('mask2_count', String(masks2.length));

        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: formData,
        });
        const data = await res.json();
        setResponseOk(res.ok);
        setResponse(JSON.stringify(data, null, 2));
        return;
      }

      const [page1, page2] = await Promise.all([
        resolvePageForFile(file1, activeMask1, false),
        resolvePageForFile(file2, activeMask2, true),
      ]);

      const [b64_1, b64_2] = await Promise.all([toBase64(file1, page1), toBase64(file2, page2)]);

      const payload: Record<string, unknown> = {
        file1_base64: b64_1,
        file2_base64: b64_2,
        file1_name: file1.name,
        file2_name: file2.name,
        mask1: { x: +activeMask1.x, y: +activeMask1.y, width: +activeMask1.width, height: +activeMask1.height, page: page1 },
        mask2: { x: +activeMask2.x, y: +activeMask2.y, width: +activeMask2.width, height: +activeMask2.height, page: page2 },
        matched_page1: page1,
        matched_page2: page2,
        mode: compareMode,
      };

      if (useTemplate && selectedTemplateId) {
        payload.template_id = selectedTemplateId;
      }

      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setResponseOk(res.ok);
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponseOk(false);
      setResponse(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const templateIdForCode = useTemplate && selectedTemplateId ? selectedTemplateId : undefined;
  const templateNameForCode = useTemplate && selectedTemplate ? selectedTemplate.name : undefined;
  const codeExample = buildCode(lang, file1?.name || 'document1.pdf', file2?.name || 'document2.pdf', activeMask1, activeMask2, keyLabel, compareMode, templateIdForCode, templateNameForCode);

  const copyCode = () => { navigator.clipboard.writeText(codeExample); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };
  const copyResponse = () => { if (!response) return; navigator.clipboard.writeText(response); setCopiedResponse(true); setTimeout(() => setCopiedResponse(false), 2000); };

  const FileInput = ({ label, file, onFile, onClear }: { label: string; file: File | null; onFile: (f: File) => void; onClear: () => void }) => (
    <div>
      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2">{label}</p>
      {file ? (
        <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{file.name}</p>
            <p className="text-slate-500 text-xs">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button onClick={onClear} className="text-slate-500 hover:text-red-400 transition-colors p-1">
            <X size={15} />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-2 border-2 border-dashed border-slate-700 hover:border-teal-500/50 rounded-xl p-5 cursor-pointer transition-colors group">
          <Upload size={18} className="text-slate-600 group-hover:text-teal-500 transition-colors" />
          <span className="text-slate-500 text-xs group-hover:text-slate-400 transition-colors">Click to upload PDF / image</span>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-500/15 border border-teal-500/30 rounded-xl flex items-center justify-center">
          <FlaskConical size={18} className="text-teal-400" />
        </div>
        <div>
          <h1 className="text-white text-xl font-black">API Testing</h1>
          <p className="text-slate-400 text-sm font-light">Test the API live and get generated code snippets</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-5 space-y-5">
            <h2 className="text-white font-bold text-sm">Request Configuration</h2>

            {apiKeys.length > 0 && (
              <div>
                <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-2 block">API Key</label>
                <div className="relative">
                  <select
                    value={selectedKeyId}
                    onChange={e => setSelectedKeyId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 focus:border-teal-500 text-white text-sm rounded-xl px-4 py-3 outline-none transition-colors appearance-none pr-10"
                  >
                    {apiKeys.map(k => (
                      <option key={k.id} value={k.id}>{k.name} ({k.key_prefix}••••)</option>
                    ))}
                  </select>
                  <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            )}

            <FileInput label="Document 1 — Reference" file={file1} onFile={setFile1} onClear={() => setFile1(null)} />
            <FileInput label="Document 2 — To Verify" file={file2} onFile={setFile2} onClear={() => setFile2(null)} />

            <div className="pt-1 border-t border-slate-700/40 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-white text-sm font-bold">Signature Regions</p>
                <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setUseTemplate(false)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      !useTemplate ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Coordinates
                  </button>
                  <button
                    onClick={() => setUseTemplate(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      useTemplate ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LayoutTemplate size={12} /> Template
                  </button>
                </div>
              </div>

              {useTemplate ? (
                <div className="space-y-3">
                  {templates.length === 0 ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-800/60 border border-slate-700/40 rounded-xl text-slate-500 text-sm">
                      <LayoutTemplate size={15} />
                      No templates saved yet. Create one in the Verify tool.
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <select
                          value={selectedTemplateId}
                          onChange={e => setSelectedTemplateId(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 focus:border-teal-500 text-white text-sm rounded-xl px-4 py-3 outline-none transition-colors appearance-none pr-10"
                        >
                          <option value="">— Select a template —</option>
                          {templates.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>

                      {selectedTemplate && (
                        <div className="text-xs font-mono bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/40 space-y-3">
                          <div>
                            <p className="text-slate-500 mb-1">Doc 1 — Region</p>
                            <p className="text-slate-300">x:{selectedTemplate.mask1.x} y:{selectedTemplate.mask1.y} {selectedTemplate.mask1.width}×{selectedTemplate.mask1.height} p{selectedTemplate.mask1.page ?? 1}</p>
                            {selectedTemplate.mask1.anchorText && (
                              <p className="text-teal-400 mt-0.5 truncate" title={selectedTemplate.mask1.anchorText}>anchor: {selectedTemplate.mask1.anchorText}</p>
                            )}
                          </div>
                          {selectedTemplate.masks2 && selectedTemplate.masks2.length > 0 ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <Layers size={10} />
                                <span>Doc 2 — {selectedTemplate.masks2.length} mask{selectedTemplate.masks2.length > 1 ? 's' : ''}</span>
                              </div>
                              {selectedTemplate.masks2.map((m) => (
                                <div key={m.id} className="pl-2 border-l border-slate-700">
                                  <p className="text-amber-400">{m.label} — p{m.page ?? 1}</p>
                                  {m.regions.map((r, ri) => (
                                    <p key={ri} className="text-slate-400">x:{r.x} y:{r.y} {r.width}×{r.height}</p>
                                  ))}
                                  {m.autoDetect && <p className="text-teal-400">auto-detect</p>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div>
                              <p className="text-slate-500 mb-1">Doc 2 — Region</p>
                              <p className="text-slate-300">x:{selectedTemplate.mask2.x} y:{selectedTemplate.mask2.y} {selectedTemplate.mask2.width}×{selectedTemplate.mask2.height} p{selectedTemplate.mask2.page ?? 1}</p>
                              {selectedTemplate.mask2.anchorText && (
                                <p className="text-teal-400 mt-0.5 truncate" title={selectedTemplate.mask2.anchorText}>anchor: {selectedTemplate.mask2.anchorText}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <MaskFields label="Region 1 — Document 1 (px)" value={mask1} onChange={setMask1} />
                  <MaskFields label="Region 2 — Document 2 (px)" value={mask2} onChange={setMask2} />
                </div>
              )}
            </div>

            <div className="pt-1 border-t border-slate-700/40 space-y-2">
              <label className="text-slate-400 text-xs font-semibold uppercase tracking-wide block">Comparison Mode</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setCompareMode('lenient')}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all border ${
                    compareMode === 'lenient'
                      ? 'bg-teal-500/15 border-teal-500/50 text-white'
                      : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="font-bold">Lenient</p>
                  <p className="opacity-60 mt-0.5 font-normal">Overall shape match</p>
                </button>
                <button
                  onClick={() => setCompareMode('strict')}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all border ${
                    compareMode === 'strict'
                      ? 'bg-amber-500/15 border-amber-500/50 text-white'
                      : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="font-bold">Strict</p>
                  <p className="opacity-60 mt-0.5 font-normal">Precise curve matching</p>
                </button>
                <button
                  onClick={() => setCompareMode('super_lenient')}
                  className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all border ${
                    compareMode === 'super_lenient'
                      ? 'bg-sky-500/15 border-sky-500/50 text-white'
                      : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:text-white'
                  }`}
                >
                  <p className="font-bold">Super Lenient</p>
                  <p className="opacity-60 mt-0.5 font-normal">2× boost, wide dilation</p>
                </button>
              </div>
            </div>

            <button
              onClick={handleRun}
              disabled={!file1 || !file2 || loading || (useTemplate && !selectedTemplateId && templates.length > 0)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg shadow-teal-500/20"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Running...</>
                : <><Play size={16} /> Run Test</>}
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-white font-bold text-sm">Response</h2>
                {!loading && response && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    responseOk ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                  }`}>
                    {responseOk ? '200 OK' : 'Error'}
                  </span>
                )}
              </div>
              {response && (
                <button
                  onClick={copyResponse}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold transition-colors text-slate-300"
                >
                  {copiedResponse ? <><CheckCircle size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              )}
            </div>
            <div className="p-5 min-h-[140px]">
              {loading && (
                <div className="flex items-center gap-3 text-slate-400">
                  <Loader2 size={16} className="animate-spin text-teal-500" />
                  <span className="text-sm">Waiting for response...</span>
                </div>
              )}
              {!loading && !response && (
                <p className="text-slate-600 text-sm italic">Run a test to see the response here.</p>
              )}
              {response && (
                <pre className="text-slate-300 text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
                  {response}
                </pre>
              )}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-700/40 flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-white font-bold text-sm">Code Example</h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 bg-slate-800 rounded-lg p-0.5">
                  {(Object.keys(LANG_LABELS) as Language[]).map(l => (
                    <button
                      key={l}
                      onClick={() => setLang(l)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        lang === l ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {LANG_LABELS[l]}
                    </button>
                  ))}
                </div>
                <button
                  onClick={copyCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold transition-colors text-slate-300"
                >
                  {copiedCode ? <><CheckCircle size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
            </div>
            <div className="p-5">
              <pre className="text-slate-300 text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
                {codeExample}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

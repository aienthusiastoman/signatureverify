import { useState } from 'react';
import { BookOpen, Copy, CheckCircle, ChevronDown, ChevronUp, Terminal, Code } from 'lucide-react';

type Language = 'curl' | 'javascript' | 'python' | 'php' | 'go';

const LANG_LABELS: Record<Language, string> = {
  curl: 'cURL',
  javascript: 'JavaScript',
  python: 'Python',
  php: 'PHP',
  go: 'Go',
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ENDPOINT = `${SUPABASE_URL}/functions/v1/signature-process`;

function buildExamples(lang: Language, section: string): string {
  const authHeader = `Authorization: Bearer svk_live_YOUR_KEY`;

  if (section === 'multipart') {
    if (lang === 'curl') return `curl -X POST "${ENDPOINT}" \\
  -H "${authHeader}" \\
  -F "signature1=@/path/to/region1.png" \\
  -F "signature2=@/path/to/region2.png" \\
  -F "file1_name=document1.pdf" \\
  -F "file2_name=document2.pdf"`;

    if (lang === 'javascript') return `const form = new FormData();
form.append('signature1', file1Blob, 'sig1.png');
form.append('signature2', file2Blob, 'sig2.png');
form.append('file1_name', 'document1.pdf');
form.append('file2_name', 'document2.pdf');

const res = await fetch('${ENDPOINT}', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer svk_live_YOUR_KEY' },
  body: form,
});
const data = await res.json();
console.log(data.confidenceScore);`;

    if (lang === 'python') return `import requests

with open('sig1.png', 'rb') as f1, open('sig2.png', 'rb') as f2:
    res = requests.post(
        '${ENDPOINT}',
        headers={'Authorization': 'Bearer svk_live_YOUR_KEY'},
        files={
            'signature1': ('sig1.png', f1, 'image/png'),
            'signature2': ('sig2.png', f2, 'image/png'),
        },
        data={
            'file1_name': 'document1.pdf',
            'file2_name': 'document2.pdf',
        }
    )
print(res.json())`;

    if (lang === 'php') return `<?php
$curl = curl_init('${ENDPOINT}');
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer svk_live_YOUR_KEY',
    ],
    CURLOPT_POSTFIELDS => [
        'signature1' => new CURLFile('/path/sig1.png', 'image/png', 'sig1.png'),
        'signature2' => new CURLFile('/path/sig2.png', 'image/png', 'sig2.png'),
        'file1_name' => 'document1.pdf',
        'file2_name' => 'document2.pdf',
    ],
]);
$response = curl_exec($curl);
echo $response;`;

    if (lang === 'go') return `package main

import (
    "bytes"
    "fmt"
    "io"
    "mime/multipart"
    "net/http"
    "os"
)

func main() {
    var buf bytes.Buffer
    w := multipart.NewWriter(&buf)
    for _, pair := range [][]string{{"signature1","sig1.png"},{"signature2","sig2.png"}} {
        fw, _ := w.CreateFormFile(pair[0], pair[1])
        f, _ := os.Open(pair[1])
        io.Copy(fw, f)
    }
    w.WriteField("file1_name", "document1.pdf")
    w.WriteField("file2_name", "document2.pdf")
    w.Close()

    req, _ := http.NewRequest("POST", "${ENDPOINT}", &buf)
    req.Header.Set("Authorization", "Bearer svk_live_YOUR_KEY")
    req.Header.Set("Content-Type", w.FormDataContentType())
    resp, _ := http.DefaultClient.Do(req)
    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}`;
  }

  if (section === 'base64') {
    if (lang === 'curl') return `curl -X POST "${ENDPOINT}" \\
  -H "${authHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "file1_base64": "JVBERi0x...",
    "file2_base64": "JVBERi0x...",
    "file1_name": "doc1.pdf",
    "file2_name": "doc2.pdf",
    "mask1": {"x":100,"y":400,"width":300,"height":100,"page":1},
    "mask2": {"x":100,"y":400,"width":300,"height":100,"page":1}
  }'`;

    if (lang === 'javascript') return `const toBase64 = (file) =>
  new Promise(res => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.readAsDataURL(file);
  });

const res = await fetch('${ENDPOINT}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer svk_live_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    file1_base64: await toBase64(file1),
    file2_base64: await toBase64(file2),
    file1_name: 'doc1.pdf',
    file2_name: 'doc2.pdf',
    mask1: { x:100, y:400, width:300, height:100, page:1 },
    mask2: { x:100, y:400, width:300, height:100, page:1 },
  }),
});
const data = await res.json();`;

    if (lang === 'python') return `import requests, base64

def b64(path):
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode()

res = requests.post(
    '${ENDPOINT}',
    headers={
        'Authorization': 'Bearer svk_live_YOUR_KEY',
        'Content-Type': 'application/json',
    },
    json={
        'file1_base64': b64('doc1.pdf'),
        'file2_base64': b64('doc2.pdf'),
        'file1_name': 'doc1.pdf',
        'file2_name': 'doc2.pdf',
        'mask1': {'x':100,'y':400,'width':300,'height':100,'page':1},
        'mask2': {'x':100,'y':400,'width':300,'height':100,'page':1},
    }
)
print(res.json())`;

    if (lang === 'php') return `<?php
$payload = json_encode([
    'file1_base64' => base64_encode(file_get_contents('doc1.pdf')),
    'file2_base64' => base64_encode(file_get_contents('doc2.pdf')),
    'file1_name'   => 'doc1.pdf',
    'file2_name'   => 'doc2.pdf',
    'mask1' => ['x'=>100,'y'=>400,'width'=>300,'height'=>100,'page'=>1],
    'mask2' => ['x'=>100,'y'=>400,'width'=>300,'height'=>100,'page'=>1],
]);
$curl = curl_init('${ENDPOINT}');
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer svk_live_YOUR_KEY',
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => $payload,
]);
echo curl_exec($curl);`;

    if (lang === 'go') return `package main

import (
    "bytes"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
)

func b64(path string) string {
    data, _ := os.ReadFile(path)
    return base64.StdEncoding.EncodeToString(data)
}

func main() {
    payload, _ := json.Marshal(map[string]any{
        "file1_base64": b64("doc1.pdf"),
        "file2_base64": b64("doc2.pdf"),
        "file1_name":   "doc1.pdf",
        "file2_name":   "doc2.pdf",
        "mask1": map[string]int{"x":100,"y":400,"width":300,"height":100,"page":1},
        "mask2": map[string]int{"x":100,"y":400,"width":300,"height":100,"page":1},
    })
    req, _ := http.NewRequest("POST", "${ENDPOINT}", bytes.NewReader(payload))
    req.Header.Set("Authorization", "Bearer svk_live_YOUR_KEY")
    req.Header.Set("Content-Type", "application/json")
    resp, _ := http.DefaultClient.Do(req)
    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}`;
  }

  if (section === 'template') {
    if (lang === 'curl') return `curl -X POST "${ENDPOINT}" \\
  -H "${authHeader}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "file1_base64": "JVBERi0x...",
    "file2_base64": "JVBERi0x...",
    "file1_name": "doc1.pdf",
    "file2_name": "doc2.pdf",
    "template_id": "uuid-of-your-template"
  }'`;

    if (lang === 'javascript') return `const res = await fetch('${ENDPOINT}', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer svk_live_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    file1_base64: '...',
    file2_base64: '...',
    file1_name: 'doc1.pdf',
    file2_name: 'doc2.pdf',
    template_id: 'uuid-of-your-template',
  }),
});`;

    return `# Same pattern as base64 — replace mask coordinates with template_id\n# template_id overrides any manual mask values\n`;
  }

  return '';
}

interface DocSection {
  id: string;
  title: string;
  description: string;
  hasCode: boolean;
  codeSection?: string;
  content?: string;
}

const DOC_SECTIONS: DocSection[] = [
  {
    id: 'auth',
    title: 'Authentication',
    description: 'Pass your API key in the Authorization header with every request.',
    hasCode: false,
    content: `All API requests require your API key in the Authorization header:

Authorization: Bearer svk_live_YOUR_KEY_HERE

Generate keys from the API Keys section. Keys are prefixed with svk_live_.
Never expose your API key in client-side code or public repositories.`,
  },
  {
    id: 'multipart',
    title: 'Compare via File Upload (multipart)',
    description: 'Upload pre-extracted signature image crops directly. Best for interactive apps.',
    hasCode: true,
    codeSection: 'multipart',
  },
  {
    id: 'base64',
    title: 'Compare via Base64 PDFs',
    description: 'Send full documents as base64 with mask coordinates. Best for server-to-server.',
    hasCode: true,
    codeSection: 'base64',
  },
  {
    id: 'template',
    title: 'Using Saved Templates',
    description: 'Reference a saved template ID to skip manual coordinate entry.',
    hasCode: true,
    codeSection: 'template',
  },
  {
    id: 'response',
    title: 'Response Format',
    description: 'All endpoints return JSON with the job details and confidence score.',
    hasCode: false,
    content: `{
  "jobId": "abc-123-def-456",
  "confidenceScore": 94.7,
  "status": "completed",
  "resultUrl": "https://..."
}

confidenceScore: 0–100
  0–49   → Mismatch
  50–74  → Moderate Match
  75–100 → High Confidence Match

status: "completed" | "failed"
resultUrl: Signed URL to the PDF comparison report (valid 1 hour)`,
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold transition-colors text-font/70"
    >
      {copied ? <><CheckCircle size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

export default function ApiDocPage() {
  const [openSection, setOpenSection] = useState<string | null>('auth');
  const [lang, setLang] = useState<Language>('curl');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-theme/15 border border-theme/30 rounded-xl flex items-center justify-center">
          <BookOpen size={18} className="text-theme" />
        </div>
        <div>
          <h1 className="text-font text-xl font-black">API Documentation</h1>
          <p className="text-font/50 text-sm font-light">Complete reference for the SignatureVerify REST API</p>
        </div>
      </div>

      <div className="bg-theme/8 border border-theme/20 rounded-2xl p-4 flex items-start gap-3">
        <Terminal size={16} className="text-theme shrink-0 mt-0.5" />
        <div>
          <p className="text-theme font-semibold text-sm">Base URL</p>
          <code className="text-font/70 text-sm font-mono">{ENDPOINT}</code>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-surface border border-white/8 rounded-xl p-1 w-fit">
        {(Object.keys(LANG_LABELS) as Language[]).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              lang === l
                ? 'bg-theme text-white shadow-lg'
                : 'text-font/50 hover:text-font'
            }`}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {DOC_SECTIONS.map(section => {
          const isOpen = openSection === section.id;
          const code = section.hasCode && section.codeSection
            ? buildExamples(lang, section.codeSection)
            : section.content || '';

          return (
            <div key={section.id} className="bg-surface border border-white/8 rounded-2xl overflow-hidden">
              <button
                onClick={() => setOpenSection(isOpen ? null : section.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Code size={15} className="text-theme shrink-0" />
                  <div>
                    <p className="text-font font-bold text-sm">{section.title}</p>
                    <p className="text-font/40 text-xs font-light mt-0.5">{section.description}</p>
                  </div>
                </div>
                {isOpen
                  ? <ChevronUp size={15} className="text-font/40 shrink-0" />
                  : <ChevronDown size={15} className="text-font/40 shrink-0" />}
              </button>

              {isOpen && (
                <div className="px-5 pb-5">
                  <div className="relative">
                    <div className="absolute top-3 right-3 z-10">
                      <CopyButton text={code} />
                    </div>
                    <pre className="bg-black/30 border border-white/8 rounded-xl p-4 pt-5 text-font/70 text-xs font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto">
                      {code}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

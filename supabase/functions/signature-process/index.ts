import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Buffer } from "node:buffer";
import { createClient } from "npm:@supabase/supabase-js@2";
import Jimp from "npm:jimp@0.22.12";
import { PDFDocument, rgb, StandardFonts, PageSizes } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function binarize(img: Jimp, threshold = 180): boolean[][] {
  const w = img.getWidth();
  const h = img.getHeight();
  const bin: boolean[][] = [];
  for (let y = 0; y < h; y++) {
    bin[y] = [];
    for (let x = 0; x < w; x++) {
      const { r, g, b } = Jimp.intToRGBA(img.getPixelColor(x, y));
      bin[y][x] = (r + g + b) / 3 < threshold;
    }
  }
  return bin;
}

function labelComponents(bin: boolean[][], w: number, h: number): { labels: Int32Array; count: number } {
  const labels = new Int32Array(w * h).fill(0);
  let nextLabel = 1;
  const parent: number[] = [0];

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }

  function union(a: number, b: number) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!bin[y][x]) continue;
      const idx = y * w + x;
      const neighbors: number[] = [];
      if (x > 0 && bin[y][x - 1]) neighbors.push(labels[idx - 1]);
      if (y > 0 && bin[y - 1][x]) neighbors.push(labels[(y - 1) * w + x]);
      const validN = neighbors.filter(n => n > 0);
      if (validN.length === 0) {
        labels[idx] = nextLabel;
        parent.push(nextLabel);
        nextLabel++;
      } else {
        const minL = Math.min(...validN);
        labels[idx] = minL;
        for (const n of validN) union(minL, n);
      }
    }
  }

  for (let i = 0; i < w * h; i++) {
    if (labels[i] > 0) labels[i] = find(labels[i]);
  }

  return { labels, count: nextLabel - 1 };
}

function filterTypedText(img: Jimp): Jimp {
  const w = img.getWidth();
  const h = img.getHeight();
  const bin = binarize(img, 180);
  const { labels, count } = labelComponents(bin, w, h);

  const bboxes: { minX: number; maxX: number; minY: number; maxY: number; pixels: number }[] =
    Array.from({ length: count + 1 }, () => ({ minX: w, maxX: 0, minY: h, maxY: 0, pixels: 0 }));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const lbl = labels[y * w + x];
      if (lbl === 0) continue;
      const bb = bboxes[lbl];
      if (x < bb.minX) bb.minX = x;
      if (x > bb.maxX) bb.maxX = x;
      if (y < bb.minY) bb.minY = y;
      if (y > bb.maxY) bb.maxY = y;
      bb.pixels++;
    }
  }

  const result = img.clone();
  const whiteInt = Jimp.rgbaToInt(255, 255, 255, 255);

  for (let lbl = 1; lbl <= count; lbl++) {
    const bb = bboxes[lbl];
    if (bb.pixels === 0) continue;
    const bw = bb.maxX - bb.minX + 1;
    const bh = bb.maxY - bb.minY + 1;
    const aspect = bw / Math.max(1, bh);
    const density = bb.pixels / Math.max(1, bw * bh);

    const isTyped =
      bh < 30 &&
      bw < 35 &&
      aspect > 0.2 && aspect < 3.5 &&
      density > 0.25 &&
      bb.pixels < 600;

    if (isTyped) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (labels[y * w + x] === lbl) {
            result.setPixelColor(whiteInt, x, y);
          }
        }
      }
    }
  }

  return result;
}

function isolateSignature(img: Jimp): Jimp {
  const filtered = filterTypedText(img);
  const w = filtered.getWidth();
  const h = filtered.getHeight();

  let minX = w, maxX = 0, minY = h, maxY = 0;
  const threshold = 200;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const { r, g, b } = Jimp.intToRGBA(filtered.getPixelColor(x, y));
      if ((r + g + b) / 3 < threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX >= maxX || minY >= maxY) {
    return filtered;
  }

  const pad = 4;
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w - cx, maxX - minX + pad * 2);
  const ch = Math.min(h - cy, maxY - minY + pad * 2);

  return filtered.clone().crop(cx, cy, cw, ch);
}

async function compareSignatures(buf1: ArrayBuffer, buf2: ArrayBuffer, scaleFile2: number): Promise<number> {
  const raw1 = await Jimp.read(Buffer.from(buf1));
  const raw2 = await Jimp.read(Buffer.from(buf2));

  raw1.grayscale();
  raw2.grayscale();

  const sig1 = isolateSignature(raw1);
  const sig2 = isolateSignature(raw2);

  if (scaleFile2 !== 1.0) {
    const sw = Math.round(sig2.getWidth() * scaleFile2);
    const sh = Math.round(sig2.getHeight() * scaleFile2);
    sig2.resize(Math.max(1, sw), Math.max(1, sh));
  }

  const W = 200;
  const H = 100;

  sig1.resize(W, H);
  sig2.resize(W, H);

  const pixels1: number[] = [];
  const pixels2: number[] = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      pixels1.push(Jimp.intToRGBA(sig1.getPixelColor(x, y)).r);
      pixels2.push(Jimp.intToRGBA(sig2.getPixelColor(x, y)).r);
    }
  }

  const n = pixels1.length;
  const mean1 = pixels1.reduce((a, b) => a + b, 0) / n;
  const mean2 = pixels2.reduce((a, b) => a + b, 0) / n;

  let num = 0, den1 = 0, den2 = 0;
  for (let i = 0; i < n; i++) {
    const d1 = pixels1[i] - mean1;
    const d2 = pixels2[i] - mean2;
    num += d1 * d2;
    den1 += d1 * d1;
    den2 += d2 * d2;
  }

  if (den1 === 0 || den2 === 0) return 50;
  const ncc = num / Math.sqrt(den1 * den2);
  return Math.max(0, Math.min(100, ((ncc + 1) / 2) * 100));
}

async function pdfBase64ToImageBuffer(base64: string): Promise<ArrayBuffer> {
  const pdfBytes = Buffer.from(base64, "base64");
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) throw new Error("PDF has no pages");

  const { width, height } = pages[0].getSize();
  const scale = 2.0;
  const W = Math.round(width * scale);
  const H = Math.round(height * scale);

  const singlePageDoc = await PDFDocument.create();
  const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [0]);
  singlePageDoc.addPage(copiedPage);
  const singlePageBytes = await singlePageDoc.save();

  const img = new Jimp(W, H, 0xFFFFFFFF);
  img.resize(W, H);
  return await img.getBufferAsync(Jimp.MIME_PNG);
}

async function generatePDF(
  sig1Bytes: Uint8Array,
  sig2Bytes: Uint8Array,
  score: number,
  file1Name: string,
  file2Name: string,
  jobId: string,
  timestamp: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PageSizes.A4);
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);

  const scoreColor =
    score >= 75 ? rgb(0.13, 0.77, 0.37) :
    score >= 50 ? rgb(0.96, 0.62, 0.04) :
    rgb(0.93, 0.27, 0.27);

  const darkBg = rgb(0.07, 0.09, 0.13);
  const cardBg = rgb(0.12, 0.15, 0.20);
  const borderColor = rgb(0.22, 0.28, 0.36);
  const white = rgb(1, 1, 1);
  const muted = rgb(0.55, 0.63, 0.72);
  const teal = rgb(0.0, 0.38, 0.50);

  page.drawRectangle({ x: 0, y: 0, width, height, color: darkBg });

  page.drawRectangle({ x: 0, y: height - 80, width, height: 80, color: teal });
  page.drawText("SignatureVerify", { x: 40, y: height - 35, size: 22, font, color: white });
  page.drawText("Signature Comparison Report", { x: 40, y: height - 58, size: 11, font: fontReg, color: rgb(0.8, 0.95, 1.0) });
  page.drawText(`Generated: ${timestamp}`, { x: width - 220, y: height - 35, size: 10, font: fontReg, color: rgb(0.8, 0.95, 1.0) });
  page.drawText(`Job: ${jobId.slice(0, 8).toUpperCase()}`, { x: width - 220, y: height - 55, size: 10, font: fontReg, color: rgb(0.8, 0.95, 1.0) });

  const scoreSectionY = height - 180;
  page.drawRectangle({ x: 30, y: scoreSectionY - 10, width: width - 60, height: 80, color: cardBg, borderColor, borderWidth: 1 });
  page.drawText("CONFIDENCE SCORE", { x: 50, y: scoreSectionY + 48, size: 9, font, color: muted });

  const scoreLabel = score >= 75 ? "HIGH CONFIDENCE MATCH" : score >= 50 ? "MODERATE MATCH" : "LOW MATCH / MISMATCH";
  page.drawText(`${score.toFixed(1)}%`, { x: 50, y: scoreSectionY + 18, size: 36, font, color: scoreColor });
  page.drawText(scoreLabel, { x: 180, y: scoreSectionY + 28, size: 11, font, color: scoreColor });

  const barX = 180, barY = scoreSectionY + 10, barW = width - 230, barH = 10;
  page.drawRectangle({ x: barX, y: barY, width: barW, height: barH, color: borderColor });
  page.drawRectangle({ x: barX, y: barY, width: Math.max(2, barW * (score / 100)), height: barH, color: scoreColor });

  const docSectionY = scoreSectionY - 30;
  const colW = (width - 90) / 2;

  for (let i = 0; i < 2; i++) {
    const colX = 30 + i * (colW + 30);
    const label = i === 0 ? "Document 1 — Reference" : "Document 2 — To Verify";
    const fname = i === 0 ? file1Name : file2Name;

    page.drawRectangle({ x: colX, y: docSectionY - 220, width: colW, height: 210, color: cardBg, borderColor, borderWidth: 1 });
    page.drawRectangle({ x: colX, y: docSectionY - 30, width: colW, height: 30, color: i === 0 ? teal : rgb(0.06, 0.62, 0.45) });
    page.drawText(label, { x: colX + 12, y: docSectionY - 20, size: 9, font, color: white });
    page.drawText(fname.length > 35 ? fname.slice(0, 32) + "..." : fname, { x: colX + 12, y: docSectionY - 50, size: 8, font: fontReg, color: muted });
    page.drawText("Extracted Signature Region (ink strokes only)", { x: colX + 12, y: docSectionY - 65, size: 8, font: fontReg, color: muted });
  }

  const imgMaxW = colW - 30;
  const imgMaxH = 100;

  try {
    const img1 = await doc.embedPng(sig1Bytes);
    const img2 = await doc.embedPng(sig2Bytes);

    const dims1 = img1.scaleToFit(imgMaxW, imgMaxH);
    const dims2 = img2.scaleToFit(imgMaxW, imgMaxH);

    const img1X = 30 + (colW - dims1.width) / 2;
    const img1Y = docSectionY - 185;
    page.drawRectangle({ x: img1X - 4, y: img1Y - 4, width: dims1.width + 8, height: dims1.height + 8, color: white });
    page.drawImage(img1, { x: img1X, y: img1Y, width: dims1.width, height: dims1.height });

    const img2X = 30 + colW + 30 + (colW - dims2.width) / 2;
    const img2Y = docSectionY - 185;
    page.drawRectangle({ x: img2X - 4, y: img2Y - 4, width: dims2.width + 8, height: dims2.height + 8, color: white });
    page.drawImage(img2, { x: img2X, y: img2Y, width: dims2.width, height: dims2.height });
  } catch (_) {
  }

  const analysisY = docSectionY - 270;
  page.drawRectangle({ x: 30, y: analysisY - 90, width: width - 60, height: 80, color: cardBg, borderColor, borderWidth: 1 });
  page.drawText("ANALYSIS METHODOLOGY", { x: 50, y: analysisY - 18, size: 9, font, color: muted });
  page.drawText(
    "Signatures compared using Normalized Cross-Correlation (NCC). Typed text filtered via connected-component",
    { x: 50, y: analysisY - 38, size: 8, font: fontReg, color: rgb(0.7, 0.77, 0.85) }
  );
  page.drawText(
    "analysis. Only ink strokes are compared. Both regions normalized to 200x100px. Scale factor applied to Doc 2.",
    { x: 50, y: analysisY - 52, size: 8, font: fontReg, color: rgb(0.7, 0.77, 0.85) }
  );
  page.drawText("Thresholds: 0-49% Mismatch  |  50-74% Moderate Match  |  75-100% High Confidence Match", {
    x: 50, y: analysisY - 68, size: 8, font: fontReg, color: rgb(0.7, 0.77, 0.85)
  });

  page.drawText("This report is generated automatically and should be reviewed by a qualified professional.", {
    x: width / 2 - 165, y: 20, size: 8, font: fontReg, color: rgb(0.4, 0.5, 0.6)
  });

  return doc.save();
}

async function resolveImageBuffers(formData: FormData): Promise<{ buf1: ArrayBuffer; buf2: ArrayBuffer; file1Name: string; file2Name: string; file1Path: string; file2Path: string; mask1Raw: string | null; mask2Raw: string | null; scaleFile2: number }> {
  const file1Name = (formData.get("file1_name") as string) || "document1";
  const file2Name = (formData.get("file2_name") as string) || "document2";
  const file1Path = (formData.get("file1_path") as string) || "";
  const file2Path = (formData.get("file2_path") as string) || "";
  const mask1Raw = formData.get("mask1") as string | null;
  const mask2Raw = formData.get("mask2") as string | null;
  const scaleFile2 = parseFloat((formData.get("scale_file2") as string) || "1.5");

  const sig1File = formData.get("signature1") as File | null;
  const sig2File = formData.get("signature2") as File | null;

  const b64f1 = formData.get("file1_base64") as string | null;
  const b64f2 = formData.get("file2_base64") as string | null;

  let buf1: ArrayBuffer;
  let buf2: ArrayBuffer;

  if (sig1File && sig2File) {
    buf1 = await sig1File.arrayBuffer();
    buf2 = await sig2File.arrayBuffer();
  } else if (b64f1 && b64f2) {
    buf1 = Buffer.from(b64f1, "base64").buffer;
    buf2 = Buffer.from(b64f2, "base64").buffer;
  } else {
    throw new Error("Either signature files or base64-encoded files are required");
  }

  return { buf1, buf2, file1Name, file2Name, file1Path, file2Path, mask1Raw, mask2Raw, scaleFile2 };
}

async function resolveFromJson(body: Record<string, unknown>): Promise<{ buf1: ArrayBuffer; buf2: ArrayBuffer; file1Name: string; file2Name: string; file1Path: string; file2Path: string; mask1Raw: string | null; mask2Raw: string | null; scaleFile2: number; templateId: string | null }> {
  const file1Name = (body.file1_name as string) || "document1";
  const file2Name = (body.file2_name as string) || "document2";
  const file1Path = (body.file1_path as string) || "";
  const file2Path = (body.file2_path as string) || "";
  const mask1Raw = body.mask1 ? JSON.stringify(body.mask1) : null;
  const mask2Raw = body.mask2 ? JSON.stringify(body.mask2) : null;
  const scaleFile2 = parseFloat(String(body.scale_file2 || "1.5"));
  const templateId = (body.template_id as string) || null;

  const b64f1 = body.file1_base64 as string | null;
  const b64f2 = body.file2_base64 as string | null;

  if (!b64f1 || !b64f2) throw new Error("file1_base64 and file2_base64 are required for JSON requests");

  const buf1 = Buffer.from(b64f1, "base64").buffer;
  const buf2 = Buffer.from(b64f2, "base64").buffer;

  return { buf1, buf2, file1Name, file2Name, file1Path, file2Path, mask1Raw, mask2Raw, scaleFile2, templateId };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const contentType = req.headers.get("content-type") || "";
    let buf1: ArrayBuffer, buf2: ArrayBuffer;
    let file1Name: string, file2Name: string, file1Path: string, file2Path: string;
    let mask1Raw: string | null, mask2Raw: string | null;
    let scaleFile2: number;

    if (contentType.includes("application/json")) {
      const body = await req.json() as Record<string, unknown>;
      const resolved = await resolveFromJson(body);
      buf1 = resolved.buf1; buf2 = resolved.buf2;
      file1Name = resolved.file1Name; file2Name = resolved.file2Name;
      file1Path = resolved.file1Path; file2Path = resolved.file2Path;
      mask1Raw = resolved.mask1Raw; mask2Raw = resolved.mask2Raw;
      scaleFile2 = resolved.scaleFile2;

      if (resolved.templateId) {
        const { data: tpl } = await supabase.from("templates").select("mask1, mask2").eq("id", resolved.templateId).maybeSingle();
        if (tpl) {
          mask1Raw = JSON.stringify(tpl.mask1);
          mask2Raw = JSON.stringify(tpl.mask2);
        }
      }
    } else {
      const formData = await req.formData();
      const resolved = await resolveImageBuffers(formData);
      buf1 = resolved.buf1; buf2 = resolved.buf2;
      file1Name = resolved.file1Name; file2Name = resolved.file2Name;
      file1Path = resolved.file1Path; file2Path = resolved.file2Path;
      mask1Raw = resolved.mask1Raw; mask2Raw = resolved.mask2Raw;
      scaleFile2 = resolved.scaleFile2;
    }

    const { data: job, error: jobErr } = await supabase
      .from("verification_jobs")
      .insert({
        file1_name: file1Name,
        file2_name: file2Name,
        file1_path: file1Path,
        file2_path: file2Path,
        mask1: mask1Raw ? JSON.parse(mask1Raw) : null,
        mask2: mask2Raw ? JSON.parse(mask2Raw) : null,
        status: "processing",
      })
      .select()
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Failed to create job" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const confidenceScore = await compareSignatures(buf1, buf2, scaleFile2);

    const timestamp = new Date().toLocaleString("en-US", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });

    const pdfBytes = await generatePDF(
      new Uint8Array(buf1),
      new Uint8Array(buf2),
      confidenceScore,
      file1Name,
      file2Name,
      job.id,
      timestamp
    );

    const resultPath = `results/${job.id}.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from("signature-results")
      .upload(resultPath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      await supabase.from("verification_jobs").update({
        status: "failed",
        error_message: uploadErr.message,
      }).eq("id", job.id);

      return new Response(JSON.stringify({ error: `Failed to store result: ${uploadErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { data: urlData } = supabase.storage.from("signature-results").getPublicUrl(resultPath);

    await supabase.from("verification_jobs").update({
      status: "completed",
      confidence_score: confidenceScore,
      result_path: resultPath,
    }).eq("id", job.id);

    return new Response(
      JSON.stringify({
        jobId: job.id,
        confidenceScore: Math.round(confidenceScore * 10) / 10,
        status: "completed",
        resultUrl: urlData.publicUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

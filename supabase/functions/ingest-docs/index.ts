// Ingest PDFs from bucket `base_documentos` into `public.document_chunks`.
//
// Modes:
//   {}                                          -> list bucket; process `limit` (default 1) unseen files fully (skipExisting)
//   { "file": "x.pdf" }                         -> reingest one file (deletes prior chunks)
//   { "file": "x.pdf", "startPage": N }         -> resume embedding from page N (does NOT delete prior chunks)
//   { "file": "x.pdf", "pageWindow": 8 }        -> only process up to N pages per call (memory-safe)
//
// Response includes `nextStartPage` when a file is partially processed so the
// caller can resume by calling again with { file, startPage: nextStartPage }.

import { createClient } from "npm:@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "base_documentos";
const EMBED_MODEL = "openai/text-embedding-3-small"; // 1536 dims
const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

function sanitize(s: string): string {
  // Strip NULs and lone surrogates that break JSON/Postgres text.
  return s.replace(/\u0000/g, "").replace(/[\uD800-\uDFFF]/g, "");
}
function chunkText(text: string, target = 1200, overlap = 200): string[] {
  text = sanitize(text);
  const clean = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + target, clean.length);
    if (end < clean.length) {
      const slice = clean.slice(i, end);
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("\n"),
      );
      if (lastBreak > target * 0.5) end = i + lastBreak + 1;
    }
    const piece = clean.slice(i, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return chunks;
}

async function embedBatch(inputs: string[], apiKey: string): Promise<number[][]> {
  let attempt = 0;
  while (true) {
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
      body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
    });
    if (res.ok) {
      const json = await res.json();
      return (json.data as Array<{ embedding: number[] }>).map((d) => d.embedding);
    }
    const t = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 6) throw new Error(`Embedding failed ${res.status}: ${t}`);
    const wait = Math.min(30000, 2000 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
    console.log(`embed ${res.status} retry ${attempt + 1} in ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
    attempt++;
  }
}

async function listPdfs(supabase: ReturnType<typeof createClient>): Promise<string[]> {
  const names: string[] = [];
  const walk = async (prefix: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    for (const item of data ?? []) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if ((item as any).id === null || item.metadata === null) await walk(full);
      else if (item.name.toLowerCase().endsWith(".pdf")) names.push(full);
    }
  };
  await walk("");
  return names;
}

type FileResult = {
  file: string;
  ok: boolean;
  pages: number;
  pagesProcessed: number;
  chunks: number;
  startPage: number;
  nextStartPage: number | null; // null = finished
  error?: string;
};

async function processFile(
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  file: string,
  startPage: number,
  pageWindow: number,
): Promise<FileResult> {
  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(file);
  if (dlErr || !blob) throw dlErr ?? new Error("download failed");
  const buf = await blob.arrayBuffer();
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const total = pdf.numPages;

  if (startPage <= 1) {
    await supabase.from("document_chunks").delete().eq("source", file);
  }

  // Find existing max chunk_index to continue numbering on resume.
  let chunkIdx = 0;
  if (startPage > 1) {
    const { data: maxRow } = await supabase
      .from("document_chunks")
      .select("chunk_index")
      .eq("source", file)
      .order("chunk_index", { ascending: false })
      .limit(1);
    chunkIdx = ((maxRow?.[0] as any)?.chunk_index ?? -1) + 1;
  }

  const endPage = Math.min(total, startPage + pageWindow - 1);
  let chunksWritten = 0;
  const BATCH = 16;
  let buffer: Array<{ content: string; page: number; chunk_index: number }> = [];

  const flush = async () => {
    if (buffer.length === 0) return;
    const vectors = await embedBatch(buffer.map((s) => s.content), apiKey);
    const rows = buffer.map((s, k) => ({
      source: file,
      page: s.page,
      chunk_index: s.chunk_index,
      content: s.content,
      embedding: vectors[k] as unknown as string,
    }));
    const { error: insErr } = await supabase.from("document_chunks").insert(rows);
    if (insErr) throw insErr;
    chunksWritten += rows.length;
    buffer = [];
  };

  for (let p = startPage; p <= endPage; p++) {
    let pageText = "";
    try {
      const { text } = await extractText(pdf, { mergePages: false, page: p });
      pageText = Array.isArray(text) ? text.join("\n") : String(text ?? "");
    } catch (_e) {
      pageText = "";
    }
    for (const c of chunkText(pageText)) {
      buffer.push({ content: c, page: p, chunk_index: chunkIdx++ });
      if (buffer.length >= BATCH) await flush();
    }
  }
  await flush();

  return {
    file,
    ok: true,
    pages: total,
    pagesProcessed: endPage - startPage + 1,
    chunks: chunksWritten,
    startPage,
    nextStartPage: endPage >= total ? null : endPage + 1,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    if (!SUPABASE_URL || !SERVICE_KEY || !LOVABLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing server env" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const onlyFile: string | undefined = body?.file;
    const startPage: number = Math.max(1, Number(body?.startPage ?? 1) || 1);
    const pageWindow: number = Math.max(1, Number(body?.pageWindow ?? 10) || 10);
    const limit: number = Math.max(1, Number(body?.limit ?? 1) || 1);
    const skipExisting: boolean = body?.skipExisting !== false;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let files: string[];
    if (onlyFile) {
      files = [onlyFile];
    } else {
      files = await listPdfs(supabase);
      if (skipExisting) {
        const { data: existing } = await supabase.from("document_chunks").select("source");
        const done = new Set((existing ?? []).map((r: any) => r.source));
        files = files.filter((f) => !done.has(f));
      }
      files = files.slice(0, limit);
    }

    const report: FileResult[] = [];
    for (const f of files) {
      try {
        report.push(await processFile(supabase, LOVABLE_KEY, f, startPage, pageWindow));
      } catch (e) {
        report.push({
          file: f, ok: false, pages: 0, pagesProcessed: 0, chunks: 0,
          startPage, nextStartPage: startPage, error: (e as Error).message,
        });
      }
    }

    return new Response(JSON.stringify({ bucket: BUCKET, count: files.length, report }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-docs error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

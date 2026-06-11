// Ingest all PDFs from the public bucket `base_documentos` into
// `public.document_chunks` (pgvector). Idempotent per file: re-ingesting
// the same file replaces its previous chunks.
//
// Trigger manually:
//   POST {SUPABASE_URL}/functions/v1/ingest-docs
//   body: {} or { "file": "alguma.pdf" } to ingest only one file.

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

// Chunking ~1200 chars with ~200 char overlap, broken on paragraph/sentence.
function chunkText(text: string, target = 1200, overlap = 200): string[] {
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
  // Up to ~6 retries with exponential backoff on 429/5xx
  while (true) {
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({ model: EMBED_MODEL, input: inputs }),
    });
    if (res.ok) {
      const json = await res.json();
      return (json.data as Array<{ embedding: number[] }>).map((d) => d.embedding);
    }
    const t = await res.text();
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 6) {
      throw new Error(`Embedding failed ${res.status}: ${t}`);
    }
    const wait = Math.min(30000, 2000 * Math.pow(2, attempt)) + Math.floor(Math.random() * 500);
    console.log(`embed ${res.status} — retry ${attempt + 1} in ${wait}ms`);
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
      // Folders have null id in Supabase storage list
      if ((item as any).id === null || item.metadata === null) {
        await walk(full);
      } else if (item.name.toLowerCase().endsWith(".pdf")) {
        names.push(full);
      }
    }
  };
  await walk("");
  return names;
}

async function extractPdfPages(buf: ArrayBuffer): Promise<string[]> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const total = pdf.numPages;
  const pages: string[] = [];
  for (let p = 1; p <= total; p++) {
    try {
      const { text } = await extractText(pdf, { mergePages: false, page: p });
      const t = Array.isArray(text) ? text.join("\n") : String(text ?? "");
      pages.push(t);
    } catch (_e) {
      pages.push("");
    }
  }
  return pages;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    if (!SUPABASE_URL || !SERVICE_KEY || !LOVABLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing server env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const onlyFile: string | undefined = body?.file;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    let files = onlyFile ? [onlyFile] : await listPdfs(supabase);
    const report: Array<{ file: string; chunks: number; pages: number; ok: boolean; error?: string }> = [];

    for (const file of files) {
      try {
        const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(file);
        if (dlErr || !blob) throw dlErr ?? new Error("download failed");
        const buf = await blob.arrayBuffer();
        const pages = await extractPdfPages(buf);

        // Build (chunk, page) pairs
        const items: Array<{ content: string; page: number; chunk_index: number }> = [];
        let idx = 0;
        pages.forEach((pageText, pIdx) => {
          for (const c of chunkText(pageText)) {
            items.push({ content: c, page: pIdx + 1, chunk_index: idx++ });
          }
        });

        // Wipe previous chunks for this file
        await supabase.from("document_chunks").delete().eq("source", file);

        // Embed in batches of 32
        const BATCH = 32;
        for (let i = 0; i < items.length; i += BATCH) {
          const slice = items.slice(i, i + BATCH);
          const vectors = await embedBatch(slice.map((s) => s.content), LOVABLE_KEY);
          const rows = slice.map((s, k) => ({
            source: file,
            page: s.page,
            chunk_index: s.chunk_index,
            content: s.content,
            embedding: vectors[k] as unknown as string,
          }));
          const { error: insErr } = await supabase.from("document_chunks").insert(rows);
          if (insErr) throw insErr;
        }

        report.push({ file, pages: pages.length, chunks: items.length, ok: true });
      } catch (e) {
        report.push({ file, pages: 0, chunks: 0, ok: false, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ bucket: BUCKET, count: files.length, report }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-docs error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

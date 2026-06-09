create extension if not exists vector;

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  page integer,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);

create index if not exists document_chunks_source_idx on public.document_chunks (source);
create index if not exists document_chunks_embedding_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

grant select on public.document_chunks to anon, authenticated;
grant all on public.document_chunks to service_role;

alter table public.document_chunks enable row level security;

create policy "Public read access to document chunks"
  on public.document_chunks for select
  using (true);

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count int default 6
)
returns table (
  id uuid,
  source text,
  page integer,
  content text,
  similarity float
)
language sql stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.source,
    d.page,
    d.content,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.document_chunks d
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_document_chunks(vector, int) to anon, authenticated, service_role;
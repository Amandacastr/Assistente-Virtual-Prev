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
security invoker
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
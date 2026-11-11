DROP POLICY IF EXISTS "Public read access to document chunks" ON public.document_chunks;
REVOKE ALL ON public.document_chunks FROM anon, authenticated;
GRANT ALL ON public.document_chunks TO service_role;
REVOKE EXECUTE ON FUNCTION public.match_document_chunks FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_document_chunks TO service_role;
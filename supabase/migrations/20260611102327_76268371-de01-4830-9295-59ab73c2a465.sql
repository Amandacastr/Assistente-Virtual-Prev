-- Permite leitura pública (SELECT/LIST) de objetos do bucket `base_documentos`.
-- A função `ingest-docs` já usa a service_role (que ignora RLS), mas adicionamos
-- esta policy para alinhar com a configuração pública do bucket.
DROP POLICY IF EXISTS "Public read base_documentos" ON storage.objects;
CREATE POLICY "Public read base_documentos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'base_documentos');
CREATE POLICY "base_documentos service role select" ON storage.objects FOR SELECT TO service_role USING (bucket_id = 'base_documentos');
CREATE POLICY "base_documentos service role insert" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'base_documentos');
CREATE POLICY "base_documentos service role update" ON storage.objects FOR UPDATE TO service_role USING (bucket_id = 'base_documentos') WITH CHECK (bucket_id = 'base_documentos');
CREATE POLICY "base_documentos service role delete" ON storage.objects FOR DELETE TO service_role USING (bucket_id = 'base_documentos');
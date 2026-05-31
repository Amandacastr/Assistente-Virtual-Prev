CREATE TABLE public.noticias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  link TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.noticias TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.noticias TO authenticated;
GRANT ALL ON public.noticias TO service_role;

ALTER TABLE public.noticias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notícias são públicas para leitura"
ON public.noticias FOR SELECT
USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.noticias;
ALTER TABLE public.noticias REPLICA IDENTITY FULL;
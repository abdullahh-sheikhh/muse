CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id uuid REFERENCES public.museums(id) ON DELETE CASCADE,
  artwork_id uuid REFERENCES public.artifacts(id) ON DELETE SET NULL,
  visitor_id uuid,
  conversation_id text,
  role text CHECK (role IN ('user','agent')),
  text text NOT NULL,
  language text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.agent_messages TO anon, authenticated;
GRANT ALL ON public.agent_messages TO service_role;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log agent messages" ON public.agent_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE INDEX agent_messages_museum_created_idx ON public.agent_messages (museum_id, created_at);
CREATE INDEX agent_messages_artwork_idx ON public.agent_messages (artwork_id);
CREATE INDEX IF NOT EXISTS visit_events_visitor_type_idx ON public.visit_events (visitor_id, event_type, created_at);
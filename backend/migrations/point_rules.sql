-- Editable points-per-action rules. Run in Supabase SQL Editor.
-- Admin UI: /admin/points  API: /admin/point_rules

CREATE TABLE IF NOT EXISTS public.point_rules (
  id smallint PRIMARY KEY,
  action text NOT NULL,
  path text NOT NULL,
  points int NOT NULL,
  label_el text NOT NULL,
  label_en text NOT NULL,
  sort_order smallint NOT NULL,
  visible boolean NOT NULL DEFAULT true,
  UNIQUE (action, path)
);

CREATE UNIQUE INDEX IF NOT EXISTS point_rules_sort_order_idx
  ON public.point_rules (sort_order);

INSERT INTO public.point_rules
  (id, action, path, points, label_el, label_en, sort_order, visible)
VALUES
  (1, 'submit',   '/app/memories/add-note',   2,  'Σημείωση',           'Note',              1, true),
  (2, 'submit',   '/app/memories/add-photo',  5,  'Φωτό',               'Photo',             2, true),
  (3, 'submit',   '/app/memories/add-video',  8,  'Βίντεο',             'Video',             3, true),
  (4, 'submit',   '/app/chat/send',           3,  'Chat',               'Chat',              4, true),
  (5, 'submit',   '/app/chat/send-video',     8,  'Chat βίντεο',        'Chat video',        5, false),
  (6, 'submit',   '/app/milestones/check',   15,  'Ορόσημο',            'Milestone',         6, true),
  (7, 'submit',   '/app/milestones/uncheck',-15,  'Ξετικάρισμα ορόσημου','Untick milestone', 7, false),
  (8, 'referral', '/auth/register',          40,  'Πρόσκληση φίλης',    'Friend referral',   8, false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.point_settings (
  key text PRIMARY KEY,
  value_int int NOT NULL,
  label_el text NOT NULL,
  label_en text NOT NULL
);

INSERT INTO public.point_settings (key, value_int, label_el, label_en) VALUES
  ('chat_daily_points_cap', 30, 'Ημερήσιο όριο πόντων chat', 'Daily chat points cap')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.point_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_settings ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

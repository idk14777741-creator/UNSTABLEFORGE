-- 005 — one concise line for each C³ challenge domain.
--
-- The domains were seeded as titles only, which left the constellation's detail
-- panel with nothing to say. These are the same short notes already published
-- on the brief page. Only rows whose description is still NULL are touched, so
-- an organizer's edited copy is never overwritten.

UPDATE event_domains d
   SET description = notes.note
  FROM (VALUES
    ('Agentic AI',       'Systems that plan, act and keep working without a hand on the wheel.'),
    ('FinTech',          'Money moved, measured and made safer.'),
    ('Cybersecurity',    'Defence built into the product, not bolted on afterwards.'),
    ('Smart Automation', 'Machines taking the repetition out of real work.'),
    ('Road Safety',      'Fewer blind spots between here and there.'),
    ('Women''s Safety',  'Safer streets, safer commutes, faster help.'),
    ('Agriculture',      'Better decisions for the people who grow things.'),
    ('GenAI',            'Tools that generate, and stay answerable to the people using them.'),
    ('GovTech',          'Public services that behave like good products.'),
    ('EduTech',          'Learning that adapts to the learner.'),
    ('HealthCare',       'Care that reaches further and waits less.')
  ) AS notes(title, note)
 WHERE d.description IS NULL
   AND d.title = notes.title
   AND d.event_id IN (
     SELECT id FROM events WHERE slug = 'c3-crescent-code-clash'
   );

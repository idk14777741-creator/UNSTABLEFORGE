-- Platform migration 003: the fee is charged per team or per participant.
--
-- C³ charges ₹300 per team while its capacity is counted in individual
-- participants, so the two units have to be configurable independently.

ALTER TABLE event_registration_settings
  ADD COLUMN IF NOT EXISTS fee_unit TEXT NOT NULL DEFAULT 'team';

DO $$ BEGIN
  ALTER TABLE event_registration_settings ADD CONSTRAINT event_fee_unit_check
    CHECK (fee_unit IN ('team', 'participant'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE event_registration_settings SET fee_unit = 'team' WHERE fee_unit IS NULL;

-- One registration per participant per event, so a captain cannot register the
-- same teammate twice.
CREATE UNIQUE INDEX IF NOT EXISTS registrations_event_participant_key
  ON registrations (event_id, participant_id) WHERE participant_id IS NOT NULL;

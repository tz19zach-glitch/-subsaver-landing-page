CREATE TABLE IF NOT EXISTS demand_validation_responses (
  lead_id TEXT PRIMARY KEY,
  subscription_count TEXT CHECK (subscription_count IN ('0_2','3_5','6_plus')),
  pain_frequency TEXT CHECK (pain_frequency IN ('monthly','quarterly','rarely')),
  willingness_to_pay TEXT CHECK (willingness_to_pay IN ('yes_990','maybe','no')),
  opened_at TEXT NOT NULL,
  submitted_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES waitlist_leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS demand_validation_willingness_idx
  ON demand_validation_responses (willingness_to_pay);
CREATE INDEX IF NOT EXISTS demand_validation_submitted_at_idx
  ON demand_validation_responses (submitted_at DESC);

-- Strong link between schedule and bus model product.
-- Adds bus_model_id on recurring schedules and supports capacity join.

ALTER TABLE agency_departure_schedules
ADD COLUMN IF NOT EXISTS bus_model_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agency_schedules_bus_model
ON agency_departure_schedules (bus_model_id)
WHERE bus_model_id IS NOT NULL;

COMMENT ON COLUMN agency_departure_schedules.bus_model_id IS
'Linked bus model (products.id ticket_voyage) used to generate dated departures and seat capacity.';


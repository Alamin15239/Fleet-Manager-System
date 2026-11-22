-- Preserve the 8 dated oil-history rows that have no Plate No.
-- Run this after oil_change_maintenance_records_import.sql.
-- These rows cannot become maintenance_records until a truck is identified because
-- maintenance_records."truckId" is a required foreign key. They are staged in
-- Excel Changes so Fleet Manager can detect and display them without inventing a truck.
WITH source_rows(source_row, row_data, reason) AS (
  VALUES
    (26, '{"Truck Number":null,"Service Date":"2024-07-29","Driver":null,"Mileage (km)":null,"Oil Quantity (L)":null,"Service Type":"Oil Change","Notes":"Source row 26; original Plate No, driver, mileage and oil quantity are blank."}'::jsonb, 'Source row 26 has no Plate No or other vehicle identity.'),
    (29, '{"Truck Number":null,"Service Date":"2024-07-30","Driver":null,"Mileage (km)":null,"Oil Quantity (L)":null,"Service Type":"Oil Change","Notes":"Source row 29; original Plate No, driver, mileage and oil quantity are blank."}'::jsonb, 'Source row 29 has no Plate No or other vehicle identity.'),
    (80, '{"Truck Number":null,"Service Date":"2024-09-15","Driver":"tanajib","Mileage (km)":null,"Oil Quantity (L)":15,"Service Type":"Oil Change","Notes":"Source row 80; original kM value was text: ajad; Plate No blank."}'::jsonb, 'Source row 80 has no Plate No; original mileage cell contains non-numeric text ajad.'),
    (81, '{"Truck Number":null,"Service Date":"2024-09-16","Driver":"Alamgir","Mileage (km)":null,"Oil Quantity (L)":5,"Service Type":"Oil Change","Notes":"Source row 81; original kM value was text: extra; Plate No blank."}'::jsonb, 'Source row 81 has no Plate No; original mileage cell contains non-numeric text extra.'),
    (135, '{"Truck Number":null,"Service Date":"2024-11-11","Driver":"New","Mileage (km)":null,"Oil Quantity (L)":null,"Service Type":"Oil Change","Notes":"Source row 135; Plate No blank."}'::jsonb, 'Source row 135 has no Plate No or other vehicle identity.'),
    (189, '{"Truck Number":null,"Service Date":"2024-12-26","Driver":"Adnan","Mileage (km)":null,"Oil Quantity (L)":70,"Service Type":"Oil Change","Notes":"Source row 189; Plate No blank."}'::jsonb, 'Source row 189 has no Plate No or other vehicle identity.'),
    (290, '{"Truck Number":null,"Service Date":"2025-04-08","Driver":"forklift","Mileage (km)":null,"Oil Quantity (L)":20,"Service Type":"Oil Change","Notes":"Source row 290; original oil text was 20 lit; Plate No blank."}'::jsonb, 'Source row 290 has no Plate No; vehicle identity cannot be safely inferred from driver text.'),
    (329, '{"Truck Number":null,"Service Date":"2025-05-28","Driver":"Nadeem","Mileage (km)":null,"Oil Quantity (L)":null,"Service Type":"Oil Change","Notes":"Source row 329; Plate No blank."}'::jsonb, 'Source row 329 has no Plate No or other vehicle identity.')
)
INSERT INTO excel_workbook_changes (
  id, fingerprint, "sheetName", "entityType", operation, "recordId",
  "rowData", changes, "baseUpdatedAt", status, error
)
SELECT
  gen_random_uuid()::text,
  md5('oil qty.xlsx|Sheet1|' || source_row::text || '|' || row_data::text),
  'Oil Changes',
  'OIL_CHANGE',
  'CREATE',
  NULL,
  row_data,
  jsonb_build_object('Source row', jsonb_build_object('from', NULL, 'to', source_row)),
  NULL,
  'ERROR',
  reason || ' Preserved for review; no maintenance record was fabricated.'
FROM source_rows
ON CONFLICT (fingerprint) DO NOTHING;

-- Expected: 8 source rows staged in Excel Changes. No one-by-one database entry is required.

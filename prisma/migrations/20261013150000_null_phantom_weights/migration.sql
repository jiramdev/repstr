-- Clear phantom zeros left by empty weight inputs (empty now saves as NULL).
-- A 0 kg set contributes to no statistic (volume, top weight, charts), so
-- nulling only removes bogus "0 kg" PR rows. No other column is touched.
UPDATE "LogEntry" SET "weight" = NULL WHERE "weight" = 0;

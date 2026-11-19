
-- Adds a waste category to citizen reports.

BEGIN;

ALTER TABLE public.reports
    ADD COLUMN category text NOT NULL DEFAULT 'mixed';

ALTER TABLE public.reports
    ADD CONSTRAINT reports_category_check
    CHECK (category IN (
        'household',
        'construction',
        'plastic',
        'organic',
        'e_waste',
        'mixed'
    ));

-- Allow anonymous citizens to insert the new category column.
GRANT INSERT (category) ON TABLE public.reports TO anon;

COMMIT;

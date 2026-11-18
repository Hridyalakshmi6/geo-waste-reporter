
BEGIN;

-- =========================================================
-- 1. REMOVE EXISTING BROAD TABLE PRIVILEGES
-- =========================================================

REVOKE ALL PRIVILEGES ON TABLE
    public.admin_users,
    public.public_historical_reports,
    public.recurring_incident_candidates,
    public.recurring_incident_reports,
    public.recurring_incidents,
    public.report_duplicate_candidates,
    public.reports,
    public.synthetic_historical_reports
FROM anon, authenticated;


-- =========================================================
-- 2. ADMIN USERS
-- Admins can read their own admin record.
-- RLS policy: Admins can view their own admin record.
-- =========================================================

GRANT SELECT ON TABLE public.admin_users TO authenticated;


-- =========================================================
-- 3. HISTORICAL REPORTS
-- Admins can read historical datasets.
-- =========================================================

GRANT SELECT ON TABLE public.public_historical_reports
TO authenticated;

GRANT SELECT ON TABLE public.synthetic_historical_reports
TO authenticated;


-- =========================================================
-- 4. REPORTS
-- Citizens: INSERT only on approved submission columns.
-- Admins: SELECT and UPDATE status only.
-- =========================================================

GRANT INSERT (
    report_code,
    image_path,
    latitude,
    longitude,
    accuracy,
    description
)
ON TABLE public.reports TO anon;

GRANT SELECT ON TABLE public.reports TO authenticated;

GRANT UPDATE (status)
ON TABLE public.reports TO authenticated;


-- =========================================================
-- 5. DUPLICATE REPORT CANDIDATES
-- Admins can read and review candidates.
-- =========================================================

GRANT SELECT ON TABLE public.report_duplicate_candidates
TO authenticated;

GRANT UPDATE (
    review_status,
    reviewed_by,
    reviewed_at
)
ON TABLE public.report_duplicate_candidates
TO authenticated;


-- =========================================================
-- 6. RECURRING INCIDENT CANDIDATES
-- Admins can read candidates.
-- Review updates are performed through the authorized RPC.
-- =========================================================

GRANT SELECT ON TABLE public.recurring_incident_candidates
TO authenticated;


-- =========================================================
-- 7. RECURRING INCIDENT REPORT LINKS
-- Admins can read links.
-- Linking is handled by the authorized RPC.
-- =========================================================

GRANT SELECT ON TABLE public.recurring_incident_reports
TO authenticated;


-- =========================================================
-- 8. RECURRING INCIDENTS
-- Admins can read incidents and update resolution fields.
-- =========================================================

GRANT SELECT ON TABLE public.recurring_incidents
TO authenticated;

GRANT UPDATE (
    status,
    cleared_at,
    cleared_by,
    updated_at
)
ON TABLE public.recurring_incidents
TO authenticated;


-- =========================================================
-- 9. TRIGGER FUNCTIONS
-- These functions should not be directly executable
-- through the anonymous or authenticated API.
-- Triggers invoke them internally.
-- =========================================================

REVOKE ALL ON FUNCTION
    public.detect_recurring_incidents()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
    public.detect_report_duplicates()
FROM PUBLIC, anon, authenticated;


-- =========================================================
-- 10. RECURRING INCIDENT REVIEW RPC
-- Only authenticated users and service_role may execute it.
-- The function must retain its internal admin authorization.
-- =========================================================

REVOKE ALL ON FUNCTION
    public.review_recurring_incident_candidate(uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.review_recurring_incident_candidate(uuid, text)
TO authenticated, service_role;


-- =========================================================
-- 11. FUTURE TABLE PRIVILEGES
-- Do not automatically grant broad table access to anon
-- or authenticated for future public-schema tables.
-- =========================================================

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON TABLES FROM anon, authenticated;


-- =========================================================
-- 12. FUTURE SEQUENCE PRIVILEGES
-- =========================================================

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
IN SCHEMA public
REVOKE ALL ON SEQUENCES FROM anon, authenticated;


-- =========================================================
-- 13. FUTURE FUNCTION PRIVILEGES
-- New functions must receive explicit execution grants.
-- =========================================================

ALTER DEFAULT PRIVILEGES FOR ROLE postgres
IN SCHEMA public
REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;


COMMIT;

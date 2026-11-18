


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."detect_recurring_incidents"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    matching_count INTEGER;
    new_incident_id UUID;
    new_incident_code TEXT;
BEGIN

    -- Find open incidents within 100 metres
    -- whose latest linked report is within 7 days.

    INSERT INTO public.recurring_incident_candidates (
        incident_id,
        report_id,
        distance_meters,
        time_difference_hours
    )
    SELECT
        incident.id,
        NEW.id,
        distance_calc.distance_meters,
        EXTRACT(
            EPOCH FROM (
                NEW.created_at - incident.last_reported_at
            )
        ) / 3600.0

    FROM public.recurring_incidents AS incident

    CROSS JOIN LATERAL (
        SELECT
            6371000.0 * 2.0 * ASIN(
                SQRT(
                    LEAST(
                        1.0,
                        GREATEST(
                            0.0,
                            POWER(
                                SIN(
                                    RADIANS(
                                        NEW.latitude - incident.latitude
                                    ) / 2.0
                                ),
                                2
                            )
                            +
                            COS(RADIANS(NEW.latitude))
                            * COS(RADIANS(incident.latitude))
                            * POWER(
                                SIN(
                                    RADIANS(
                                        NEW.longitude - incident.longitude
                                    ) / 2.0
                                ),
                                2
                            )
                        )
                    )
                )
            ) AS distance_meters
    ) AS distance_calc

    WHERE incident.status = 'open'

      AND NEW.created_at >= incident.last_reported_at

      AND NEW.created_at <=
          incident.last_reported_at + INTERVAL '7 days'

      AND distance_calc.distance_meters <= 100

    ON CONFLICT (incident_id, report_id)
    DO NOTHING;

    GET DIAGNOSTICS matching_count = ROW_COUNT;

    -- If no open incident matches, create a new incident.
    -- Automatically link its first report.

    IF matching_count = 0 THEN

        new_incident_id := gen_random_uuid();

        new_incident_code :=
            'INC-' ||
            TO_CHAR(NEW.created_at, 'YYYYMMDD') ||
            '-' ||
            UPPER(SUBSTRING(
                REPLACE(new_incident_id::TEXT, '-', '')
                FROM 1 FOR 8
            ));

        INSERT INTO public.recurring_incidents (
            id,
            incident_code,
            latitude,
            longitude,
            status,
            first_reported_at,
            last_reported_at
        )
        VALUES (
            new_incident_id,
            new_incident_code,
            NEW.latitude,
            NEW.longitude,
            'open',
            NEW.created_at,
            NEW.created_at
        );

        INSERT INTO public.recurring_incident_reports (
            incident_id,
            report_id
        )
        VALUES (
            new_incident_id,
            NEW.id
        );

    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."detect_recurring_incidents"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_report_duplicates"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
BEGIN
    INSERT INTO public.report_duplicate_candidates (
        report_id,
        candidate_report_id,
        distance_meters,
        time_difference_hours
    )
    SELECT
        NEW.id,
        existing.id,
        distance_calc.distance_meters,
        ABS(
            EXTRACT(
                EPOCH FROM (NEW.created_at - existing.created_at)
            )
        ) / 3600.0
    FROM public.reports AS existing

    CROSS JOIN LATERAL (
        SELECT
            6371000.0 * 2.0 * ASIN(
                SQRT(
                    LEAST(
                        1.0,
                        GREATEST(
                            0.0,
                            POWER(
                                SIN(
                                    RADIANS(
                                        NEW.latitude - existing.latitude
                                    ) / 2.0
                                ),
                                2
                            )
                            +
                            COS(RADIANS(NEW.latitude))
                            * COS(RADIANS(existing.latitude))
                            * POWER(
                                SIN(
                                    RADIANS(
                                        NEW.longitude - existing.longitude
                                    ) / 2.0
                                ),
                                2
                            )
                        )
                    )
                )
            ) AS distance_meters
    ) AS distance_calc

    WHERE existing.id <> NEW.id

      AND ABS(
          EXTRACT(
              EPOCH FROM (NEW.created_at - existing.created_at)
          )
      ) <= 86400

      AND distance_calc.distance_meters <= 100

    ON CONFLICT (report_id, candidate_report_id)
    DO NOTHING;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."detect_report_duplicates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_recurring_incident_candidate"("p_candidate_id" "uuid", "p_review_status" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
DECLARE
    v_candidate public.recurring_incident_candidates%ROWTYPE;
    v_incident public.recurring_incidents%ROWTYPE;
    v_admin_id UUID;
BEGIN
    -- Verify the authenticated administrator.
    v_admin_id := auth.uid();

    IF v_admin_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE user_id = v_admin_id
    ) THEN
        RAISE EXCEPTION 'Administrator access required';
    END IF;

    -- Validate the requested action.
    IF p_review_status NOT IN ('linked', 'rejected') THEN
        RAISE EXCEPTION 'Invalid review status';
    END IF;

    -- Lock the candidate to prevent simultaneous reviews.
    SELECT *
    INTO v_candidate
    FROM public.recurring_incident_candidates
    WHERE id = p_candidate_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident candidate not found';
    END IF;

    IF v_candidate.review_status <> 'pending_review' THEN
        RAISE EXCEPTION 'Candidate has already been reviewed';
    END IF;

    -- Lock the incident.
    SELECT *
    INTO v_incident
    FROM public.recurring_incidents
    WHERE id = v_candidate.incident_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident not found';
    END IF;

    IF p_review_status = 'linked' THEN

        IF v_incident.status <> 'open' THEN
            RAISE EXCEPTION 'Cannot link a report to a resolved incident';
        END IF;

        -- Prevent a report from belonging to another incident.
        INSERT INTO public.recurring_incident_reports (
            incident_id,
            report_id,
            linked_by
        )
        VALUES (
            v_candidate.incident_id,
            v_candidate.report_id,
            v_admin_id
        );

        -- Update the latest report timestamp.
        UPDATE public.recurring_incidents
        SET
            last_reported_at = GREATEST(
                last_reported_at,
                (
                    SELECT created_at
                    FROM public.reports
                    WHERE id = v_candidate.report_id
                )
            ),
            updated_at = NOW()
        WHERE id = v_candidate.incident_id;

    END IF;

    -- Record the administrator's decision.
    UPDATE public.recurring_incident_candidates
    SET
        review_status = p_review_status,
        reviewed_by = v_admin_id,
        reviewed_at = NOW()
    WHERE id = p_candidate_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'candidate_id', p_candidate_id,
        'incident_id', v_candidate.incident_id,
        'report_id', v_candidate.report_id,
        'review_status', p_review_status
    );
END;
$$;


ALTER FUNCTION "public"."review_recurring_incident_candidate"("p_candidate_id" "uuid", "p_review_status" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."public_historical_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "source_record_id" "text" NOT NULL,
    "address" "text",
    "ward" "text",
    "observed_at" timestamp without time zone,
    "observation_date" "date" NOT NULL,
    "observation_time" time without time zone,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "observations" "text",
    "image_url" "text",
    "entry_type" "text",
    "geometry_type" "text" DEFAULT 'point'::"text" NOT NULL,
    "possible_duplicate" boolean DEFAULT false NOT NULL,
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "valid_public_latitude" CHECK ((("latitude" >= ('-90'::integer)::double precision) AND ("latitude" <= (90)::double precision))),
    CONSTRAINT "valid_public_longitude" CHECK ((("longitude" >= ('-180'::integer)::double precision) AND ("longitude" <= (180)::double precision)))
);


ALTER TABLE "public"."public_historical_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_incident_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incident_id" "uuid" NOT NULL,
    "report_id" "uuid" NOT NULL,
    "distance_meters" double precision NOT NULL,
    "time_difference_hours" double precision NOT NULL,
    "review_status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recurring_incident_candidates_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending_review'::"text", 'linked'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."recurring_incident_candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_incident_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incident_id" "uuid" NOT NULL,
    "report_id" "uuid" NOT NULL,
    "linked_by" "uuid",
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recurring_incident_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incident_code" "text" NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "first_reported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_reported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cleared_at" timestamp with time zone,
    "cleared_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recurring_incidents_check" CHECK (((("status" = 'open'::"text") AND ("cleared_at" IS NULL)) OR (("status" = 'resolved'::"text") AND ("cleared_at" IS NOT NULL)))),
    CONSTRAINT "recurring_incidents_latitude_check" CHECK ((("latitude" >= ('-90'::integer)::double precision) AND ("latitude" <= (90)::double precision))),
    CONSTRAINT "recurring_incidents_longitude_check" CHECK ((("longitude" >= ('-180'::integer)::double precision) AND ("longitude" <= (180)::double precision))),
    CONSTRAINT "recurring_incidents_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."recurring_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."report_duplicate_candidates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "candidate_report_id" "uuid" NOT NULL,
    "distance_meters" double precision NOT NULL,
    "time_difference_hours" double precision NOT NULL,
    "review_status" "text" DEFAULT 'pending_review'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "report_duplicate_candidates_check" CHECK (("report_id" <> "candidate_report_id")),
    CONSTRAINT "report_duplicate_candidates_review_status_check" CHECK (("review_status" = ANY (ARRAY['pending_review'::"text", 'confirmed_duplicate'::"text", 'not_duplicate'::"text"])))
);


ALTER TABLE "public"."report_duplicate_candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_code" "text" NOT NULL,
    "image_path" "text" NOT NULL,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "accuracy" double precision,
    "description" "text",
    "status" "text" DEFAULT 'pending_verification'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reports_status_check" CHECK (("status" = ANY (ARRAY['pending_verification'::"text", 'verified'::"text", 'assigned'::"text", 'resolved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "valid_latitude" CHECK ((("latitude" >= ('-90'::integer)::double precision) AND ("latitude" <= (90)::double precision))),
    CONSTRAINT "valid_longitude" CHECK ((("longitude" >= ('-180'::integer)::double precision) AND ("longitude" <= (180)::double precision)))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."synthetic_historical_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" DEFAULT 'synthetic_bengaluru_simulation'::"text" NOT NULL,
    "source_record_id" "text" NOT NULL,
    "is_synthetic" boolean DEFAULT true NOT NULL,
    "synthetic_cluster_id" "text" NOT NULL,
    "observation_date" "date" NOT NULL,
    "observation_time" time without time zone,
    "observed_at" timestamp without time zone,
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "category" "text" NOT NULL,
    "description" "text" NOT NULL,
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "synthetic_records_must_be_marked" CHECK (("is_synthetic" = true)),
    CONSTRAINT "valid_synthetic_latitude" CHECK ((("latitude" >= ('-90'::integer)::double precision) AND ("latitude" <= (90)::double precision))),
    CONSTRAINT "valid_synthetic_longitude" CHECK ((("longitude" >= ('-180'::integer)::double precision) AND ("longitude" <= (180)::double precision)))
);


ALTER TABLE "public"."synthetic_historical_reports" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."public_historical_reports"
    ADD CONSTRAINT "public_historical_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_incident_candidates"
    ADD CONSTRAINT "recurring_incident_candidates_incident_id_report_id_key" UNIQUE ("incident_id", "report_id");



ALTER TABLE ONLY "public"."recurring_incident_candidates"
    ADD CONSTRAINT "recurring_incident_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_incident_reports"
    ADD CONSTRAINT "recurring_incident_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_incident_reports"
    ADD CONSTRAINT "recurring_incident_reports_report_id_key" UNIQUE ("report_id");



ALTER TABLE ONLY "public"."recurring_incidents"
    ADD CONSTRAINT "recurring_incidents_incident_code_key" UNIQUE ("incident_code");



ALTER TABLE ONLY "public"."recurring_incidents"
    ADD CONSTRAINT "recurring_incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_duplicate_candidates"
    ADD CONSTRAINT "report_duplicate_candidates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."report_duplicate_candidates"
    ADD CONSTRAINT "report_duplicate_candidates_report_id_candidate_report_id_key" UNIQUE ("report_id", "candidate_report_id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_report_code_key" UNIQUE ("report_code");



ALTER TABLE ONLY "public"."synthetic_historical_reports"
    ADD CONSTRAINT "synthetic_historical_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."synthetic_historical_reports"
    ADD CONSTRAINT "synthetic_historical_reports_source_record_id_key" UNIQUE ("source_record_id");



ALTER TABLE ONLY "public"."public_historical_reports"
    ADD CONSTRAINT "unique_public_source_record" UNIQUE ("source", "source_record_id");



CREATE INDEX "idx_duplicate_candidates_report_id" ON "public"."report_duplicate_candidates" USING "btree" ("report_id");



CREATE INDEX "idx_duplicate_candidates_status" ON "public"."report_duplicate_candidates" USING "btree" ("review_status");



CREATE INDEX "idx_incident_reports_incident_id" ON "public"."recurring_incident_reports" USING "btree" ("incident_id");



CREATE INDEX "idx_incident_reports_report_id" ON "public"."recurring_incident_reports" USING "btree" ("report_id");



CREATE INDEX "idx_public_historical_location" ON "public"."public_historical_reports" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_public_historical_observation_date" ON "public"."public_historical_reports" USING "btree" ("observation_date");



CREATE INDEX "idx_public_historical_ward" ON "public"."public_historical_reports" USING "btree" ("ward");



CREATE INDEX "idx_recurring_candidates_incident_id" ON "public"."recurring_incident_candidates" USING "btree" ("incident_id");



CREATE INDEX "idx_recurring_candidates_report_id" ON "public"."recurring_incident_candidates" USING "btree" ("report_id");



CREATE INDEX "idx_recurring_candidates_status" ON "public"."recurring_incident_candidates" USING "btree" ("review_status");



CREATE INDEX "idx_recurring_incidents_location" ON "public"."recurring_incidents" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_recurring_incidents_status" ON "public"."recurring_incidents" USING "btree" ("status");



CREATE INDEX "idx_synthetic_cluster" ON "public"."synthetic_historical_reports" USING "btree" ("synthetic_cluster_id");



CREATE INDEX "idx_synthetic_location" ON "public"."synthetic_historical_reports" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_synthetic_observation_date" ON "public"."synthetic_historical_reports" USING "btree" ("observation_date");



CREATE OR REPLACE TRIGGER "trigger_detect_recurring_incidents" AFTER INSERT ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."detect_recurring_incidents"();



CREATE OR REPLACE TRIGGER "trigger_detect_report_duplicates" AFTER INSERT ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."detect_report_duplicates"();



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_incident_candidates"
    ADD CONSTRAINT "recurring_incident_candidates_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."recurring_incidents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_incident_candidates"
    ADD CONSTRAINT "recurring_incident_candidates_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_incident_candidates"
    ADD CONSTRAINT "recurring_incident_candidates_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recurring_incident_reports"
    ADD CONSTRAINT "recurring_incident_reports_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "public"."recurring_incidents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_incident_reports"
    ADD CONSTRAINT "recurring_incident_reports_linked_by_fkey" FOREIGN KEY ("linked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recurring_incident_reports"
    ADD CONSTRAINT "recurring_incident_reports_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_incidents"
    ADD CONSTRAINT "recurring_incidents_cleared_by_fkey" FOREIGN KEY ("cleared_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."report_duplicate_candidates"
    ADD CONSTRAINT "report_duplicate_candidates_candidate_report_id_fkey" FOREIGN KEY ("candidate_report_id") REFERENCES "public"."reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_duplicate_candidates"
    ADD CONSTRAINT "report_duplicate_candidates_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."report_duplicate_candidates"
    ADD CONSTRAINT "report_duplicate_candidates_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Admins can create recurring incidents" ON "public"."recurring_incidents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can link reports to incidents" ON "public"."recurring_incident_reports" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can review duplicate candidates" ON "public"."report_duplicate_candidates" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can review recurring incident candidates" ON "public"."recurring_incident_candidates" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can update recurring incidents" ON "public"."recurring_incidents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can update report status" ON "public"."reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can view duplicate candidates" ON "public"."report_duplicate_candidates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can view incident report links" ON "public"."recurring_incident_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can view public historical reports" ON "public"."public_historical_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can view recurring incident candidates" ON "public"."recurring_incident_candidates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can view recurring incidents" ON "public"."recurring_incidents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can view reports" ON "public"."reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can view synthetic historical reports" ON "public"."synthetic_historical_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."admin_users"
  WHERE ("admin_users"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Admins can view their own admin record" ON "public"."admin_users" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Allow anonymous report submissions" ON "public"."reports" FOR INSERT TO "anon" WITH CHECK (true);



ALTER TABLE "public"."admin_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."public_historical_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_incident_candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_incident_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_incidents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."report_duplicate_candidates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."synthetic_historical_reports" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_recurring_incidents"() TO "anon";
GRANT ALL ON FUNCTION "public"."detect_recurring_incidents"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_recurring_incidents"() TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_report_duplicates"() TO "anon";
GRANT ALL ON FUNCTION "public"."detect_report_duplicates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_report_duplicates"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."review_recurring_incident_candidate"("p_candidate_id" "uuid", "p_review_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_recurring_incident_candidate"("p_candidate_id" "uuid", "p_review_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."review_recurring_incident_candidate"("p_candidate_id" "uuid", "p_review_status" "text") TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."public_historical_reports" TO "anon";
GRANT ALL ON TABLE "public"."public_historical_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."public_historical_reports" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_incident_candidates" TO "service_role";
GRANT SELECT ON TABLE "public"."recurring_incident_candidates" TO "authenticated";



GRANT UPDATE("review_status") ON TABLE "public"."recurring_incident_candidates" TO "authenticated";



GRANT UPDATE("reviewed_by") ON TABLE "public"."recurring_incident_candidates" TO "authenticated";



GRANT UPDATE("reviewed_at") ON TABLE "public"."recurring_incident_candidates" TO "authenticated";



GRANT ALL ON TABLE "public"."recurring_incident_reports" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."recurring_incident_reports" TO "authenticated";



GRANT ALL ON TABLE "public"."recurring_incidents" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."recurring_incidents" TO "authenticated";



GRANT ALL ON TABLE "public"."report_duplicate_candidates" TO "service_role";
GRANT SELECT ON TABLE "public"."report_duplicate_candidates" TO "authenticated";



GRANT UPDATE("review_status") ON TABLE "public"."report_duplicate_candidates" TO "authenticated";



GRANT UPDATE("reviewed_by") ON TABLE "public"."report_duplicate_candidates" TO "authenticated";



GRANT UPDATE("reviewed_at") ON TABLE "public"."report_duplicate_candidates" TO "authenticated";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT UPDATE("status") ON TABLE "public"."reports" TO "authenticated";



GRANT ALL ON TABLE "public"."synthetic_historical_reports" TO "anon";
GRANT ALL ON TABLE "public"."synthetic_historical_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."synthetic_historical_reports" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








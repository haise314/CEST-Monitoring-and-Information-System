--
-- PostgreSQL database dump
--

\restrict wtDmFxxb1aIl6P1rCNuScS6SfAR5cK6B9D99NuJIqZAZbx3IwdOKXo15BO8btqQ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11 (Ubuntu 17.11-1.pgdg24.04+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: agency_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agency_role AS ENUM (
    'implementing',
    'cooperating'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'editor',
    'viewer'
);


--
-- Name: beneficiary_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.beneficiary_category AS ENUM (
    'LGU',
    'Academe',
    'SDO',
    'NGO',
    'Cooperative',
    'Others',
    'BLGU'
);


--
-- Name: document_applies_to; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_applies_to AS ENUM (
    'Both',
    'In-house',
    'Fund Transfer'
);


--
-- Name: document_phase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.document_phase AS ENUM (
    'Pre-Implementation',
    'Semi-Annual',
    'Annual',
    'Transfer'
);


--
-- Name: operational_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.operational_status AS ENUM (
    'Operational',
    'Non-operational',
    'For Repair & Maintenance'
);


--
-- Name: overall_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.overall_status AS ENUM (
    'For Deployment',
    'For Implementation',
    'For Monitoring',
    'For Transfer',
    'Transfer Ongoing',
    'Fully Transferred',
    'For Pull Out',
    'Done'
);


--
-- Name: project_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_category AS ENUM (
    'In-house',
    'Fund Transfer'
);


--
-- Name: project_scope; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_scope AS ENUM (
    'Provincial',
    'Regional'
);


--
-- Name: remark_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.remark_level AS ENUM (
    'provincial',
    'regional'
);


--
-- Name: backup_export(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.backup_export() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  t      text;
  rows   jsonb;
  tables jsonb := '{}'::jsonb;
  counts jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can create a backup.';
  end if;

  foreach t in array array[
    'project_types','agencies','annual_budgets','document_types','beneficiaries','beneficiary_contacts',
    'contact_beneficiaries',
    'project_instances','documents','project_contacts','remarks','project_agencies','project_beneficiaries',
    'itineraries','itinerary_stops','profiles'
  ] loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x) order by x.id), ''[]''::jsonb) from public.%I x', t
    ) into rows;
    tables := tables || jsonb_build_object(t, rows);
    counts := counts || jsonb_build_object(t, jsonb_array_length(rows));
  end loop;

  insert into public.backup_status (id, last_backup_at, last_backup_by)
  values (1, now(), auth.uid())
  on conflict (id) do update
    set last_backup_at = excluded.last_backup_at,
        last_backup_by = excluded.last_backup_by;

  return jsonb_build_object(
    'app',         'cest-mis',
    'version',     1,
    'exported_at', now(),
    'exported_by', (select full_name from public.profiles where id = auth.uid()),
    'row_counts',  counts,
    'tables',      tables
  );
end;
$$;


--
-- Name: backup_restore(jsonb, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.backup_restore(p_payload jsonb, p_apply boolean DEFAULT false, p_overwrite boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  tbl      text;
  arr      jsonb;
  cols     text;
  setlist  text;
  seq      text;
  n_total  int;
  n_new    int;
  n_diff   int;
  n_same   int;
  report   jsonb := '{}'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can restore a backup.';
  end if;
  if p_payload is null or p_payload->>'app' is distinct from 'cest-mis' then
    raise exception 'This file is not a CEST-MIS backup.';
  end if;
  if (p_payload->>'version') is distinct from '1' then
    raise exception 'Unsupported backup version: %', coalesce(p_payload->>'version', 'none');
  end if;

  -- parents before children so foreign keys are satisfied
  foreach tbl in array array[
    'project_types','agencies','annual_budgets','document_types','beneficiaries','beneficiary_contacts',
    'contact_beneficiaries',
    'project_instances','documents','project_contacts','remarks','project_agencies','project_beneficiaries',
    'itineraries','itinerary_stops'
  ] loop
    arr := coalesce(p_payload->'tables'->tbl, '[]'::jsonb);
    if jsonb_typeof(arr) <> 'array' then
      raise exception 'Backup is damaged: "%" is not a list of rows.', tbl;
    end if;

    -- remarks.created_by points at a login; if that login no longer exists,
    -- keep the remark but drop the pointer instead of failing the restore.
    if tbl = 'remarks' then
      select coalesce(jsonb_agg(
               case when e->>'created_by' is not null
                         and not exists (select 1 from auth.users u where u.id = (e->>'created_by')::uuid)
                    then e || '{"created_by": null}'::jsonb
                    else e end), '[]'::jsonb)
        into arr
        from jsonb_array_elements(arr) e;
    end if;

    -- backups taken before the budget feature have no project_scope; the
    -- column is NOT NULL, so give those rows the default instead of failing.
    if tbl = 'project_instances' then
      select coalesce(jsonb_agg(
               case when e->>'project_scope' is null
                    then e || '{"project_scope": "Provincial"}'::jsonb
                    else e end), '[]'::jsonb)
        into arr
        from jsonb_array_elements(arr) e;
    end if;

    if tbl = 'contact_beneficiaries' then
      if p_payload->'tables'->'contact_beneficiaries' is not null then
        -- Current backup. Skip a link whose contact+beneficiary pair already
        -- exists under a different id (it would break the unique rule).
        select coalesce(jsonb_agg(e), '[]'::jsonb)
          into arr
          from jsonb_array_elements(arr) e
         where not exists (
                 select 1 from public.contact_beneficiaries l
                  where l.contact_id     = (e->>'contact_id')::int
                    and l.beneficiary_id = (e->>'beneficiary_id')::int
                    and l.id is distinct from (e->>'id')::int);
      else
        -- Backup made before this table existed: each contact carried one
        -- beneficiary_id. Rebuild links from that (skipping pairs already
        -- present and beneficiaries that exist neither now nor in the file).
        select coalesce(jsonb_agg(r), '[]'::jsonb)
          into arr
          from (
            select jsonb_build_object(
                     'id', (select coalesce(max(id), 0) from public.contact_beneficiaries)
                           + row_number() over (order by (c.e->>'id')::int),
                     'contact_id',     (c.e->>'id')::int,
                     'beneficiary_id', (c.e->>'beneficiary_id')::int) as r
              from jsonb_array_elements(coalesce(p_payload->'tables'->'beneficiary_contacts', '[]'::jsonb)) as c(e)
             where c.e->>'beneficiary_id' is not null
               and not exists (select 1 from public.contact_beneficiaries l
                                where l.contact_id = (c.e->>'id')::int
                                  and l.beneficiary_id = (c.e->>'beneficiary_id')::int)
               and (exists (select 1 from public.beneficiaries b where b.id = (c.e->>'beneficiary_id')::int)
                    or exists (select 1
                                 from jsonb_array_elements(coalesce(p_payload->'tables'->'beneficiaries', '[]'::jsonb)) bb
                                where (bb->>'id')::int = (c.e->>'beneficiary_id')::int))
          ) s;
      end if;
    end if;

    execute format($q$
      with src as (select * from jsonb_populate_recordset(null::public.%1$I, $1))
      select count(*),
             count(*) filter (where t.id is null),
             count(*) filter (where t.id is not null and to_jsonb(t) is distinct from to_jsonb(src)),
             count(*) filter (where t.id is not null and to_jsonb(t) is not distinct from to_jsonb(src))
        from src left join public.%1$I t on t.id = src.id
    $q$, tbl)
    into n_total, n_new, n_diff, n_same
    using arr;

    report := report || jsonb_build_object(tbl, jsonb_build_object(
      'in_file', n_total, 'new', n_new, 'differ', n_diff, 'identical', n_same));

    if p_apply and n_total > 0 then
      select string_agg(format('%I', column_name), ', ' order by ordinal_position)
        into cols
        from information_schema.columns
       where table_schema = 'public' and table_name = tbl;

      select string_agg(format('%1$I = excluded.%1$I', column_name), ', ' order by ordinal_position)
        into setlist
        from information_schema.columns
       where table_schema = 'public' and table_name = tbl and column_name <> 'id';

      execute format(
        'insert into public.%1$I (%2$s) overriding system value '
        'select %2$s from jsonb_populate_recordset(null::public.%1$I, $1) %3$s',
        tbl, cols,
        case when p_overwrite
             then 'on conflict (id) do update set ' || setlist
             else 'on conflict (id) do nothing' end
      ) using arr;

      -- keep the id counter ahead of the highest restored id
      seq := pg_get_serial_sequence(format('public.%I', tbl), 'id');
      if seq is not null then
        execute format(
          'select setval(%L, greatest((select coalesce(max(id), 0) from public.%I), 1))', seq, tbl);
      end if;
    end if;
  end loop;

  if p_apply then
    update public.backup_status
       set last_restore_at = now(), last_restore_by = auth.uid()
     where id = 1;
  end if;

  return jsonb_build_object(
    'applied',   p_apply,
    'overwrite', p_overwrite,
    'tables',    report
  );
end;
$_$;


--
-- Name: can_edit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_edit() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role in ('admin', 'editor'));
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin');
$$;


--
-- Name: is_member(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_member() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;


--
-- Name: reassign_project_beneficiary(integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reassign_project_beneficiary(p_project_id integer, p_beneficiary_id integer, p_unlink_contacts boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.project_instances set beneficiary_id = p_beneficiary_id where id = p_project_id;
  if not found then
    raise exception 'Project not found, or you do not have permission to change it.';
  end if;

  update public.itinerary_stops set beneficiary_id = p_beneficiary_id where project_id = p_project_id;

  delete from public.project_beneficiaries
   where project_id = p_project_id and beneficiary_id = p_beneficiary_id;

  if p_unlink_contacts then
    delete from public.project_contacts pc
     where pc.project_id = p_project_id
       and not exists (
         select 1 from public.contact_beneficiaries cb
          where cb.contact_id = pc.contact_id and cb.beneficiary_id = p_beneficiary_id);
  end if;
end;
$$;


--
-- Name: save_contact(integer, text, text, text, text, integer[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.save_contact(p_id integer, p_name text, p_role text, p_contact_number text, p_messenger_link text, p_beneficiary_ids integer[], p_email text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id  integer;
  v_ids integer[] := coalesce(p_beneficiary_ids, '{}');
begin
  if p_id is null then
    insert into public.beneficiary_contacts (name, role, contact_number, messenger_link, email)
    values (p_name, p_role, p_contact_number, p_messenger_link, p_email)
    returning id into v_id;
  else
    update public.beneficiary_contacts
       set name = p_name, role = p_role,
           contact_number = p_contact_number, messenger_link = p_messenger_link,
           email = p_email
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Contact not found, or you do not have permission to change it.';
    end if;
  end if;

  delete from public.contact_beneficiaries
   where contact_id = v_id and beneficiary_id <> all (v_ids);

  insert into public.contact_beneficiaries (contact_id, beneficiary_id)
  select v_id, b from unnest(v_ids) b
  on conflict (contact_id, beneficiary_id) do nothing;

  return v_id;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: agencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agencies (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agencies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.agencies ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.agencies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: annual_budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.annual_budgets (
    year smallint NOT NULL,
    allocated_amount numeric(14,2) NOT NULL,
    notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id integer NOT NULL,
    CONSTRAINT annual_budgets_allocated_amount_check CHECK ((allocated_amount >= (0)::numeric))
);


--
-- Name: annual_budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.annual_budgets ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.annual_budgets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: backup_status; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_status (
    id integer DEFAULT 1 NOT NULL,
    last_backup_at timestamp with time zone,
    last_backup_by uuid,
    last_restore_at timestamp with time zone,
    last_restore_by uuid,
    CONSTRAINT backup_status_id_check CHECK ((id = 1))
);


--
-- Name: beneficiaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beneficiaries (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    category public.beneficiary_category NOT NULL,
    district character varying(100),
    municipality character varying(100),
    barangay character varying(100),
    latitude numeric(9,6),
    longitude numeric(9,6),
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: beneficiaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.beneficiaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: beneficiaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.beneficiaries_id_seq OWNED BY public.beneficiaries.id;


--
-- Name: beneficiary_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beneficiary_contacts (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(100),
    contact_number character varying(50),
    messenger_link text,
    updated_at timestamp with time zone DEFAULT now(),
    email character varying(255)
);


--
-- Name: beneficiary_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.beneficiary_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: beneficiary_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.beneficiary_contacts_id_seq OWNED BY public.beneficiary_contacts.id;


--
-- Name: contact_beneficiaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_beneficiaries (
    id integer NOT NULL,
    contact_id integer NOT NULL,
    beneficiary_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contact_beneficiaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.contact_beneficiaries ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.contact_beneficiaries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: document_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_types (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    is_default boolean DEFAULT true NOT NULL,
    phase public.document_phase,
    applies_to public.document_applies_to DEFAULT 'Both'::public.document_applies_to NOT NULL,
    is_required boolean DEFAULT true NOT NULL
);


--
-- Name: document_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.document_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: document_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.document_types_id_seq OWNED BY public.document_types.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    project_id integer NOT NULL,
    document_type_id integer,
    custom_label character varying(255),
    expected_date date,
    submitted boolean DEFAULT false NOT NULL,
    submitted_date date,
    notes text,
    has_hard_copy boolean DEFAULT false NOT NULL,
    hard_copy_claimable boolean DEFAULT false NOT NULL,
    gdrive_link text,
    is_not_applicable boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT document_label_check CHECK (((document_type_id IS NOT NULL) OR (custom_label IS NOT NULL)))
);


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: itineraries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itineraries (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    visit_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: itineraries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.itineraries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: itineraries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.itineraries_id_seq OWNED BY public.itineraries.id;


--
-- Name: itinerary_stops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itinerary_stops (
    id integer NOT NULL,
    itinerary_id integer NOT NULL,
    beneficiary_id integer NOT NULL,
    stop_order integer NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    project_id integer
);


--
-- Name: itinerary_stops_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.itinerary_stops_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: itinerary_stops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.itinerary_stops_id_seq OWNED BY public.itinerary_stops.id;


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text,
    role public.app_role DEFAULT 'viewer'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_agencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_agencies (
    id integer NOT NULL,
    project_id integer NOT NULL,
    agency_id integer NOT NULL,
    role public.agency_role NOT NULL,
    counterpart_amount numeric(12,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_agencies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.project_agencies ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.project_agencies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: project_beneficiaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_beneficiaries (
    id integer NOT NULL,
    project_id integer NOT NULL,
    beneficiary_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_beneficiaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.project_beneficiaries ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.project_beneficiaries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: project_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_contacts (
    id integer NOT NULL,
    project_id integer NOT NULL,
    contact_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_contacts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_contacts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_contacts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_contacts_id_seq OWNED BY public.project_contacts.id;


--
-- Name: project_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_instances (
    id integer NOT NULL,
    year smallint NOT NULL,
    project_type_id integer NOT NULL,
    beneficiary_id integer NOT NULL,
    property_number character varying(100),
    amount numeric(12,2),
    date_deployed date,
    entry_point character varying(255),
    intervention text,
    members_male integer DEFAULT 0,
    members_female integer DEFAULT 0,
    senior_citizen integer DEFAULT 0,
    pwds integer DEFAULT 0,
    fourps integer DEFAULT 0,
    ips integer DEFAULT 0,
    operational_status public.operational_status,
    interventions_count integer DEFAULT 0,
    people_trained integer DEFAULT 0,
    impact_notes text,
    overall_status public.overall_status DEFAULT 'For Deployment'::public.overall_status NOT NULL,
    gdrive_folder_link text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    project_category public.project_category,
    title character varying(255),
    project_scope public.project_scope DEFAULT 'Provincial'::public.project_scope NOT NULL,
    latitude numeric(9,6),
    longitude numeric(9,6)
);


--
-- Name: project_instances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_instances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_instances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_instances_id_seq OWNED BY public.project_instances.id;


--
-- Name: project_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    icon_svg text,
    CONSTRAINT project_types_icon_svg_size CHECK (((icon_svg IS NULL) OR (length(icon_svg) <= 60000)))
);


--
-- Name: project_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.project_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: project_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.project_types_id_seq OWNED BY public.project_types.id;


--
-- Name: remarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.remarks (
    id integer NOT NULL,
    project_id integer NOT NULL,
    level public.remark_level NOT NULL,
    content text NOT NULL,
    added_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid DEFAULT auth.uid()
);


--
-- Name: remarks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.remarks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: remarks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.remarks_id_seq OWNED BY public.remarks.id;


--
-- Name: beneficiaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaries ALTER COLUMN id SET DEFAULT nextval('public.beneficiaries_id_seq'::regclass);


--
-- Name: beneficiary_contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_contacts ALTER COLUMN id SET DEFAULT nextval('public.beneficiary_contacts_id_seq'::regclass);


--
-- Name: document_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types ALTER COLUMN id SET DEFAULT nextval('public.document_types_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: itineraries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itineraries ALTER COLUMN id SET DEFAULT nextval('public.itineraries_id_seq'::regclass);


--
-- Name: itinerary_stops id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_stops ALTER COLUMN id SET DEFAULT nextval('public.itinerary_stops_id_seq'::regclass);


--
-- Name: project_contacts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contacts ALTER COLUMN id SET DEFAULT nextval('public.project_contacts_id_seq'::regclass);


--
-- Name: project_instances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_instances ALTER COLUMN id SET DEFAULT nextval('public.project_instances_id_seq'::regclass);


--
-- Name: project_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_types ALTER COLUMN id SET DEFAULT nextval('public.project_types_id_seq'::regclass);


--
-- Name: remarks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remarks ALTER COLUMN id SET DEFAULT nextval('public.remarks_id_seq'::regclass);


--
-- Name: agencies agencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agencies
    ADD CONSTRAINT agencies_pkey PRIMARY KEY (id);


--
-- Name: annual_budgets annual_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_budgets
    ADD CONSTRAINT annual_budgets_pkey PRIMARY KEY (id);


--
-- Name: annual_budgets annual_budgets_year_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.annual_budgets
    ADD CONSTRAINT annual_budgets_year_key UNIQUE (year);


--
-- Name: backup_status backup_status_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_status
    ADD CONSTRAINT backup_status_pkey PRIMARY KEY (id);


--
-- Name: beneficiaries beneficiaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiaries
    ADD CONSTRAINT beneficiaries_pkey PRIMARY KEY (id);


--
-- Name: beneficiary_contacts beneficiary_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beneficiary_contacts
    ADD CONSTRAINT beneficiary_contacts_pkey PRIMARY KEY (id);


--
-- Name: contact_beneficiaries contact_beneficiaries_contact_id_beneficiary_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_beneficiaries
    ADD CONSTRAINT contact_beneficiaries_contact_id_beneficiary_id_key UNIQUE (contact_id, beneficiary_id);


--
-- Name: contact_beneficiaries contact_beneficiaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_beneficiaries
    ADD CONSTRAINT contact_beneficiaries_pkey PRIMARY KEY (id);


--
-- Name: document_types document_types_name_phase_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_name_phase_key UNIQUE (name, phase);


--
-- Name: document_types document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_types
    ADD CONSTRAINT document_types_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: itineraries itineraries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itineraries
    ADD CONSTRAINT itineraries_pkey PRIMARY KEY (id);


--
-- Name: itinerary_stops itinerary_stops_itinerary_id_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_stops
    ADD CONSTRAINT itinerary_stops_itinerary_id_project_id_key UNIQUE (itinerary_id, project_id);


--
-- Name: itinerary_stops itinerary_stops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_stops
    ADD CONSTRAINT itinerary_stops_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_agencies project_agencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_agencies
    ADD CONSTRAINT project_agencies_pkey PRIMARY KEY (id);


--
-- Name: project_agencies project_agencies_project_id_agency_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_agencies
    ADD CONSTRAINT project_agencies_project_id_agency_id_role_key UNIQUE (project_id, agency_id, role);


--
-- Name: project_beneficiaries project_beneficiaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_beneficiaries
    ADD CONSTRAINT project_beneficiaries_pkey PRIMARY KEY (id);


--
-- Name: project_beneficiaries project_beneficiaries_project_id_beneficiary_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_beneficiaries
    ADD CONSTRAINT project_beneficiaries_project_id_beneficiary_id_key UNIQUE (project_id, beneficiary_id);


--
-- Name: project_contacts project_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contacts
    ADD CONSTRAINT project_contacts_pkey PRIMARY KEY (id);


--
-- Name: project_contacts project_contacts_project_id_contact_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contacts
    ADD CONSTRAINT project_contacts_project_id_contact_id_key UNIQUE (project_id, contact_id);


--
-- Name: project_instances project_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_instances
    ADD CONSTRAINT project_instances_pkey PRIMARY KEY (id);


--
-- Name: project_types project_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_types
    ADD CONSTRAINT project_types_name_key UNIQUE (name);


--
-- Name: project_types project_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_types
    ADD CONSTRAINT project_types_pkey PRIMARY KEY (id);


--
-- Name: remarks remarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_pkey PRIMARY KEY (id);


--
-- Name: agencies_name_lower_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agencies_name_lower_key ON public.agencies USING btree (lower((name)::text));


--
-- Name: contact_beneficiaries_beneficiary_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contact_beneficiaries_beneficiary_id_idx ON public.contact_beneficiaries USING btree (beneficiary_id);


--
-- Name: project_agencies_agency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_agencies_agency_idx ON public.project_agencies USING btree (agency_id);


--
-- Name: project_agencies_one_ia; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX project_agencies_one_ia ON public.project_agencies USING btree (project_id) WHERE (role = 'implementing'::public.agency_role);


--
-- Name: project_beneficiaries_ben_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_beneficiaries_ben_idx ON public.project_beneficiaries USING btree (beneficiary_id);


--
-- Name: project_instances project_instances_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER project_instances_set_updated_at BEFORE UPDATE ON public.project_instances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: agencies trg_agencies_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_agencies_updated_at BEFORE UPDATE ON public.agencies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: annual_budgets trg_annual_budgets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_annual_budgets_updated_at BEFORE UPDATE ON public.annual_budgets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: beneficiaries trg_beneficiaries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_beneficiaries_updated_at BEFORE UPDATE ON public.beneficiaries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: beneficiary_contacts trg_beneficiary_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_beneficiary_contacts_updated_at BEFORE UPDATE ON public.beneficiary_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: documents trg_documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: backup_status backup_status_last_backup_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_status
    ADD CONSTRAINT backup_status_last_backup_by_fkey FOREIGN KEY (last_backup_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: backup_status backup_status_last_restore_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_status
    ADD CONSTRAINT backup_status_last_restore_by_fkey FOREIGN KEY (last_restore_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: contact_beneficiaries contact_beneficiaries_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_beneficiaries
    ADD CONSTRAINT contact_beneficiaries_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE;


--
-- Name: contact_beneficiaries contact_beneficiaries_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_beneficiaries
    ADD CONSTRAINT contact_beneficiaries_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.beneficiary_contacts(id) ON DELETE CASCADE;


--
-- Name: documents documents_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_document_type_id_fkey FOREIGN KEY (document_type_id) REFERENCES public.document_types(id);


--
-- Name: documents documents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project_instances(id) ON DELETE CASCADE;


--
-- Name: itinerary_stops itinerary_stops_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_stops
    ADD CONSTRAINT itinerary_stops_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE;


--
-- Name: itinerary_stops itinerary_stops_itinerary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_stops
    ADD CONSTRAINT itinerary_stops_itinerary_id_fkey FOREIGN KEY (itinerary_id) REFERENCES public.itineraries(id) ON DELETE CASCADE;


--
-- Name: itinerary_stops itinerary_stops_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itinerary_stops
    ADD CONSTRAINT itinerary_stops_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project_instances(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_agencies project_agencies_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_agencies
    ADD CONSTRAINT project_agencies_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.agencies(id);


--
-- Name: project_agencies project_agencies_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_agencies
    ADD CONSTRAINT project_agencies_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project_instances(id) ON DELETE CASCADE;


--
-- Name: project_beneficiaries project_beneficiaries_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_beneficiaries
    ADD CONSTRAINT project_beneficiaries_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id) ON DELETE CASCADE;


--
-- Name: project_beneficiaries project_beneficiaries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_beneficiaries
    ADD CONSTRAINT project_beneficiaries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project_instances(id) ON DELETE CASCADE;


--
-- Name: project_contacts project_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contacts
    ADD CONSTRAINT project_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.beneficiary_contacts(id) ON DELETE CASCADE;


--
-- Name: project_contacts project_contacts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_contacts
    ADD CONSTRAINT project_contacts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project_instances(id) ON DELETE CASCADE;


--
-- Name: project_instances project_instances_beneficiary_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_instances
    ADD CONSTRAINT project_instances_beneficiary_id_fkey FOREIGN KEY (beneficiary_id) REFERENCES public.beneficiaries(id);


--
-- Name: project_instances project_instances_project_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_instances
    ADD CONSTRAINT project_instances_project_type_id_fkey FOREIGN KEY (project_type_id) REFERENCES public.project_types(id);


--
-- Name: remarks remarks_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: remarks remarks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.remarks
    ADD CONSTRAINT remarks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.project_instances(id) ON DELETE CASCADE;


--
-- Name: profiles Profiles readable by signed-in users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles readable by signed-in users" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: agencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

--
-- Name: annual_budgets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.annual_budgets ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_status; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_status ENABLE ROW LEVEL SECURITY;

--
-- Name: beneficiaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beneficiaries ENABLE ROW LEVEL SECURITY;

--
-- Name: beneficiary_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beneficiary_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contact_beneficiaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_beneficiaries ENABLE ROW LEVEL SECURITY;

--
-- Name: agencies delete: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: admin" ON public.agencies FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: annual_budgets delete: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: admin" ON public.annual_budgets FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: beneficiaries delete: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: admin" ON public.beneficiaries FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: document_types delete: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: admin" ON public.document_types FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: documents delete: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: admin" ON public.documents FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: project_instances delete: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: admin" ON public.project_instances FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: project_types delete: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: admin" ON public.project_types FOR DELETE TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: beneficiary_contacts delete: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: editors" ON public.beneficiary_contacts FOR DELETE TO authenticated USING (( SELECT public.can_edit() AS can_edit));


--
-- Name: contact_beneficiaries delete: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: editors" ON public.contact_beneficiaries FOR DELETE TO authenticated USING (( SELECT public.can_edit() AS can_edit));


--
-- Name: itineraries delete: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: editors" ON public.itineraries FOR DELETE TO authenticated USING (( SELECT public.can_edit() AS can_edit));


--
-- Name: itinerary_stops delete: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: editors" ON public.itinerary_stops FOR DELETE TO authenticated USING (( SELECT public.can_edit() AS can_edit));


--
-- Name: project_agencies delete: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: editors" ON public.project_agencies FOR DELETE TO authenticated USING (( SELECT public.can_edit() AS can_edit));


--
-- Name: project_beneficiaries delete: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: editors" ON public.project_beneficiaries FOR DELETE TO authenticated USING (( SELECT public.can_edit() AS can_edit));


--
-- Name: project_contacts delete: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: editors" ON public.project_contacts FOR DELETE TO authenticated USING (( SELECT public.can_edit() AS can_edit));


--
-- Name: remarks delete: own 15min, admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "delete: own 15min, admin" ON public.remarks FOR DELETE TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR (( SELECT public.can_edit() AS can_edit) AND (created_by = auth.uid()) AND (created_at > (now() - '00:15:00'::interval)))));


--
-- Name: document_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: annual_budgets insert: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: admin" ON public.annual_budgets FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: document_types insert: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: admin" ON public.document_types FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: agencies insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.agencies FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: beneficiaries insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.beneficiaries FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: beneficiary_contacts insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.beneficiary_contacts FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: contact_beneficiaries insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.contact_beneficiaries FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: documents insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.documents FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: itineraries insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.itineraries FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: itinerary_stops insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.itinerary_stops FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: project_agencies insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.project_agencies FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: project_beneficiaries insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.project_beneficiaries FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: project_contacts insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.project_contacts FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: project_instances insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.project_instances FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: project_types insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.project_types FOR INSERT TO authenticated WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: remarks insert: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "insert: editors" ON public.remarks FOR INSERT TO authenticated WITH CHECK ((( SELECT public.can_edit() AS can_edit) AND (created_by = auth.uid())));


--
-- Name: itineraries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;

--
-- Name: itinerary_stops; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.itinerary_stops ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_agencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_agencies ENABLE ROW LEVEL SECURITY;

--
-- Name: project_beneficiaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_beneficiaries ENABLE ROW LEVEL SECURITY;

--
-- Name: project_contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: project_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_instances ENABLE ROW LEVEL SECURITY;

--
-- Name: project_types; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_types ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_status read: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: admin" ON public.backup_status FOR SELECT TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: agencies read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.agencies FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: annual_budgets read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.annual_budgets FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: beneficiaries read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.beneficiaries FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: beneficiary_contacts read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.beneficiary_contacts FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: contact_beneficiaries read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.contact_beneficiaries FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: document_types read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.document_types FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: documents read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.documents FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: itineraries read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.itineraries FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: itinerary_stops read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.itinerary_stops FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: project_agencies read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.project_agencies FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: project_beneficiaries read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.project_beneficiaries FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: project_contacts read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.project_contacts FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: project_instances read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.project_instances FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: project_types read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.project_types FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: remarks read: members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "read: members" ON public.remarks FOR SELECT TO authenticated USING (( SELECT public.is_member() AS is_member));


--
-- Name: remarks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.remarks ENABLE ROW LEVEL SECURITY;

--
-- Name: annual_budgets update: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: admin" ON public.annual_budgets FOR UPDATE TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: document_types update: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: admin" ON public.document_types FOR UPDATE TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: project_types update: admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: admin" ON public.project_types FOR UPDATE TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: agencies update: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: editors" ON public.agencies FOR UPDATE TO authenticated USING (( SELECT public.can_edit() AS can_edit)) WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: beneficiaries update: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: editors" ON public.beneficiaries FOR UPDATE TO authenticated USING (( SELECT public.can_edit() AS can_edit)) WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: beneficiary_contacts update: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: editors" ON public.beneficiary_contacts FOR UPDATE TO authenticated USING (( SELECT public.can_edit() AS can_edit)) WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: documents update: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: editors" ON public.documents FOR UPDATE TO authenticated USING (( SELECT public.can_edit() AS can_edit)) WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: itineraries update: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: editors" ON public.itineraries FOR UPDATE TO authenticated USING (( SELECT public.can_edit() AS can_edit)) WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: itinerary_stops update: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: editors" ON public.itinerary_stops FOR UPDATE TO authenticated USING (( SELECT public.can_edit() AS can_edit)) WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: project_agencies update: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: editors" ON public.project_agencies FOR UPDATE TO authenticated USING (( SELECT public.can_edit() AS can_edit)) WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: project_contacts update: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: editors" ON public.project_contacts FOR UPDATE TO authenticated USING (( SELECT public.can_edit() AS can_edit)) WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- Name: project_instances update: editors; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "update: editors" ON public.project_instances FOR UPDATE TO authenticated USING (( SELECT public.can_edit() AS can_edit)) WITH CHECK (( SELECT public.can_edit() AS can_edit));


--
-- PostgreSQL database dump complete
--

\unrestrict wtDmFxxb1aIl6P1rCNuScS6SfAR5cK6B9D99NuJIqZAZbx3IwdOKXo15BO8btqQ


-- Table: public.uploads

-- DROP TABLE IF EXISTS public.uploads;

CREATE TABLE IF NOT EXISTS public.uploads
(
    content_cid character(46) COLLATE pg_catalog."default" NOT NULL,
    metadata_cid character(46) COLLATE pg_catalog."default" NOT NULL,
    extra_cids jsonb,
    uid integer NOT NULL DEFAULT nextval('uploads_pending_on_chain_uid_seq'::regclass),
    status text COLLATE pg_catalog."default" NOT NULL DEFAULT 'PENDING'::text,
    uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
    purged boolean DEFAULT false,
    CONSTRAINT uploads_pending_on_chain_pkey PRIMARY KEY (uid),
    CONSTRAINT status_check CHECK (status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'DISMISSED'::text]))
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.uploads
    OWNER to postgres;
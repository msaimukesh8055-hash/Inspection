-- supabase/migrations/20261024120000_schema.sql
-- All tables from docs/SPEC.md (Database and storage). Money is whole rupees (integer).
-- Allowed values use check constraints rather than enum types so they are easy to change in a later migration.

-- Demo fleet
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  reg_no text not null unique,
  colour text not null,
  created_at timestamptz not null default now()
);

-- Demo riders (fake data only)
create table public.riders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

-- One rental per pickup. The deposit must match DEPOSIT_INR in supabase/functions/_shared/constants.ts.
create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id),
  rider_id uuid not null references public.riders (id),
  deposit_inr integer not null default 2000 check (deposit_inr = 2000),
  status text not null default 'active' check (status in ('active', 'returned', 'closed')),
  picked_up_at timestamptz not null default now(),
  returned_at timestamptz,
  created_at timestamptz not null default now()
);
create index rentals_status_idx on public.rentals (status);

-- Eight photos per rental, stored at {rental_id}/{pickup|return}/{angle}.jpg in vehicle-photos
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  stage text not null check (stage in ('pickup', 'return')),
  angle text not null check (angle in ('front', 'rear', 'left', 'right')),
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (rental_id, stage, angle),
  check (storage_path = rental_id::text || '/' || stage || '/' || angle || '.jpg')
);

-- The only source of prices
create table public.parts_catalog (
  part_code text primary key,
  vehicle_model text not null,
  description text not null,
  parts_inr integer not null check (parts_inr >= 0),
  labour_inr integer not null check (labour_inr >= 0),
  created_at timestamptz not null default now()
);
create index parts_catalog_vehicle_model_idx on public.parts_catalog (vehicle_model);

-- One per return. path is null until the router has run.
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null unique references public.rentals (id) on delete cascade,
  path text check (path in ('A', 'B')),
  route_reasons text[] not null default '{}' check (
    route_reasons <@ array[
      'amount_over_threshold', 'low_confidence', 'poor_photos',
      'structural', 'staff_escalation', 'needs_human'
    ]::text[]
  ),
  total_inr integer not null default 0 check (total_inr >= 0),
  status text not null default 'returned' check (status in (
    'returned', 'assessing', 'billed', 'paid',
    'order_raised', 'at_refurb', 'inspected', 'counter_notified', 'settled'
  )),
  deducted_inr integer check (deducted_inr >= 0),
  refund_inr integer check (refund_inr >= 0),
  collect_extra_inr integer check (collect_extra_inr >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assessments_status_idx on public.assessments (status);

-- Damage agent output
create table public.damage_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  panel text not null,
  type text not null check (type in ('scratch', 'dent', 'crack', 'broken part')),
  severity smallint not null check (severity between 1 and 3),
  confidence numeric(3, 2) not null check (confidence between 0 and 1),
  photo_ref text not null,
  created_at timestamptz not null default now()
);
create index damage_items_assessment_idx on public.damage_items (assessment_id);

-- Estimate lines, then the inspector-confirmed amount in final_inr
create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  damage_item_id uuid references public.damage_items (id) on delete set null,
  source text not null check (source in ('ai', 'inspector_added')),
  part_code text not null references public.parts_catalog (part_code),
  parts_inr integer not null check (parts_inr >= 0),
  labour_inr integer not null check (labour_inr >= 0),
  total_inr integer not null check (total_inr >= 0),
  final_inr integer check (final_inr >= 0),
  created_at timestamptz not null default now(),
  check (source = 'ai' or damage_item_id is null)
);
create index line_items_assessment_idx on public.line_items (assessment_id);

-- Path B only; auto-filled when raised
create table public.diagnostic_orders (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references public.assessments (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'inspected', 'closed')),
  summary text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  route_reasons text[] not null default '{}',
  staff_note text,
  provisional_total_inr integer not null check (provisional_total_inr >= 0),
  held_inr integer not null check (held_inr >= 0),
  inspector_id text check (inspector_id in ('inspector')),
  inspector_notes text,
  final_total_inr integer check (final_total_inr >= 0),
  created_at timestamptz not null default now()
);
create index diagnostic_orders_status_created_idx on public.diagnostic_orders (status, created_at desc);

-- Timeline shown to the rider
create table public.status_events (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  status text not null check (status in (
    'returned', 'assessing', 'billed', 'paid',
    'order_raised', 'at_refurb', 'inspected', 'counter_notified', 'settled'
  )),
  at timestamptz not null default now()
);
create index status_events_assessment_idx on public.status_events (assessment_id, at);

-- Staff and inspector disagreements with the AI. actor is a demo role, not a user account.
create table public.overrides (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  actor text not null check (actor in ('counter', 'inspector')),
  from_path text not null check (from_path in ('A', 'B')),
  to_path text not null check (to_path in ('A', 'B')),
  reason text not null check (length(trim(reason)) > 0),
  at timestamptz not null default now()
);
create index overrides_assessment_idx on public.overrides (assessment_id);

-- Cost and latency per model call
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid references public.assessments (id) on delete set null,
  agent text not null check (agent in ('damage', 'estimate', 'order')),
  model text not null,
  tokens_in integer not null default 0 check (tokens_in >= 0),
  tokens_out integer not null default 0 check (tokens_out >= 0),
  latency_ms integer not null default 0 check (latency_ms >= 0),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now()
);
create index agent_runs_assessment_idx on public.agent_runs (assessment_id);

-- Editable routing values (threshold_inr, min_confidence)
create table public.config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- In-app notifications; the counter app listens with Realtime
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_role text not null check (recipient_role in ('counter', 'inspector')),
  assessment_id uuid references public.assessments (id) on delete cascade,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_role, created_at desc);

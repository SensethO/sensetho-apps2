# Signalement support Supabase — projet ketnixnfrbpdpduypfbv

> À envoyer via le dashboard Supabase → **Support** → *New ticket* (plan Pro = support prioritaire),
> ou https://supabase.com/dashboard/support/new — en anglais de préférence.

---

**Subject:** Project repeatedly unreachable (REST/Auth/DB) — persists after upgrading to Pro and restarting

**Project ref:** `ketnixnfrbpdpduypfbv`
**Organization:** `pwhonugmggorawsfssgq` (sensetho-apps2) — **Pro plan** (upgraded 30 July 2026)
**Region:** eu-west-2
**Postgres:** 17.6.1.121

---

## Summary

Our production project has been alternating between working and completely unreachable
for more than 12 hours. Upgrading to Pro and restarting the project did **not** durably
fix it. There is no incident reported on status.supabase.com and eu-west-2 shows as
operational, so this appears specific to our project.

## Symptoms

- `https://ketnixnfrbpdpduypfbv.supabase.co/rest/v1/...` → connection timeouts
  (curl exit 28 after 10-12 s), intermittently HTTP **521** / **522** from Cloudflare.
- `https://ketnixnfrbpdpduypfbv.supabase.co/auth/v1/token?grant_type=password` →
  `net::ERR_FAILED 522` from browsers, so **users cannot log in**.
- Browser requests show "blocked by CORS policy: No 'Access-Control-Allow-Origin'
  header" — a side effect of the request never completing, not a CORS misconfiguration.
- Management health endpoint
  `GET /v1/projects/{ref}/health?services=db,rest,auth,storage` returns:
  - `db: UNHEALTHY — Failed to connect to database`
  - `rest: UNHEALTHY — Failed to retrieve project's rest service health`
  - `auth: UNHEALTHY — Failed to retrieve project's auth service health`
  while the project status itself still reports `ACTIVE_HEALTHY`.

## Evidence that the database itself is idle and healthy when reachable

Measured during a window when the project responded:

| Metric | Value |
|---|---|
| Database size | 23 MB (well under any limit) |
| Connections | 16 of 60 |
| Cache hit ratio | 100 % (4 155 total disk reads) |
| Transaction rate | 0.1 transactions/second |
| Simple `select id from profiles limit 1` | up to **11.5 s**, often timing out |

So the slowness/unavailability is not caused by load on our side.

## Timeline (CEST, 30–31 July 2026)

- **~14:00** — first failures. `rest` reported UNHEALTHY while db/auth/storage were healthy.
- **~15:20** — restarted the project via the Management API. Services came back after
  ~3.5 min, then degraded again within minutes.
- **~16:00** — discovered our Free-plan egress quota was exceeded (5 955 MB / 5 GB, 119 %).
  We fixed the root cause in our application (client polling loops that ran even in
  background tabs) — outbound traffic is now reduced by ~97 %.
- **~21:30** — upgraded the organization to **Pro**. Restrictions did **not** lift
  automatically; a second restart was required, after which the project worked normally
  for a while (REST 8/8 at 60-100 ms).
- **31/07 ~06:50** — stable for a 3-minute check (10/10 requests OK).
- **31/07 ~07:30** — down again: REST and Auth time out, health endpoint reports
  db/rest/auth UNHEALTHY. Users cannot log in.

## Questions

1. Why does the project keep becoming unreachable even on the Pro plan, with an idle
   23 MB database?
2. Are Free-plan egress restrictions still being applied after the upgrade, and if so,
   how long until they are fully lifted?
3. Is there anything wrong with the underlying instance / can it be migrated to healthy
   infrastructure?

## Impact

Production application (https://apps.sensetho.com) is unusable during the outages:
users cannot authenticate, and no data can be read or written. The application also
holds **EUDR regulatory declarations** (EU Deforestation Regulation), which carry a
5-year retention obligation.

---

*Pièces utiles à joindre si demandé : sorties de l'endpoint `/health`, horodatages
ci-dessus, captures de la console navigateur montrant `net::ERR_FAILED 522` sur
`auth/v1/token`.*

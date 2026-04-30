# Telemetry and SOC Model

CyberCard turns physical interactions into observable events without treating the tag as a secret.

## Tables

| Table | Purpose |
|---|---|
| `cards` | identity configuration for each physical/digital card |
| `tap_events` | every tap, scan, AR trigger, safe demo launch |
| `contacts` | pseudonymous repeat-contact state |
| `card_assets` | signed file delivery control |
| `orgs` | SaaS tenant and billing root |
| `audit_events` | admin, challenge, gov gate, export actions |
| `challenges` | DEFCON puzzle state |
| `challenge_attempts` | challenge solver telemetry |
| `risk_events` | consent-based `/risk` page telemetry for awareness training |

## SOC Queries

```sql
-- possible replay or demo loop
select fingerprint_hash, count(*) as taps
from tap_events
where tapped_at > now() - interval '1 hour'
group by fingerprint_hash
having count(*) > 10;
```

```sql
-- challenge brute pressure
select challenge_id, count(*) as attempts
from challenge_attempts
where attempted_at > now() - interval '15 minutes'
group by challenge_id
having count(*) > 25;
```

```sql
-- first-touch conversion by source
select utm_source, count(*) filter (where is_first_tap) as first_taps, count(*) as total
from tap_events
group by utm_source
order by total desc;
```

```sql
-- risk awareness event volume
select scenario, count(*) as events
from risk_events
where created_at > now() - interval '24 hours'
group by scenario
order by events desc;
```

## Detection Matrix

| Detection | Threshold | Action |
|---|---:|---|
| repeat tap burst | >10/hour/hash | mark warm or suppress emails |
| challenge brute | >25/15 min/challenge | slow response, notify admin |
| gov gate failure | >3/hour/hash | alert and require cooldown |
| unknown card_id | >20/hour/IP bucket | rate-limit at edge |
| asset download repeated | >3/card/day | revoke one-time link |
| risk demo burst | >50/day/scenario | review campaign source |

## Break-Glass Admin Model

```text
signed_admin_request -> verify role -> create audit_events row -> issue short token -> notify owner -> auto-expire
```

This is the safe blue-team replacement for a backdoor. It is visible, logged, revocable, and short-lived.

# Break-Glass Admin Controls

This is the safe substitute for any concept of a backdoor.

## Model

```mermaid
sequenceDiagram
  participant Admin
  participant API
  participant DB
  participant Owner

  Admin->>API: signed break-glass request
  API->>API: verify role + scope + expiry
  API->>DB: insert audit_events row
  API->>Owner: send notification
  API-->>Admin: short-lived token
  Admin->>API: perform scoped action
  API->>DB: append audit_events result
```

## Rules

- visible
- logged
- scoped
- revocable
- time-limited
- owner-notified

## Example Use Cases

| Use case | Scope |
|---|---|
| revoke lost card | update one `cards.active` flag |
| rotate challenge | update one challenge row |
| export audit | time-bounded CSV export |
| pause email automation | disable one workflow |

No remote shell, no exploit runner, no silent persistence.

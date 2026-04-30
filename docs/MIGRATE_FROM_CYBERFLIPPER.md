# Migrating CyberCard out of CyberFlipper

This file is the operator runbook for splitting `CYBERCARD/` out of the parent
CyberFlipper repository into its own first-class repository at
<https://github.com/Personfu/CYBERCARD>, while preserving git history and
publishing a public landing page at <https://personfu.github.io/CYBERCARD>.

> Run from the **CyberFlipper repo root**, not from inside `CYBERCARD/`.

---

## 1. Extract the subtree with full history

The cleanest way that preserves authorship and dates is `git subtree split`
followed by a push to the new repo.

```bash
# 1a. From the CyberFlipper repo root, make sure your tree is clean.
git status

# 1b. Create a new branch that contains ONLY the CYBERCARD/ subtree,
#     rewriting paths so files appear at the repo root.
git subtree split --prefix=CYBERCARD -b cybercard-extract

# 1c. Push that branch to the new GitHub repo as `main`.
git remote add cybercard git@github.com:Personfu/CYBERCARD.git
git push cybercard cybercard-extract:main

# 1d. (Optional) verify, then delete the local extract branch.
git branch -D cybercard-extract
```

If the new repo already has commits, force-push with explicit consent only:

```bash
git push --force-with-lease cybercard cybercard-extract:main
```

## 2. Remove CyberCard from the CyberFlipper monorepo

Once the new repo is verified working:

```bash
git rm -r CYBERCARD
git commit -m "chore: extract CyberCard into its own repository

CyberCard is now maintained at https://github.com/Personfu/CYBERCARD."
git push origin main
```

Add a stub README pointer in the old location if you want inbound discovery:

```bash
mkdir CYBERCARD && cat > CYBERCARD/README.md <<'EOF'
# Moved

CyberCard now lives at https://github.com/Personfu/CYBERCARD.
EOF
git add CYBERCARD/README.md && git commit -m "docs: pointer to extracted CyberCard repo"
```

## 3. Configure the new repo

In <https://github.com/Personfu/CYBERCARD/settings>:

1. **General → Default branch**: `main`.
2. **Pages → Source**: select **GitHub Actions** (not "Deploy from branch").
   The included workflow `.github/workflows/deploy-pages.yml` will publish
   `public-site/` on every push to `main` that touches it.
3. **Pages → Custom domain** (optional): map to `cybercard.fllc.net` or any
   subdomain you control; add a `CNAME` file under `public-site/` if you do.
4. **Actions → General → Workflow permissions**: allow read + write so the
   Pages deploy can run.
5. **Secrets and variables → Actions**: nothing required for Pages. Vercel
   secrets stay in Vercel for the live backend.

## 4. Where the live backend runs

GitHub Pages cannot run Next.js API routes. The split is intentional:

| Surface                     | Hosted on        | What lives there                                          |
| --------------------------- | ---------------- | --------------------------------------------------------- |
| `personfu.github.io/CYBERCARD` | GitHub Pages   | Static landing page (`public-site/index.html`), seal gallery, links |
| `fllc.net`                  | Vercel + Supabase | Full Next.js app: `/tap`, `/risk`, `/dashboard`, `/api/*` |

The static landing page links every CTA to `https://fllc.net/...` so users
hitting the GitHub Pages URL still flow into the live backend.

## 5. Vercel deployment for the live backend

```bash
npm i -g vercel
vercel link            # link to the new GitHub repo
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add RESEND_API_KEY production
vercel env add GOV_JWT_SECRET production
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
vercel env add DEVICE_TELEMETRY_TOKEN production
vercel env add NEXT_PUBLIC_SITE_URL production    # https://fllc.net
vercel --prod
```

Add `fllc.net` as a custom domain inside Vercel and set the DNS at the
registrar to Vercel's CNAME / A records.

## 6. Apply Supabase migrations

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push           # applies supabase/00{1,2,3,4}_*.sql
```

## 7. Smoke tests after migration

| Check                                | URL / Command                                                    | Pass criteria                       |
| ------------------------------------ | ---------------------------------------------------------------- | ----------------------------------- |
| Static Pages site loads              | `https://personfu.github.io/CYBERCARD/`                          | Splash + 48 seals render            |
| Loader gallery renders               | `https://fllc.net/loader`                                        | All 50+ seals visible by category   |
| Splash gate triggers once per tab    | `https://fllc.net/?nosplash=0`                                   | Splash plays on first visit only    |
| Tap event lands in Supabase          | `https://fllc.net/tap?card_id=metal_v1`                          | Row in `tap_events`                 |
| Risk consent flow                    | `https://fllc.net/risk`                                          | Explicit consent before any record  |
| Challenge flow                       | `https://fllc.net/challenge/<sha256>`                            | JWT minted on correct answer        |
| ESP32 telemetry                      | `POST /api/device/telemetry` with `x-cybercard-device` header    | 200 OK, row in `device_telemetry`   |
| Stripe webhook                       | Stripe CLI: `stripe trigger checkout.session.completed`          | Audit row written                   |

## 8. Decommissioning checklist

- [ ] Subtree split pushed to new repo with full history
- [ ] CyberFlipper monorepo no longer contains `CYBERCARD/`
- [ ] GitHub Pages enabled with workflow source
- [ ] First deploy to `personfu.github.io/CYBERCARD` succeeded
- [ ] Vercel project pointed at the new repo
- [ ] Supabase migrations applied to production project
- [ ] DNS for `fllc.net` resolves to Vercel
- [ ] First real `/tap` event captured end-to-end
- [ ] Old links from CyberFlipper docs updated to the new repo URL

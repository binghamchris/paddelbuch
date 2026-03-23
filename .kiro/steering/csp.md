---
inclusion: auto
description: Strict Content Security Policy constraints from deployment environment. Use when implementing frontend script, style, and vendor assets.
---

# Content Security Policy Constraints

The site enforces a strict CSP via `deploy/frontend-deploy.yaml`. All frontend code must comply.

## Rules

- No inline `<script>` blocks or inline `style=""` attributes — `script-src` and `style-src` are `'self'` only
- No `eval()`, `new Function()`, or dynamic code execution — `'unsafe-eval'` is not allowed
- All vendor assets (JS, CSS, fonts) must be self-hosted — no CDN references at runtime
- JSON data is passed to JS via `<script type="application/json">` blocks, never inline JS
- External domains are restricted to: `raw.githubusercontent.com`, `api.mapbox.com` (images), `tiles.openfreemap.org` (connect)
- Adding a new external service requires updating the CSP in the CloudFormation template

See `docs/frontend.md` § Content Security Policy for full details.

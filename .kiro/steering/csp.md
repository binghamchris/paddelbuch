---
inclusion: auto
description: Strict Content Security Policy constraints from deployment environment. Use when implementing frontend script, style, and vendor assets.
---

# Content Security Policy Constraints

The site enforces a strict CSP via `deploy/frontend-deploy.yaml`. All frontend code must comply.

## Deployed Policy

The exact policy from `deploy/frontend-deploy.yaml` is:

```
default-src 'self';
img-src 'self' data: raw.githubusercontent.com api.mapbox.com;
style-src 'self';
script-src 'self' https://tinylytics.app;
font-src 'self' data:;
connect-src 'self' tiles.openfreemap.org https://tinylytics.app;
worker-src 'self' blob:
```

## Rules

- No inline `<script>` blocks or inline `style=""` attributes — neither `script-src` nor `style-src` includes `'unsafe-inline'`
- `style-src` is `'self'` only; `script-src` is `'self'` plus the `https://tinylytics.app` analytics host (the one permitted runtime external script origin)
- No `eval()`, `new Function()`, or dynamic code execution — `'unsafe-eval'` is not allowed
- All vendor assets (JS, CSS, fonts) must be self-hosted — no CDN references at runtime (the `tinylytics.app` analytics beacon is the sole sanctioned external script/connect host)
- JSON data is passed to JS via `<script type="application/json">` blocks, never inline JS
- External hosts permitted by the policy: `raw.githubusercontent.com` + `api.mapbox.com` (images), `tiles.openfreemap.org` (connect), `https://tinylytics.app` (script + connect)
- Adding a new external service requires updating the CSP in the CloudFormation template

See `docs/frontend.md` § Content Security Policy for full details.

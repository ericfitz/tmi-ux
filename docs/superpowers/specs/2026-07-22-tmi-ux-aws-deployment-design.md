# tmi-ux AWS deployment — design

**Date:** 2026-07-22
**Status:** Approved (design); not yet implemented

## Goal

Serve the tmi-ux Angular SPA from AWS at **`https://app.aws.tmi.dev`**, with TLS from ACM,
against the existing TMI server at `https://server.aws.tmi.dev`.

## Existing environment (verified 2026-07-22)

AWS account `967218005408`, region `us-east-1`, accessed via the named profile **`tmi`**.

| Thing            | State                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| TMI server       | EKS cluster `tmi-eks`, namespace `tmi-platform`, behind an ALB created by the AWS Load Balancer Controller          |
| DNS              | Route 53 hosted zone `aws.tmi.dev` = `Z05646533D2YL1I678JXS`; `server.aws.tmi.dev` CNAMEs to that ALB               |
| TLS              | ACM cert for `server.aws.tmi.dev` (us-east-1, ISSUED)                                                               |
| IaC              | `tmi/terraform/environments/aws-public`, state in `s3://tmi-tfstate-967218005408`, locks in DynamoDB `tmi-tf-locks` |
| CloudFront / ECS | None                                                                                                                |

`scripts/push-ecr.sh` in this repo references account `706702818127` — a **different** account.
It is stale with respect to this deployment and is not used here.

## Architecture

```
                    Route 53 (aws.tmi.dev)
                      app.aws.tmi.dev  A/AAAA alias
                              │
                     CloudFront distribution
                     ├── ACM cert (us-east-1)
                     ├── Response-headers policy
                     ├── Standard access logs ──▶ log bucket (30d)
                     └── Origin: S3 via OAC (bucket private)
                              │
                       S3 bucket (SPA build)

  Browser ──XHR/WSS──▶ https://server.aws.tmi.dev   (existing EKS ALB, unchanged)
```

Pure static hosting. `server.js` is **not** used in this deployment; it exists only for the
container/Heroku targets. The browser calls the API cross-origin, exactly as it does under
`ng serve` today. The server stack is untouched apart from one config value (see
"Server-side prerequisite").

### Runtime config

`src/main.ts` fetches `/config.json` before bootstrap whenever `environment.production` is
true. On S3 a missing `/config.json` would be rewritten to `index.html` by the SPA fallback,
return 200, and fail JSON parsing — a caught-but-noisy warning on every page load.

So the deploy publishes a real `config.json` containing `{}`. Deployment values live in
`environment.aws.ts`; the empty `config.json` is the escape hatch for changing `apiUrl` or
operator strings later without a rebuild.

## Terraform

New `terraform/aws/` in this repo. State key `tmi-ux/aws-public/terraform.tfstate` in the
existing `tmi-tfstate-967218005408` bucket, locks via the existing `tmi-tf-locks` table —
same `backend.hcl` shape as tmi's, supplied with `terraform init -backend-config=`.

Separate state from the tmi repo, so UI infrastructure can be planned, applied, and destroyed
without touching the server's state.

### Resources

| Resource                                 | Configuration                                                                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws_s3_bucket` (content)                | Private. Public access block on all four settings, versioning enabled, SSE-S3 (AES256) default encryption, object ownership `BucketOwnerEnforced`. No S3 website hosting.                                             |
| `aws_s3_bucket` (logs)                   | Ownership `BucketOwnerPreferred` with ACLs enabled — required by CloudFront standard logging. Lifecycle rule expires objects at **30 days**.                                                                          |
| `aws_cloudfront_origin_access_control`   | SigV4, always sign. Bucket policy grants `cloudfront.amazonaws.com` read, scoped to the distribution ARN.                                                                                                             |
| `aws_acm_certificate` + validation       | `app.aws.tmi.dev`, DNS validation via Route 53 records, us-east-1, `create_before_destroy`.                                                                                                                           |
| `aws_cloudfront_distribution`            | Alias `app.aws.tmi.dev`; `default_root_object = index.html`; viewer protocol redirect-to-https; TLSv1.2_2021 + SNI; compression on; HTTP/2 + HTTP/3; IPv6 on; **PriceClass_100**; standard logging to the log bucket. |
| Cache behaviors                          | Default → AWS managed `CachingOptimized`. Ordered behaviors for `/index.html` and `/config.json` → managed `CachingDisabled`.                                                                                         |
| `custom_error_response`                  | 403 → `/index.html` (200) and 404 → `/index.html` (200), for SPA deep links.                                                                                                                                          |
| `aws_cloudfront_response_headers_policy` | See "Security headers".                                                                                                                                                                                               |
| `aws_route53_record`                     | A + AAAA alias records into `Z05646533D2YL1I678JXS`.                                                                                                                                                                  |

### Known trade-off: the SPA fallback masks errors

Mapping 403 → 200 means a genuinely broken OAC/bucket-policy configuration renders the app
shell instead of failing loudly. This is the standard trade for SPA routing on S3 + OAC and is
accepted here, but it is a real debuggability cost: when diagnosing a blank app, check the
S3 origin directly before trusting the CloudFront response.

### Known trade-off: log bucket ownership

CloudFront standard (legacy) logging delivers via S3 ACLs, which is incompatible with
`BucketOwnerEnforced`. The log bucket therefore enables ACLs. This is the one place the design
relaxes a security default, and it applies only to the log bucket — the content bucket keeps
`BucketOwnerEnforced`.

## Security headers

CloudFront sends, via the response-headers policy:

- `Strict-Transport-Security` (max-age 31536000, includeSubDomains, no preload)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy: frame-ancestors 'none'` — **and nothing else**

### Why the edge CSP is frame-ancestors only

The app already ships a complete CSP. `SecurityConfigService`, constructed unconditionally at
startup, builds a policy and injects it as a `<meta http-equiv="Content-Security-Policy">` tag
(this is what the `<!-- CSP will be dynamically injected by the application -->` comment in
`src/index.html` refers to). It sets `default-src`, `script-src`, `style-src`, `font-src`,
`img-src`, `connect-src`, `base-uri`, `form-action`, `object-src`, `media-src`, `worker-src`,
`manifest-src`, `frame-src`, and `upgrade-insecure-requests`.

Critically, it is built **at runtime** from `environment.apiUrl` and the `CONTENT_PROVIDERS`
registry:

```
frameSrc:   https://docs.google.com, https://accounts.google.com,
            https://*.sharepoint.com, https://login.microsoftonline.com
scriptSrc:  https://apis.google.com, https://accounts.google.com/gsi/client
formAction: https://*.sharepoint.com
```

When a document carries two CSPs the browser enforces **both independently** — the effective
policy is their intersection, and neither can loosen the other. A CloudFront CSP would have to
be an exact superset of the above or it would silently break the Google Drive and OneDrive
pickers. It cannot be reliably replicated in Terraform: the list contains a wildcard
(`https://*.sharepoint.com`), and the Microsoft picker's real `picker_origin` is supplied to
the client at runtime by the server (`microsoft-file-picker.service.ts:155`).

The service's own comments identify what a meta tag cannot express: `frame-ancestors`,
`report-uri`, and `sandbox`. `frame-ancestors` is consequently **not enforced anywhere today**.
CloudFront supplies exactly that, closing a real gap with no risk of intersect-blocking the app.

`environment.aws.ts` must carry `securityConfig` values matching what CloudFront actually
sends, so the app's self-reported security posture stays honest.

### Accepted limitation

The meta-tag CSP is injected during Angular bootstrap, so it does not cover the initial
document parse — the Font Awesome (`cdnjs.cloudflare.com`) and Google Fonts stylesheet links in
`index.html` load before any CSP exists. Closing that means baking a static CSP into
`index.html` at build time, which reintroduces the same enumeration problem. Logged as a
follow-up, out of scope here.

## Build and deploy

### Build

- New `src/environments/environment.aws.ts`, mirroring `environment.hosted-container.ts` with
  `apiUrl: 'https://server.aws.tmi.dev'` and the `securityConfig` values above.
- New `aws` configuration in `angular.json` with the matching `fileReplacements`, modelled on
  the existing `hosted-container` configuration.
- New `build:aws` script in `package.json`. Output path is unchanged: `dist/tmi-ux/browser`.

### `scripts/deploy-aws.sh`

Reads the bucket name and distribution ID from `terraform output`, then:

1. `aws s3 sync … --delete --cache-control "public,max-age=3600"` — everything
2. Re-upload `*.js`, `*.css`, `media/*` with `public,max-age=31536000,immutable`
3. Upload `index.html` and `config.json` with `no-store`
4. `aws cloudfront create-invalidation --paths '/*'`

Runs manually with `AWS_PROFILE=tmi`. No CI deploy, no GitHub OIDC role. If CI is wanted later,
this script becomes the CI step without rework.

### Why three passes

`outputHashing: "all"` hashes only build-emitted files. Everything in `public/`
(`favicon.ico`, `TMI-Logo.svg`, `site.webmanifest`, `robots.txt`, …) and `src/assets/i18n/*.json`
ships under stable names. Marking the whole bucket `immutable` for a year would strand a
year-old logo or translation file in every visitor's cache. Hashed output gets `immutable`;
stable names get a one-hour default.

The `/*` invalidation exists for those stable-named assets. Hashed files never need it, and
`index.html` / `config.json` sit on `CachingDisabled` behaviors. One `/*` path counts as a
single invalidation against the 1,000/month free tier.

## Server-side prerequisite

One change is required on the TMI server before login works from the new origin. Handed to
server ops as `deliverables/tmi-server-config-note.md`.

**Required** — add to the `tmi-server-config` ConfigMap (namespace `tmi-platform`):

```
TMI_OAUTH_CLIENT_CALLBACK_ALLOWLIST = "https://app.aws.tmi.dev/*"
```

The UI passes a `client_callback` to `/oauth2/authorize`, and
`auth/client_callback_allowlist.go` is fail-closed: an empty allowlist rejects every callback.
The variable is currently unset on the running ConfigMap. A wildcard is needed because the UI
uses three callbacks and one carries a dynamic query string:

- `https://app.aws.tmi.dev/oauth2/callback`
- `https://app.aws.tmi.dev/oauth2/link/callback`
- `https://app.aws.tmi.dev/oauth2/content-callback?return_to=<...>`

Matching is a plain string prefix. Because the prefix includes the trailing `/` after the host
it can only match our own origin — `https://app.aws.tmi.dev.evil.com/` does not match.

**Recommended, not blocking** — `TMI_CORS_ALLOWED_ORIGINS = "https://app.aws.tmi.dev"`. A
preflight from the new origin already succeeds today, because with the variable unset the
server reflects any `Origin` back in `access-control-allow-origin` alongside
`access-control-allow-credentials: true`. Setting it explicitly closes that down; it must
include every other origin already in use, since setting it switches the server from
reflect-all to allowlist-only.

The ConfigMap is Terraform-owned (`kubernetes_config_map_v1.tmi` in
`tmi/terraform/modules/kubernetes/aws/k8s_resources.tf`), so a `kubectl edit` would be reverted.
The Deployment consumes it via `envFrom`, which requires
`kubectl -n tmi-platform rollout restart deployment/tmi-server`.

### Confidence note

The three callback URLs above were read from `auth.service.ts`, `identity-link.service.ts`, and
`content-token.service.ts` (`${window.location.origin}` + path); the flow was not exercised
end-to-end. That the allowlist rejects the new origin today is inferred from the unset variable
plus the fail-closed code path — direct probes were rejected by OpenAPI request validation
before reaching the allowlist handler. Verify during implementation.

## Verification

1. `terraform plan` reviewed before apply; ACM validation reaches ISSUED.
2. `curl -I https://app.aws.tmi.dev` — 200, expected security headers, valid cert chain.
3. Deep link (e.g. `https://app.aws.tmi.dev/intake`) returns the app, not an error.
4. Browser console clean on load — specifically no `config.json` parse warning and no CSP
   violations.
5. `Cache-Control` correct per class: `immutable` on a hashed `*.js`, `no-store` on
   `index.html`, one hour on `/favicon.ico`.
6. OAuth login end-to-end **after** server ops applies the allowlist change.
7. Google Drive and OneDrive pickers both open — the specific thing an over-broad edge CSP
   would have broken.
8. Access logs appear in the log bucket.

## Cost

ACM is free; the Route 53 zone already exists. S3 storage and requests are negligible at this
scale. CloudFront on PriceClass_100 at low traffic plus log storage lands in the low single
digits of dollars per month — roughly **$2–5/month**, against the existing stack's ~$140/month.

## Out of scope

- Any change to the EKS/server deployment beyond the ConfigMap value above
- CI/CD deploy automation and GitHub OIDC
- WAF
- Retiring the stale `scripts/push-ecr.sh`
- Baking a build-time CSP into `index.html` to cover the pre-bootstrap window

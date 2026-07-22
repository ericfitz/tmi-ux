# AWS deployment (app.aws.tmi.dev)

The tmi-ux SPA is served from S3 + CloudFront in AWS account `967218005408`
(`us-east-1`), against the TMI server at `https://server.aws.tmi.dev`.

All commands use the `tmi` AWS profile.

## Layout

- `terraform/aws/` — S3 buckets, CloudFront, ACM, Route 53
- `scripts/deploy-aws.sh` — build, sync, invalidate
- `src/environments/environment.aws.ts` — compiled-in config

## Deploy

```bash
pnpm run deploy:aws                 # build + deploy
pnpm run deploy:aws -- --no-build   # deploy the existing dist/
```

## Change infrastructure

`backend.hcl` is **not** in version control (matching the tmi repo's
`**/backend.hcl` rule). Recreate `terraform/aws/backend.hcl` on a fresh clone:

```hcl
bucket         = "tmi-tfstate-967218005408"
region         = "us-east-1"
dynamodb_table = "tmi-tf-locks"
```

Then:

```bash
cd terraform/aws
AWS_PROFILE=tmi terraform init -backend-config=backend.hcl   # first time only
AWS_PROFILE=tmi terraform plan
AWS_PROFILE=tmi terraform apply
```

State lives at `tmi-ux/aws-public/terraform.tfstate` in
`s3://tmi-tfstate-967218005408` — separate from the tmi server repo's state
(`tmi/aws-public/…`), so this stack is applied independently of the server's.
If a plan ever shows resources to **change or destroy** that you did not edit,
stop: it means the backend key is resolving to the server's state.

### Destroying the stack

`terraform destroy` does **not** work on its own. The content bucket has no
`force_destroy` and is versioned, so destroy fails with `BucketNotEmpty`. That
is deliberate: versioning exists so a bad deploy can be rolled back, and an
accidental destroy should not silently discard it. Empty it first — including
noncurrent versions and delete markers:

```bash
BUCKET="$(cd terraform/aws && AWS_PROFILE=tmi terraform output -raw content_bucket)"
AWS_PROFILE=tmi aws s3api delete-objects --bucket "$BUCKET" \
  --delete "$(AWS_PROFILE=tmi aws s3api list-object-versions --bucket "$BUCKET" \
    --output json --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}')"
AWS_PROFILE=tmi aws s3api delete-objects --bucket "$BUCKET" \
  --delete "$(AWS_PROFILE=tmi aws s3api list-object-versions --bucket "$BUCKET" \
    --output json --query '{Objects: DeleteMarkers[].{Key:Key,VersionId:VersionId}}')"
cd terraform/aws && AWS_PROFILE=tmi terraform destroy
```

(Repeat the two `delete-objects` calls if the bucket holds more than 1000
versions; `list-object-versions` pages at 1000.) The log bucket sets
`force_destroy = true` — access logs are disposable — so it needs no such step.

Unbounded growth is bounded by lifecycle rules on the content bucket:
noncurrent versions expire after 30 days and incomplete multipart uploads are
aborted after 7.

`terraform init` warns that the backend's `dynamodb_table` argument is
deprecated in favour of S3 native locking (`use_lockfile = true`). The argument
still works; migrating is a deliberate decision to make alongside the tmi repo,
not unilaterally here.

## Caching model

`outputHashing: "all"` hashes only build-emitted files. `public/` and
`src/assets/` ship under stable names, so the deploy script uploads in classes:
stable names get one hour, hashed output gets a year `immutable`, and
`index.html` / `config.json` get `no-store`. The `/*` invalidation exists for
the stable-named assets.

The pass **order** is load-bearing and must not be collapsed into a single
`sync --delete`: new hashed bundles are uploaded first with no deletion, then
`index.html` cuts over to them, and only then does a final pass prune keys the
build no longer produces. Deleting first would leave the origin serving an
`index.html` whose bundles are gone; CloudFront rewrites those 403s to
`/index.html` with a 200, so the browser gets HTML where JavaScript is expected
and fails with `Uncaught SyntaxError: Unexpected token '<'`.

After invalidating, the script waits for the invalidation to complete and then
asserts that `/` and one hashed bundle referenced by the new `index.html` both
return 200 with the expected content type, so a broken deploy cannot exit 0.

`config.json` is **rewritten to `{}` and re-uploaded on every deploy**. It
exists only so the pre-bootstrap fetch in `src/main.ts` gets valid JSON instead
of the SPA fallback's HTML. It is not a durable override hook — anything
hand-edited into it in S3 is lost on the next deploy. Configure this deployment
in `src/environments/environment.aws.ts` instead.

`deploy-aws.sh` refuses to upload a `dist/` that does not reference
`server.aws.tmi.dev`. Every build configuration emits to the same
`dist/tmi-ux/browser`, so without that check `--no-build` would happily publish
a `build:prod` or `build:test` output pointed at the wrong API.

Verified behaviour of the bare domain `/`: it returns `cache-control: no-store`
and CloudFront does not cache it at the edge (repeated requests report
`x-cache: Miss from cloudfront`). This was checked explicitly because a request
for `/` does not obviously match the ordered `/index.html` cache behaviour —
the origin object's own `no-store` header governs, and `Managed-CachingOptimized`
honours it.

## Security headers

CloudFront sends HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy`, and a CSP of **`frame-ancestors 'none'` only**.

The app injects its own complete CSP at runtime (`SecurityConfigService`),
built from `environment.apiUrl` and the `CONTENT_PROVIDERS` registry. Two CSPs
on one document are enforced as an intersection, so **do not add fetch
directives to the CloudFront policy** — a directive narrower than the app's
silently breaks the Google Drive and OneDrive pickers. `frame-ancestors` is the
exception: meta-tag CSPs ignore it, so the edge is the only place it can be set.

`environment.aws.ts`'s `securityConfig` block is a hand-maintained copy of
these headers. Nothing enforces it: it feeds only
`generateRecommendedHeaders()` in
`src/app/core/services/security-config.service.ts`, which publishes an advisory
observable. Drift is a reporting inaccuracy, not a security regression.

`environment.aws.spec.ts` compares that block against a literal in the same
repo, so it catches edits to `environment.aws.ts` but is blind to edits of
`cloudfront.tf` — which is the direction that actually changes what browsers
receive. Treat it as a change-detector on the copy, not as verification of the
edge. If you change either file, change both by hand.

Known gap: the meta tag is injected during Angular bootstrap, so it does not
cover the initial document parse (the Font Awesome and Google Fonts links in
`index.html`). Closing that means baking a static CSP into `index.html` at
build time.

## Server dependency

The server must allowlist this origin's OAuth callbacks, via
`TMI_OAUTH_CLIENT_CALLBACK_ALLOWLIST=https://app.aws.tmi.dev/*` in the
`tmi-server-config` ConfigMap (namespace `tmi-platform`). The allowlist is
fail-closed: unset means every callback is rejected and login fails. The
ConfigMap is Terraform-owned in the tmi repo and consumed via `envFrom`, so it
needs `kubectl -n tmi-platform rollout restart deployment/tmi-server`.

Optional hardening: `TMI_CORS_ALLOWED_ORIGINS` is unset, so the server reflects
any `Origin` back with `access-control-allow-credentials: true`. Setting it
switches the server from reflect-all to allowlist-only, so it must list every
origin in use, not just this one.

## Troubleshooting

**Blank app, HTTP 200.** The distribution maps origin 403/404 to `/index.html`
with a 200 for SPA routing, which also masks a broken origin. Check the S3
origin directly before trusting the CloudFront response:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  https://tmi-ux-app-967218005408.s3.amazonaws.com/index.html
```

`403` is correct and expected — the bucket is private and only the distribution
can read it. A `200` would mean the bucket has gone public.

**Stale assets after deploy.** Confirm the invalidation completed:

```bash
AWS_PROFILE=tmi aws cloudfront get-invalidation \
  --distribution-id "$(cd terraform/aws && AWS_PROFILE=tmi terraform output -raw distribution_id)" \
  --id <invalidation-id>
```

**Login fails / callback rejected.** See "Server dependency" above.

## Cost

ACM is free and the Route 53 zone already existed. At this traffic level the
distribution, bucket and logs run in the low single digits of dollars per month.
`PriceClass_100` restricts edges to North America and Europe; viewers elsewhere
still work, with higher latency.

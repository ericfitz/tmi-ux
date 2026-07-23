# tmi-ux AWS Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the tmi-ux Angular SPA from S3 + CloudFront at `https://app.aws.tmi.dev` with ACM TLS, against the existing TMI server at `https://server.aws.tmi.dev`.

**Architecture:** Pure static hosting. A new `aws` Angular build configuration bakes the API URL into the bundle; Terraform in this repo (separate state from the tmi server repo) provisions a private S3 bucket fronted by CloudFront with Origin Access Control, an ACM certificate, and Route 53 alias records. A manual shell script builds, syncs to S3 in three cache-control passes, and invalidates. `server.js` is not used.

**Tech Stack:** Angular 22 / pnpm / Vitest, Terraform 1.15 + AWS provider 5.x, AWS S3 + CloudFront + ACM + Route 53.

**Spec:** `docs/superpowers/specs/2026-07-22-tmi-ux-aws-deployment-design.md`

## Global Constraints

Every task's requirements implicitly include this section. Values are exact — do not paraphrase.

- AWS profile: **`tmi`**. Every `aws` and `terraform` command runs with `AWS_PROFILE=tmi`.
- AWS account: **`967218005408`**. Region: **`us-east-1`** (required — CloudFront viewer certificates must live in us-east-1).
- Hostname: **`app.aws.tmi.dev`**. API origin: **`https://server.aws.tmi.dev`**.
- Route 53 hosted zone ID: **`Z05646533D2YL1I678JXS`** (`aws.tmi.dev`).
- Terraform state: bucket **`tmi-tfstate-967218005408`**, key **`tmi/aws-public/terraform.tfstate`** is the _server's_ — ours is **`tmi-ux/aws-public/terraform.tfstate`**. Lock table **`tmi-tf-locks`**.
- S3 buckets: content **`tmi-ux-app-967218005408`**, logs **`tmi-ux-logs-967218005408`**.
- CloudFront price class: **`PriceClass_100`**. Access logging: **on**, retention **30 days**.
- Edge CSP is **`frame-ancestors 'none'` and nothing else** — see the spec's "Why the edge CSP is frame-ancestors only". Do not add fetch directives at the edge under any circumstances; the app injects its own CSP at runtime and two CSPs intersect.
- Conventional Commits. Run `pnpm run lint:all` before any commit touching `src/`, `angular.json`, or `package.json`.
- Work on a branch, not `main`.

## File Structure

| File                                       | Responsibility                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `src/environments/environment.aws.ts`      | Compiled-in config for the AWS deployment                                       |
| `src/environments/environment.aws.spec.ts` | Guards the environment/infrastructure contract against drift                    |
| `angular.json`                             | Adds the `aws` build configuration (`fileReplacements`)                         |
| `package.json`                             | Adds the `build:aws` script                                                     |
| `terraform/aws/versions.tf`                | Terraform + provider version constraints, S3 backend block                      |
| `terraform/aws/backend.hcl`                | Backend bucket/region/lock table (committed, matches tmi's pattern)             |
| `terraform/aws/variables.tf`               | Inputs with defaults for every Global Constraint value                          |
| `terraform/aws/buckets.tf`                 | Content bucket and log bucket, with their hardening resources                   |
| `terraform/aws/certificate.tf`             | ACM certificate + Route 53 DNS validation                                       |
| `terraform/aws/cloudfront.tf`              | OAC, cache/response-header policies, distribution, content bucket policy        |
| `terraform/aws/dns.tf`                     | A + AAAA alias records for `app.aws.tmi.dev`                                    |
| `terraform/aws/outputs.tf`                 | `content_bucket`, `distribution_id`, `site_url` — consumed by the deploy script |
| `terraform/aws/.gitignore`                 | Excludes `.terraform/`, `*.tfstate*`, `*.tfvars`                                |
| `scripts/deploy-aws.sh`                    | Build + three-pass sync + invalidation                                          |
| `docs/reference/aws-deployment.md`         | Runbook                                                                         |

Terraform files split by responsibility rather than dumped in one `main.tf`, matching the file-per-concern layout the tmi repo uses in `terraform/modules/kubernetes/aws/`.

---

### Task 1: Angular `aws` build configuration

**Files:**

- Create: `src/environments/environment.aws.ts`
- Create: `src/environments/environment.aws.spec.ts`
- Modify: `angular.json` (add `aws` to `projects.tmi-ux.architect.build.configurations`)
- Modify: `package.json` (add `build:aws` to `scripts`)

**Interfaces:**

- Consumes: `Environment` from `src/environments/environment.interface.ts`.
- Produces: build output at `dist/tmi-ux/browser` via `pnpm run build:aws`. Task 6's deploy script depends on that exact path and script name.

- [ ] **Step 1: Write the failing test**

Create `src/environments/environment.aws.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { environment } from './environment.aws';

describe('AWS deployment environment', () => {
  it('is a production build so runtime config and CSP injection are active', () => {
    expect(environment.production).toBe(true);
  });

  it('points at the deployed TMI server', () => {
    expect(environment.apiUrl).toBe('https://server.aws.tmi.dev');
  });

  it('has no trailing slash on apiUrl', () => {
    // SecurityConfigService derives the CSP connect-src origin from this value
    // via `new URL(environment.apiUrl).origin`; a trailing slash is silently
    // tolerated there but breaks naive string concatenation elsewhere.
    expect(environment.apiUrl.endsWith('/')).toBe(false);
  });

  it('declares exactly the security headers CloudFront is configured to send', () => {
    // Mirrors terraform/aws/cloudfront.tf. If you change one, change both:
    // this object is what the app reports about itself, not what is enforced.
    expect(environment.securityConfig).toEqual({
      enableHSTS: true,
      hstsMaxAge: 31536000,
      hstsIncludeSubDomains: true,
      hstsPreload: false,
      frameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run src/environments/environment.aws.spec.ts
```

Expected: FAIL — `Failed to resolve import "./environment.aws"`.

- [ ] **Step 3: Create the environment file**

Create `src/environments/environment.aws.ts`:

```ts
/**
 * AWS Environment Configuration
 *
 * Used by the S3 + CloudFront deployment at https://app.aws.tmi.dev.
 * See docs/reference/aws-deployment.md and terraform/aws/.
 *
 * The securityConfig block below is what the application reports about its own
 * posture; the headers are actually emitted by the CloudFront response-headers
 * policy in terraform/aws/cloudfront.tf. Keep the two in sync.
 */

import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  logLevel: 'INFO',
  apiUrl: 'https://server.aws.tmi.dev',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Project (AWS Demo)',
  operatorContact: 'https://github.com/ericfitz/tmi/discussions',
  operatorJurisdiction: 'Florida, United States of America',
  securityConfig: {
    enableHSTS: true,
    hstsMaxAge: 31536000, // 1 year
    hstsIncludeSubDomains: true,
    hstsPreload: false,
    frameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm exec vitest run src/environments/environment.aws.spec.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Add the `aws` build configuration**

In `angular.json`, inside `projects.tmi-ux.architect.build.configurations`, add a sibling to `hosted-container`:

```json
"aws": {
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "2.5MB",
      "maximumError": "3MB"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "20kB",
      "maximumError": "25kB"
    }
  ],
  "outputHashing": "all",
  "fileReplacements": [
    {
      "replace": "src/environments/environment.ts",
      "with": "src/environments/environment.aws.ts"
    }
  ]
}
```

In `package.json`, add to `scripts` immediately after `"build:test"`:

```json
"build:aws": "ng build --configuration=aws",
```

- [ ] **Step 6: Verify the build produces the expected output**

```bash
pnpm run build:aws
ls dist/tmi-ux/browser/index.html
grep -c "server.aws.tmi.dev" dist/tmi-ux/browser/*.js
```

Expected: build succeeds; `index.html` exists; the grep reports at least one match in at least one bundle, confirming `fileReplacements` took effect. If the grep finds zero matches the configuration is wired wrong — do not proceed.

- [ ] **Step 7: Lint and commit**

```bash
pnpm run lint:all
git add src/environments/environment.aws.ts src/environments/environment.aws.spec.ts angular.json package.json
git commit -m "feat: add aws build configuration for app.aws.tmi.dev"
```

---

### Task 2: Terraform skeleton and S3 buckets

**Files:**

- Create: `terraform/aws/versions.tf`, `terraform/aws/backend.hcl`, `terraform/aws/variables.tf`, `terraform/aws/buckets.tf`, `terraform/aws/.gitignore`

**Interfaces:**

- Produces: `aws_s3_bucket.content` and `aws_s3_bucket.logs`. Task 4 references `aws_s3_bucket.content.bucket_regional_domain_name`, `aws_s3_bucket.content.arn`, `aws_s3_bucket.content.id`, and `aws_s3_bucket.logs.bucket_domain_name`. Variables `var.domain_name`, `var.hosted_zone_id`, `var.content_bucket_name`, `var.log_retention_days`, `var.price_class`, `var.tags` are consumed by Tasks 3 and 4.

- [ ] **Step 1: Create `terraform/aws/.gitignore`**

```gitignore
.terraform/
.terraform.lock.hcl.bak
*.tfstate
*.tfstate.*
*.tfvars
!*.tfvars.example
crash.log
```

- [ ] **Step 2: Create `terraform/aws/versions.tf`**

```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }

  # Remote, encrypted state. Bucket / region / lock table come from
  # backend.hcl so the state location stays per-deployer, while the key and
  # encryption flag are pinned here. Deliberately a DIFFERENT key from the
  # tmi server repo's "tmi/aws-public/terraform.tfstate" so UI infrastructure
  # can be planned, applied and destroyed without touching server state.
  #
  #   terraform init -backend-config=backend.hcl
  backend "s3" {
    key     = "tmi-ux/aws-public/terraform.tfstate"
    encrypt = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}
```

- [ ] **Step 3: Create `terraform/aws/backend.hcl`**

```hcl
bucket         = "tmi-tfstate-967218005408"
region         = "us-east-1"
dynamodb_table = "tmi-tf-locks"
```

> If `terraform init` emits a deprecation warning for `dynamodb_table` (Terraform 1.11+ prefers S3 native locking via `use_lockfile = true`), that warning is benign — the argument still functions. Leave it as-is for consistency with the tmi repo's backend; changing the locking mechanism is a deliberate decision to raise separately, not to make silently here.

- [ ] **Step 4: Create `terraform/aws/variables.tf`**

```hcl
variable "aws_region" {
  description = "AWS region. Must be us-east-1: CloudFront viewer certificates are only read from us-east-1."
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Public hostname for the tmi-ux SPA."
  type        = string
  default     = "app.aws.tmi.dev"
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for aws.tmi.dev."
  type        = string
  default     = "Z05646533D2YL1I678JXS"
}

variable "content_bucket_name" {
  description = "S3 bucket holding the built SPA. Private; reached only via CloudFront OAC."
  type        = string
  default     = "tmi-ux-app-967218005408"
}

variable "log_bucket_name" {
  description = "S3 bucket for CloudFront standard access logs."
  type        = string
  default     = "tmi-ux-logs-967218005408"
}

variable "log_retention_days" {
  description = "Days before CloudFront access logs expire."
  type        = number
  default     = 30
}

variable "price_class" {
  description = "CloudFront price class. PriceClass_100 is North America + Europe edges only."
  type        = string
  default     = "PriceClass_100"
}

variable "tags" {
  description = "Tags applied to every resource via the provider's default_tags."
  type        = map(string)
  default = {
    Project   = "tmi"
    Component = "tmi-ux"
    ManagedBy = "terraform"
  }
}
```

- [ ] **Step 5: Create `terraform/aws/buckets.tf`**

```hcl
# ---------------------------------------------------------------------------
# Content bucket: the built SPA. Private in every respect — no website
# hosting, no public ACLs, no public policy. CloudFront reaches it via Origin
# Access Control (see cloudfront.tf), which is also where its bucket policy
# lives, because that policy must reference the distribution ARN.
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "content" {
  bucket = var.content_bucket_name
}

resource "aws_s3_bucket_public_access_block" "content" {
  bucket                  = aws_s3_bucket.content.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "content" {
  bucket = aws_s3_bucket.content.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "content" {
  bucket = aws_s3_bucket.content.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "content" {
  bucket = aws_s3_bucket.content.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ---------------------------------------------------------------------------
# Log bucket: CloudFront standard (legacy) logging delivers via S3 ACLs, which
# is incompatible with BucketOwnerEnforced. This bucket therefore enables ACLs
# — the single place this deployment relaxes a security default, and it
# applies only to logs. CloudFront adds the awslogsdelivery grant itself; the
# public access block stays fully on because that grant is not a public ACL.
# ---------------------------------------------------------------------------

resource "aws_s3_bucket" "logs" {
  bucket = var.log_bucket_name
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "logs" {
  bucket = aws_s3_bucket.logs.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "expire-access-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = var.log_retention_days
    }
  }
}
```

- [ ] **Step 6: Initialize and validate**

```bash
cd terraform/aws
AWS_PROFILE=tmi terraform init -backend-config=backend.hcl
AWS_PROFILE=tmi terraform fmt -check
AWS_PROFILE=tmi terraform validate
```

Expected: `init` succeeds against the existing state bucket; `fmt -check` prints nothing; `validate` prints "Success! The configuration is valid."

- [ ] **Step 7: Plan and confirm the blast radius**

```bash
AWS_PROFILE=tmi terraform plan
```

Expected: **10 to add, 0 to change, 0 to destroy** — two buckets plus their public-access-block, ownership-controls, encryption, versioning (content only) and lifecycle (logs only) resources. Any `destroy` or `change` in this plan means the state key is wrong and you are looking at the server's state — stop and re-check `versions.tf`.

- [ ] **Step 8: Commit**

```bash
cd ../..
git add terraform/aws/
git commit -m "feat: add terraform skeleton and S3 buckets for tmi-ux hosting"
```

---

### Task 3: ACM certificate and DNS validation

**Files:**

- Create: `terraform/aws/certificate.tf`

**Interfaces:**

- Consumes: `var.domain_name`, `var.hosted_zone_id` from Task 2.
- Produces: `aws_acm_certificate_validation.this.certificate_arn`. Task 4's `viewer_certificate` block depends on it — depend on the _validation_ resource, not the certificate, so the distribution is not created before the certificate is usable.

- [ ] **Step 1: Create `terraform/aws/certificate.tf`**

```hcl
# Viewer certificate for the CloudFront distribution. Must be in us-east-1
# regardless of where anything else lives — CloudFront reads viewer certs only
# from that region. The provider is already pinned there via var.aws_region.

resource "aws_acm_certificate" "this" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate_validation" {
  for_each = {
    for dvo in aws_acm_certificate.this.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = var.hosted_zone_id
  name            = each.value.name
  type            = each.value.type
  records         = [each.value.record]
  ttl             = 60
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}
```

- [ ] **Step 2: Validate**

```bash
cd terraform/aws
AWS_PROFILE=tmi terraform fmt -check
AWS_PROFILE=tmi terraform validate
```

Expected: no output from `fmt -check`; "Success!" from `validate`.

- [ ] **Step 3: Plan**

```bash
AWS_PROFILE=tmi terraform plan
```

Expected: 3 more resources to add than Task 2's plan (certificate, one validation record, one validation gate) — **13 to add, 0 to change, 0 to destroy**. The existing `server.aws.tmi.dev` certificate and its validation CNAME must not appear anywhere in the plan.

- [ ] **Step 4: Commit**

```bash
cd ../..
git add terraform/aws/certificate.tf
git commit -m "feat: add ACM certificate with DNS validation for app.aws.tmi.dev"
```

---

### Task 4: CloudFront distribution, OAC, and DNS

**Files:**

- Create: `terraform/aws/cloudfront.tf`, `terraform/aws/dns.tf`, `terraform/aws/outputs.tf`

**Interfaces:**

- Consumes: `aws_s3_bucket.content`, `aws_s3_bucket.logs` (Task 2); `aws_acm_certificate_validation.this` (Task 3).
- Produces: outputs `content_bucket` (string, bucket name), `distribution_id` (string), `site_url` (string). Task 6's deploy script reads all three via `terraform output -raw`.

- [ ] **Step 1: Create `terraform/aws/cloudfront.tf`**

```hcl
locals {
  origin_id = "s3-${aws_s3_bucket.content.id}"
}

# Managed cache policies, looked up by name rather than hard-coded ID.
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "tmi-ux-oac"
  description                       = "OAC for the tmi-ux content bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ---------------------------------------------------------------------------
# Response headers.
#
# The Content-Security-Policy here is DELIBERATELY frame-ancestors only.
# SecurityConfigService injects a complete, provider-aware CSP meta tag at
# runtime, built from environment.apiUrl and the CONTENT_PROVIDERS registry
# (which includes a https://*.sharepoint.com wildcard and origins the server
# supplies at runtime). A second CSP is enforced as an INTERSECTION with the
# first, so any fetch directive added here that is narrower than the app's
# will silently break the Google Drive / OneDrive pickers. frame-ancestors is
# safe to add — and necessary — because meta-tag CSPs ignore it entirely, so
# it is currently enforced nowhere.
#
# See docs/superpowers/specs/2026-07-22-tmi-ux-aws-deployment-design.md.
# ---------------------------------------------------------------------------
resource "aws_cloudfront_response_headers_policy" "this" {
  name = "tmi-ux-security-headers"

  security_headers_config {
    content_security_policy {
      content_security_policy = "frame-ancestors 'none'"
      override                = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = false
      override                   = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "camera=(), microphone=(), geolocation=()"
      override = true
    }
  }
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "tmi-ux SPA"
  default_root_object = "index.html"
  aliases             = [var.domain_name]
  price_class         = var.price_class
  http_version        = "http2and3"

  origin {
    domain_name              = aws_s3_bucket.content.bucket_regional_domain_name
    origin_id                = local.origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  logging_config {
    bucket          = aws_s3_bucket.logs.bucket_domain_name
    prefix          = "cloudfront/"
    include_cookies = false
  }

  default_cache_behavior {
    target_origin_id           = local.origin_id
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id
  }

  # index.html and config.json are the two entry points that must never be
  # served stale: index.html references hash-named bundles, and config.json is
  # the no-rebuild override hook read by src/main.ts before bootstrap.
  ordered_cache_behavior {
    path_pattern               = "/index.html"
    target_origin_id           = local.origin_id
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_disabled.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id
  }

  ordered_cache_behavior {
    path_pattern               = "/config.json"
    target_origin_id           = local.origin_id
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_disabled.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.this.id
  }

  # SPA deep-link routing. With OAC, S3 returns 403 (not 404) for a missing
  # key because the OAC principal has no s3:ListBucket. Known trade-off: this
  # also renders the app shell when the origin is genuinely misconfigured, so
  # when debugging a blank app, test the S3 origin directly before trusting
  # a 200 from CloudFront.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.this.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# Grants only this distribution read access to the content bucket.
data "aws_iam_policy_document" "content" {
  statement {
    sid       = "AllowCloudFrontServicePrincipalReadOnly"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.content.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "content" {
  bucket = aws_s3_bucket.content.id
  policy = data.aws_iam_policy_document.content.json
}
```

- [ ] **Step 2: Create `terraform/aws/dns.tf`**

```hcl
resource "aws_route53_record" "ipv4" {
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "ipv6" {
  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "AAAA"

  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}
```

- [ ] **Step 3: Create `terraform/aws/outputs.tf`**

```hcl
output "content_bucket" {
  description = "Name of the S3 bucket holding the built SPA."
  value       = aws_s3_bucket.content.id
}

output "distribution_id" {
  description = "CloudFront distribution ID, used for cache invalidation."
  value       = aws_cloudfront_distribution.this.id
}

output "site_url" {
  description = "Public URL of the deployed SPA."
  value       = "https://${var.domain_name}"
}
```

- [ ] **Step 4: Validate and plan**

```bash
cd terraform/aws
AWS_PROFILE=tmi terraform fmt -check
AWS_PROFILE=tmi terraform validate
AWS_PROFILE=tmi terraform plan
```

Expected: `validate` succeeds. Plan adds 6 more resources than Task 3 (OAC, response-headers policy, distribution, bucket policy, two Route 53 records) — **19 to add, 0 to change, 0 to destroy**. Confirm in the plan output that `content_security_policy` reads exactly `frame-ancestors 'none'`.

- [ ] **Step 5: Commit**

```bash
cd ../..
git add terraform/aws/cloudfront.tf terraform/aws/dns.tf terraform/aws/outputs.tf
git commit -m "feat: add cloudfront distribution, OAC and DNS for app.aws.tmi.dev"
```

---

### Task 5: Apply the infrastructure

**Files:** none — this task runs Terraform and verifies the result.

**Interfaces:**

- Consumes: everything from Tasks 2–4.
- Produces: a live distribution. Task 6 needs `terraform output -raw content_bucket` and `distribution_id` to resolve.

- [ ] **Step 1: Apply**

```bash
cd terraform/aws
AWS_PROFILE=tmi terraform apply
```

Review the plan once more before confirming. Expected: 19 resources created. The apply blocks on `aws_acm_certificate_validation` while DNS propagates (typically 2–5 minutes) and again on distribution deployment (5–15 minutes).

- [ ] **Step 2: Verify the certificate issued**

```bash
AWS_PROFILE=tmi aws acm list-certificates --region us-east-1 \
  --query "CertificateSummaryList[?DomainName=='app.aws.tmi.dev'].Status" --output text
```

Expected: `ISSUED`

- [ ] **Step 3: Verify the distribution is deployed and DNS resolves**

```bash
AWS_PROFILE=tmi aws cloudfront get-distribution \
  --id "$(AWS_PROFILE=tmi terraform output -raw distribution_id)" \
  --query 'Distribution.Status' --output text
dig +short app.aws.tmi.dev
```

Expected: `Deployed`; `dig` returns CloudFront edge addresses.

- [ ] **Step 4: Confirm the bucket is not publicly reachable**

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://tmi-ux-app-967218005408.s3.amazonaws.com/index.html"
```

Expected: `403`. A `200` means the bucket is public — stop and fix before continuing.

> No commit — this task changes no files.

---

### Task 6: Build and deploy script

**Files:**

- Create: `scripts/deploy-aws.sh`
- Modify: `package.json` (add `deploy:aws` to `scripts`)

**Interfaces:**

- Consumes: `pnpm run build:aws` (Task 1), Terraform outputs `content_bucket` / `distribution_id` / `site_url` (Task 4).
- Produces: a deployed site.

- [ ] **Step 1: Create `scripts/deploy-aws.sh`**

```bash
#!/usr/bin/env bash

# Build and deploy tmi-ux to the AWS S3 + CloudFront stack in terraform/aws.
#
# Usage:
#   ./scripts/deploy-aws.sh [--no-build]
#
# Options:
#   --no-build   Deploy whatever is already in dist/tmi-ux/browser
#   --help       Show this help message
#
# Prerequisites:
#   - AWS CLI configured with the "tmi" profile
#   - terraform/aws applied (see docs/reference/aws-deployment.md)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TF_DIR="$ROOT_DIR/terraform/aws"
DIST_DIR="$ROOT_DIR/dist/tmi-ux/browser"

export AWS_PROFILE="${AWS_PROFILE:-tmi}"

RUN_BUILD=true
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-build)
            RUN_BUILD=false
            shift
            ;;
        --help)
            sed -n '3,/^$/p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "Error: Unknown option: $1" >&2
            exit 1
            ;;
    esac
done

echo "==> Reading Terraform outputs"
BUCKET="$(terraform -chdir="$TF_DIR" output -raw content_bucket)"
DISTRIBUTION_ID="$(terraform -chdir="$TF_DIR" output -raw distribution_id)"
SITE_URL="$(terraform -chdir="$TF_DIR" output -raw site_url)"
echo "    bucket=$BUCKET distribution=$DISTRIBUTION_ID"

if [[ "$RUN_BUILD" == true ]]; then
    echo "==> Building (configuration=aws)"
    (cd "$ROOT_DIR" && pnpm run build:aws)
fi

if [[ ! -f "$DIST_DIR/index.html" ]]; then
    echo "Error: $DIST_DIR/index.html not found; run without --no-build." >&2
    exit 1
fi

# src/main.ts fetches /config.json before bootstrap in production builds. On
# S3 a missing key would be rewritten to index.html by the SPA fallback,
# return 200, and fail JSON parsing — a warning on every page load. Publishing
# an empty object keeps the load clean and leaves a hook for overriding
# apiUrl / operator strings later without a rebuild.
echo "==> Writing config.json"
echo '{}' > "$DIST_DIR/config.json"

# Pass 1 — stable-named assets. outputHashing only hashes build-emitted files,
# so everything from public/ (favicon.ico, TMI-Logo.svg, site.webmanifest,
# robots.txt) and src/assets/ (including i18n JSON) keeps a stable name and
# must NOT be marked immutable. --delete is scoped by the same filters, so it
# will not remove the hashed output uploaded by pass 2.
echo "==> Pass 1/3: stable-named assets (max-age=3600)"
aws s3 sync "$DIST_DIR" "s3://$BUCKET" --delete \
    --cache-control "public,max-age=3600" \
    --exclude "*.js" --exclude "*.css" --exclude "media/*" \
    --exclude "index.html" --exclude "config.json"

# Pass 2 — hash-named build output. Syncing from local (rather than an S3-to-S3
# copy with --metadata-directive REPLACE) keeps the guessed Content-Type.
echo "==> Pass 2/3: hashed build output (immutable)"
aws s3 sync "$DIST_DIR" "s3://$BUCKET" --delete \
    --cache-control "public,max-age=31536000,immutable" \
    --exclude "*" --include "*.js" --include "*.css" --include "media/*"

echo "==> Pass 3/3: entry points (no-store)"
aws s3 cp "$DIST_DIR/index.html" "s3://$BUCKET/index.html" \
    --cache-control "no-store" --content-type "text/html"
aws s3 cp "$DIST_DIR/config.json" "s3://$BUCKET/config.json" \
    --cache-control "no-store" --content-type "application/json"

# Hashed files never need invalidating and the entry points sit on
# CachingDisabled behaviors; this exists for the stable-named assets above.
# One /* path counts as a single invalidation against the 1000/month free tier.
echo "==> Invalidating CloudFront cache"
INVALIDATION_ID="$(aws cloudfront create-invalidation \
    --distribution-id "$DISTRIBUTION_ID" \
    --paths '/*' \
    --query 'Invalidation.Id' --output text)"

echo "==> Deployed to $SITE_URL (invalidation $INVALIDATION_ID)"
```

- [ ] **Step 2: Make it executable and add the package script**

```bash
chmod +x scripts/deploy-aws.sh
```

In `package.json`, add to `scripts` immediately after `"build:aws"`:

```json
"deploy:aws": "sh scripts/deploy-aws.sh",
```

- [ ] **Step 3: Deploy**

```bash
pnpm run deploy:aws
```

Expected: build succeeds, three sync/copy passes report uploads, invalidation ID printed.

- [ ] **Step 4: Verify the site serves and headers are right**

```bash
curl -sI https://app.aws.tmi.dev/ | grep -Ei 'HTTP/|strict-transport|content-security|x-frame|x-content-type|referrer-policy|permissions-policy|cache-control'
```

Expected: `HTTP/2 200`; `content-security-policy: frame-ancestors 'none'`; `strict-transport-security: max-age=31536000; includeSubDomains`; `x-frame-options: DENY`; `x-content-type-options: nosniff`; `referrer-policy: strict-origin-when-cross-origin`; `permissions-policy: camera=(), microphone=(), geolocation=()`; `cache-control: no-store`.

- [ ] **Step 5: Verify cache-control per asset class and SPA routing**

```bash
# A hashed bundle must be immutable
HASHED="$(curl -s https://app.aws.tmi.dev/ | grep -o '/[A-Za-z0-9._-]*\.js' | head -1)"
curl -sI "https://app.aws.tmi.dev${HASHED}" | grep -i cache-control
# A stable-named asset must NOT be immutable
curl -sI https://app.aws.tmi.dev/favicon.ico | grep -i cache-control
# config.json must parse as JSON
curl -s https://app.aws.tmi.dev/config.json
# Deep link must return the app, not an error
curl -s -o /dev/null -w '%{http_code}\n' https://app.aws.tmi.dev/intake
```

Expected: `public,max-age=31536000,immutable`; `public,max-age=3600`; `{}`; `200`.

- [ ] **Step 6: Commit**

```bash
git add scripts/deploy-aws.sh package.json
git commit -m "feat: add aws deploy script for s3 + cloudfront"
```

---

### Task 7: Runbook and end-to-end verification

**Files:**

- Create: `docs/reference/aws-deployment.md`

**Interfaces:**

- Consumes: everything above.

- [ ] **Step 1: Write the runbook**

Create `docs/reference/aws-deployment.md`:

````markdown
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
pnpm run deploy:aws            # build + deploy
pnpm run deploy:aws -- --no-build   # deploy the existing dist/
```

## Change infrastructure

```bash
cd terraform/aws
AWS_PROFILE=tmi terraform init -backend-config=backend.hcl   # first time only
AWS_PROFILE=tmi terraform plan
AWS_PROFILE=tmi terraform apply
```

State lives at `tmi-ux/aws-public/terraform.tfstate` in
`s3://tmi-tfstate-967218005408` — separate from the tmi server repo's state, so
this stack can be applied and destroyed independently.

## Caching model

`outputHashing: "all"` hashes only build-emitted files. `public/` and
`src/assets/` ship under stable names, so the deploy script uses three passes:
stable names get one hour, hashed output gets a year `immutable`, and
`index.html` / `config.json` get `no-store`. The `/*` invalidation exists for
the stable-named assets.

## Security headers

CloudFront sends HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`,
`Permissions-Policy`, and a CSP of **`frame-ancestors 'none'` only**.

The app injects its own complete CSP at runtime (`SecurityConfigService`),
built from `environment.apiUrl` and the `CONTENT_PROVIDERS` registry. Two CSPs
on one document are enforced as an intersection, so **do not add fetch
directives to the CloudFront policy** — a directive narrower than the app's
silently breaks the Google Drive and OneDrive pickers. `frame-ancestors` is the
exception: meta-tag CSPs ignore it, so the edge is the only place it can be set.

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

## Troubleshooting

**Blank app, HTTP 200.** The distribution maps origin 403/404 to
`/index.html` with a 200 for SPA routing, which also masks a broken origin.
Check the S3 origin directly before trusting the CloudFront response.

**Stale assets after deploy.** Confirm the invalidation completed:
`aws cloudfront get-invalidation --distribution-id <id> --id <id>`.

**Login fails / callback rejected.** See "Server dependency" above.
````

- [ ] **Step 2: Verify the app loads cleanly in a browser**

Open `https://app.aws.tmi.dev/` and check the DevTools console.

Expected: no `Failed to fetch runtime config` warning, and **no CSP violation
reports**. A CSP violation here means the edge policy is intersecting with the
app's — re-read the CSP note in `cloudfront.tf` before changing anything.

- [ ] **Step 3: Verify OAuth login end-to-end**

Requires server ops to have applied `TMI_OAUTH_CLIENT_CALLBACK_ALLOWLIST`
(see `deliverables/tmi-server-config-note.md`). Until then this step is blocked
and login is expected to fail.

Sign in via Google. Expected: redirect to the provider, return to
`https://app.aws.tmi.dev/oauth2/callback`, and land authenticated.

- [ ] **Step 4: Verify the content pickers open**

With a signed-in session, open both the Google Drive and the OneDrive/SharePoint
file pickers. Expected: both render. These are the specific features an
over-broad edge CSP would break, so this check is not optional.

- [ ] **Step 5: Verify access logs are being delivered**

CloudFront delivers standard logs on a delay of up to an hour after first
traffic.

```bash
AWS_PROFILE=tmi aws s3 ls s3://tmi-ux-logs-967218005408/cloudfront/ | head
```

Expected: at least one gzipped log object.

- [ ] **Step 6: Commit**

```bash
git add docs/reference/aws-deployment.md
git commit -m "docs: add aws deployment runbook"
```

---

## Self-Review Notes

**Spec coverage.** Every spec section maps to a task: architecture and runtime
config → Tasks 1, 6; Terraform resources and both trade-offs → Tasks 2–4;
security headers and the CSP rationale → Task 4 + runbook; build/deploy and the
three-pass rationale → Task 6; verification list → Tasks 5–7; server-side
prerequisite → Task 7 Step 3 + runbook.

**Deliberately out of scope** (per the spec): CI/CD and GitHub OIDC, WAF,
retiring `scripts/push-ecr.sh`, and baking a build-time CSP into `index.html`.

**Resource counts** in the plan-gate steps (10 → 13 → 19) are derived by hand
from the resource blocks in each task. If a real plan differs, reconcile the
difference before applying rather than assuming the plan document is right.

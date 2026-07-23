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

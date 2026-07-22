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

# Deliberately NO force_destroy here. Versioning is on so a bad deploy can be
# rolled back; letting `terraform destroy` silently discard every version is
# worse than the destroy failing with BucketNotEmpty. Emptying the bucket is a
# conscious step — see docs/reference/aws-deployment.md.
#
# Versioning plus a deploy on every push would otherwise accumulate noncurrent
# copies of each hashed bundle forever, so bound it here.
resource "aws_s3_bucket_lifecycle_configuration" "content" {
  bucket = aws_s3_bucket.content.id

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "abort-incomplete-multipart-uploads"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
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

  # Access logs are disposable and the bucket is never empty in practice, so
  # without this `terraform destroy` fails with BucketNotEmpty.
  force_destroy = true
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

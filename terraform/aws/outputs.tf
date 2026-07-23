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

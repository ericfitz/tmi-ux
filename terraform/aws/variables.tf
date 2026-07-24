variable "aws_region" {
  description = "AWS region. Must be us-east-1: CloudFront viewer certificates are only read from us-east-1."
  type        = string
  default     = "us-east-1"
}

variable "domain_name" {
  description = "Public hostname for the tmi-ux SPA."
  type        = string
  default     = "www.tmi.dev"
}

variable "hosted_zone_id" {
  description = "Route 53 hosted zone ID for tmi.dev (migrated into this account)."
  type        = string
  default     = "Z017072317XPHCAN503JC"
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

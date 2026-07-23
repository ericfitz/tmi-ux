# ---------------------------------------------------------------------------
# Viewer certificate for the CloudFront distribution. Must be in us-east-1
# regardless of where anything else lives — CloudFront reads viewer certs
# only from that region. The provider is already pinned there via
# var.aws_region.
#
# The hosted zone (aws.tmi.dev) already contains a certificate-validation
# CNAME for server.aws.tmi.dev, owned by the separate TMI server deployment.
# This resource only ever creates/manages records keyed by this
# certificate's own domain_validation_options, so it cannot collide with
# that record. allow_overwrite exists to let re-plans/re-creates of this
# certificate's own validation record succeed, not to touch unrelated
# records.
# ---------------------------------------------------------------------------

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

# Gate: Task 4's CloudFront distribution must depend on this validation
# resource (not the bare certificate) so the distribution isn't created
# before the certificate has actually finished validating and become usable.
resource "aws_acm_certificate_validation" "this" {
  certificate_arn         = aws_acm_certificate.this.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

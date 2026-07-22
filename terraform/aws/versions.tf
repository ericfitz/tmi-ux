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

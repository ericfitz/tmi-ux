# ADR 0002: tmi-ux deploys only to AWS and k3s

- **Status:** Accepted
- **Date:** 2026-09-28
- **Decision by:** Eric Fitzgerald (human decision)
- **Related:** [ericfitz/tmi#979](https://github.com/ericfitz/tmi/pull/979), which removed the server's
  OCI, GCP, Azure, aws-private and Heroku deploy tooling

## Context

tmi-ux carried deploy tooling for five targets: AWS (S3 + CloudFront), k3s, Heroku, Oracle Cloud
(OCI Container Instances) and Google Cloud Run. Only AWS (`www.tmi.dev`) and k3s (`tmi.efitz.net`)
are in use. The server dropped its other targets in tmi#979, so the client's Heroku, OCI and Cloud
Run tooling pointed at deployments that no longer exist and had no server to talk to.

## Decision

Remove the Heroku, OCI and Cloud Run deploy targets. The remaining targets are:

- **AWS:** `pnpm run deploy:aws` (`scripts/deploy-aws.sh`, `terraform/aws/`, `build:aws`)
- **k3s:** `pnpm run deploy:k3s` (`Dockerfile.chainguard`, `build:container`)

Removed: `Procfile`, `Dockerfile` (Cloud Run), `Dockerfile.oci`, `scripts/push-heroku.sh`,
`scripts/push-oci.sh`, `scripts/configure-heroku-env.sh`, `scripts/configure-oci-env.sh`, the
`hosted-container` and `oci` Angular build configurations with their environment files, and the
`build:hosted-container`, `heroku-postbuild`, `deploy:heroku`, `build:oci` and `deploy:oci` scripts.
Eric decided on Heroku and OCI first and extended the decision to the Cloud Run `Dockerfile` when
asked.

## Consequences

- `Dockerfile.chainguard` is now the only container image. Its final stage runs as the Chainguard
  base image's default non-root uid 65532 but sets no `USER`, so threat T13 in
  `docs/threatmodel/THREAT_MODEL.md` stays partially mitigated until the uid is pinned.
- `server.js` stays; `Dockerfile.chainguard` runs it.
- The tmi wiki page Deploying-TMI-Web-Application.md is updated separately to match.

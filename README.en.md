# OCE Rollout Guard

[Français](README.md) · [Español](README.es.md)

An external deployment guard for OpenClaw Enterprise (OCE). It creates a plan from an agent and its configuration, blocks deployment if either changed, writes a private intent **before** calling deploy, then verifies the exact revision and an independent probe. It does not delete or automatically restore revisions.

## Usage

First connect the occ CLI to a test installation. Copy config.example.json to a private file under .local/ and replace the IDs. probeCommand may call [oce-agent-conformance](https://github.com/gbesse/oce-agent-conformance) configured with a real model probe. Never pass secrets as command arguments.

    node src/cli.js plan .local/config.private.json .local/plan.json
    node src/cli.js dispatch .local/plan.json .local/dispatch.json --apply
    node src/cli.js verify .local/dispatch.json .local/report.json
    npm test

dispatch creates .local/dispatch.json.intent before calling OCC. If the deployment response is lost, the result is unknown: inspect OCE revisions and audit before making another request. verify reports pass only when the exact deployment succeeded, that revision is active, there are no warnings, and probeCommand returns JSON with status equal to pass. Without a probe, the result remains incomplete. The operator is responsible for trusting the probe's provenance.

The [OCE API](https://docs-enterprise.openclaw.org/guides/topics/agent-revisions/) has no public rollback operation. On failure, fix the configuration kept in source control and deploy a new revision after review. Repository tests use a fake CLI; no real installation has been verified.

Exit codes: 0 pass or plan recorded, 1 failure or uncertain outcome, 2 incomplete evidence. MIT licensed.

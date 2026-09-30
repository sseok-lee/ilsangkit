# First production release with an already-prepared database

The normal `main` deploy workflow assumes a release-controller inventory and an active address-mode readiness endpoint. Do not use the first `main` merge to create those prerequisites.

For an already-prepared database, do **not** rerun `runSummaryTransition` with its default preparation path. Schema creation, Summary V2 preparation, and URL registry apply are separate operations and are not part of this cutover.

1. Pin the tested commit and Linux x64 artifact hashes. Confirm current full-backup restoration evidence and URL-registry backup restoration evidence. Preserve the legacy PM2 processes, environment, Nginx configurations, static sitemaps, and hashed assets.
2. Check source fingerprint drift, stored Summary V2 run ID, URL state, mapping coverage, and representative preserved/suffixed paths. Pause scheduled writers and confirm no writer or deploy is active immediately before mutation. Check available memory, swap pressure, disk space and candidate ports.
3. Install release directories, protected shared environment, writer-lock directory and inventory. Install an Nginx wrapper supporting `-t -c <candidate>` and `-s reload`; preserve the live config path. Add the release include and release-aware cache keys while its initial upstreams still point to the legacy apps. Validate Nginx before reload and verify legacy public responses afterward.
4. Install immutable compatibility and address artifacts on separate reserved ports. Start candidate apps without public traffic. Generate static sitemaps from the candidate URL registry into its release-specific directory. Reject missing children, carried-forward failures, unexpected URL loss, hash detail paths and incorrect preserved/suffixed URLs. Verify `x-sitemap-source: static`.
5. Run the compatibility `check --bootstrap-compat-check`, then address `check` using the checked compatibility release as rollback. Both require default-deadline API and SSR probes. Do not equate a successful warm retry with successful native cold-start verification.
6. Switch with the release controller, reconcile and verify that the actual active release is the expected candidate. Keep inventory, pointers, runtime paths and the next deploy's rollback/probes synchronized. Verify public health, business paths, static sitemaps and retained assets. A rolled-back reconciliation is not a successful deployment.
7. Promote the reviewed `develop` branch to `main` only after normal deployment prerequisites work. Observe Test and Deploy results for the exact merged SHA. Verify scheduled sync resolves the active backend environment, summary mode and sitemap origin/directory before restoring its schedule.

If candidate validation fails before switching, keep public traffic on legacy. If public smoke checks fail after switching, use the checked compatibility rollback, verify its public responses, and persist the actual rollback state. Leave additive database tables and approved public URL ownership untouched.

Production observation files and manifests belong in the local ignored report directory; never commit environment files, credentials or database backups.

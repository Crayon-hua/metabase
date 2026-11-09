# Metabase for Alibaba Cloud AnalyticDB

This branch is based on upstream **v0.65.3.6**, not upstream master. The patch avoids
`information_schema.columns.GENERATION_EXPRESSION`, which is absent on the reported
ADB endpoint (`SELECT VERSION()` returns `5.6.16-log`). Generated columns are identified
using `EXTRA` markers `VIRTUAL GENERATED` and `STORED GENERATED`. `DEFAULT_GENERATED`
and `auto_increment` are not treated as generated columns. The version warning is
intentionally retained: this patch does not provide full MySQL 5.6 or ADB compatibility.

## Build and publish

The **Build and publish ADB-compatible Metabase** workflow runs on pushes to
`adb-v0.65.3.6`, `adb-v*` tags, and manual dispatch (once the workflow exists on the
repository default branch). Pull requests targeting this branch run regression tests only.
It uses GitHub-hosted runners and the built-in `GITHUB_TOKEN`; no upstream Metabase
secrets or custom runners are required. Enable GitHub Actions on the fork if disabled.
Organization/package policies must permit package writes.

Before publishing, it tests a metadata fixture without `GENERATION_EXPRESSION` and
real generated columns on MySQL 8.4 and MariaDB 10.11, builds the OSS JAR including
licenses, then starts the image and checks `/api/health`.

Outputs (linux/amd64):

- `ghcr.io/crayon-hua/metabase:latest` (updated only by the release branch)
- `ghcr.io/crayon-hua/metabase:sha-<12-character-commit>`
- `ghcr.io/crayon-hua/metabase:v0.65.3.6-adb.<run-number>`
- A downloadable JAR and SHA-256 checksum in the workflow artifacts.

The first GHCR package may be private. In GitHub profile > Packages > metabase >
Package settings, set visibility to Public for anonymous pulls. Otherwise authenticate
with `docker login ghcr.io` using a token with `read:packages`. The image is maintained
in this fork's namespace; it does not replace the official Docker Hub image.

## Test against ADB

After a successful image publish, from this checkout on the server:

```bash
read -rsp 'New test database password: ' MB_TEST_DB_PASSWORD
echo
export MB_TEST_DB_PASSWORD
# Pin an immutable image tag here when validating a particular build.
export METABASE_ADB_IMAGE=ghcr.io/crayon-hua/metabase:latest
docker compose -p metabase-adb-test -f compose.adb-test.yml pull
docker compose -p metabase-adb-test -f compose.adb-test.yml up -d
```

Open `http://SERVER:3001`, create a new Metabase setup, add ADB using the MySQL
connection type and `tinyInt1isBit=false`, then sync the schema. Confirm `ad_account`
fields appear and both a native SELECT and a query-builder question work. Use a
read-only ADB account for validation. CI cannot verify the actual ADB endpoint without
access to that cluster; report any subsequent compatibility error separately.

The Compose project has an independent Postgres service and volume. It must not use
the production Metabase application database. Both stacks need sufficient server RAM.
Stop the test stack with the same command and `down` in place of `up -d`; data is retained.

After validation and an application-database backup, replace only the Metabase image
in the production Compose file with the tested immutable tag. Keep the existing
Postgres volume, connection settings, and other runtime settings. Do not copy Java,
PATH, or JAVA_VERSION environment variables from container-generated Compose output;
use the defaults supplied by the custom image. Preserve the backup for rollback.

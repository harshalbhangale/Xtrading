# AWS development database

Selected target: account `308324916322`, profile `truelex-cli`, Mumbai `ap-south-1`. Stack: `call-my-bluff-hackathon`. This is a dedicated project database; it does not reuse the Truelex application database.

## Infrastructure

`database.json` is the CloudFormation source. It provisions:

- PostgreSQL 17 on a single-AZ `db.t4g.micro` instance with 20 GiB encrypted gp3 storage.
- A project-specific subnet group, parameter group and security group in the selected VPC.
- TLS enforcement and inbound PostgreSQL access from one developer IPv4 `/32` only.
- Seven-day backups, deletion protection and retain policies for deletion/replacement.
- An RDS-managed administrator password in Secrets Manager.

The RDS endpoint is publicly addressable for development but restricted by the security group. A changed developer IP requires updating `DeveloperCidr` through a reviewed CloudFormation change set. Do not widen it to `0.0.0.0/0`. A hosted app needs a separately reviewed network access configuration; this developer rule does not authorize arbitrary hosting IP ranges.

RDS, storage, backups beyond allowances, Secrets Manager and logs incur AWS charges while retained. Deletion protection and retain policies require deliberate cleanup after the hackathon; removing the stack does not remove the database.

AWS Pricing API checked on 11 October 2026: Mumbai single-AZ PostgreSQL `db.t4g.micro` compute is $0.021/hour (approximately $15.33 at 730 hours), before storage and other charges.

Template validation includes `cfn-lint`, the AWS `ValidateTemplate` API, explicit security property checks and inspection of the change set and validation events before execution. The first change set adds only the four project resources.

## Connect and migrate

Use a local AWS profile already authorized for the explicitly selected account. The bootstrap requires read access to stack outputs and its RDS administrator secret, plus get/create access to the project's application secret. Never paste AWS credentials or database passwords into a commit or chat.

```sh
python3 -m venv /tmp/cmb-aws-tools
/tmp/cmb-aws-tools/bin/pip install -r infrastructure/aws/requirements.txt
/tmp/cmb-aws-tools/bin/python infrastructure/aws/connect_database.py \
  --profile truelex-cli --account 308324916322 --region ap-south-1 \
  --activate-local
```

Run only after the stack reaches `CREATE_COMPLETE` or `UPDATE_COMPLETE`. The script:

1. Verifies the account matches the requested target.
2. Downloads the official RDS trust bundle into `~/.config/call-my-bluff/aws-rds-ca.pem`.
3. Applies migrations through the AWS-managed administrator credential without printing driver logs or credentials.
4. Creates/reuses the `cmb_app` credential in the project application secret.
5. Grants that role database connection, schema usage and table/sequence data access, without schema creation or role/database administration.
6. Verifies foundation tables, encrypted TLS and restricted schema privileges through the application connection.
7. With `--activate-local`, writes the application URL and CA path into ignored `apps/web/.env.local` with mode 0600. Without it, local app settings remain unchanged.

Restart the web server after activation and request `/api/ready`. A successful result verifies database connectivity and foundation tables, not identity or sponsor completion. Migrations for future schema changes should use the bootstrap administrator path; the application's restricted role cannot run DDL. Default privileges apply to tables created by `cmb_admin`.

The application secret is separate from the RDS-managed administrator secret and is not automatically rotated by RDS. Rotating it requires coordinating the database role password and application configuration. The bootstrap reuses the stored application password; it does not print it or place it in source files.

Local Docker Postgres remains available as an independent development fallback. Switching back requires explicitly replacing `DATABASE_URL` and removing the cloud CA setting in the ignored local environment file.

## Deployment verification

Record stack availability, successful cloud migrations, application-role checks and `/api/ready` results in the implementation checklist only after they succeed. No application data is seeded during bootstrap.

Verified on 11 October 2026: stack `CREATE_COMPLETE`, RDS `available`, cloud migrations applied, foundation tables accessible through `cmb_app`, TLS active and application schema creation denied. The production web build returned HTTP 200 and `database: ready` from `/api/ready` against RDS. The ignored local web environment now uses this cloud application role. Administrator migrations use the shared database client's certificate verification and the checked-in migration files.

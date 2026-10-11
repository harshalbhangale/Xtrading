"""Bootstrap the deployed database without printing credentials.

Requires boto3 and psycopg[binary]. Uses an explicitly selected local AWS profile.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import urllib.parse
import urllib.request

import boto3
import psycopg
from psycopg import sql

parser = argparse.ArgumentParser()
parser.add_argument('--profile', required=True)
parser.add_argument('--account', required=True)
parser.add_argument('--region', default='ap-south-1')
parser.add_argument('--stack', default='call-my-bluff-hackathon')
parser.add_argument('--activate-local', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
session = boto3.Session(profile_name=args.profile, region_name=args.region)
if session.client('sts').get_caller_identity()['Account'] != args.account:
    raise SystemExit('Account does not match the explicitly selected target.')
stack = session.client('cloudformation').describe_stacks(StackName=args.stack)['Stacks'][0]
if stack['StackStatus'] not in ('CREATE_COMPLETE', 'UPDATE_COMPLETE'):
    raise SystemExit('Database stack must be complete before connecting.')
outputs = {item['OutputKey']: item['OutputValue'] for item in stack['Outputs']}
sm = session.client('secretsmanager')
admin = json.loads(sm.get_secret_value(SecretId=outputs['MasterSecretArn'])['SecretString'])
host = outputs['DatabaseHost']
ca_path = Path.home() / '.config/call-my-bluff/aws-rds-ca.pem'
ca_path.parent.mkdir(parents=True, exist_ok=True)
ca_path.write_bytes(urllib.request.urlopen(
    'https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem', timeout=20
).read())

def connection_url(user, password):
    return (f'postgresql://{urllib.parse.quote(user, safe="")}:'
            f'{urllib.parse.quote(password, safe="")}@{host}:5432/'
            'call_my_bluff?sslmode=verify-full')

env = dict(os.environ, DATABASE_URL=connection_url(admin['username'], admin['password']),
           DATABASE_CA_FILE=str(ca_path))
# Capture migration logs privately; never print driver errors containing connection details.
migration = subprocess.run(['pnpm', 'db:migrate'], cwd=root, env=env, capture_output=True)
if migration.returncode:
    raise SystemExit('Migration failed; no credentials have been printed. Check access and schema privately.')

secret_name = f'{args.stack}/application-database'
try:
    app = json.loads(sm.get_secret_value(SecretId=secret_name)['SecretString'])
except sm.exceptions.ResourceNotFoundException:
    app = {'username': 'cmb_app', 'password': secrets.token_urlsafe(32)}
    sm.create_secret(Name=secret_name, SecretString=json.dumps(app),
                     Tags=[{'Key': 'Project', 'Value': 'call-my-bluff'}])
# Fixed application identity prevents a changed secret from granting a different role privileges.
if app['username'] != 'cmb_app':
    raise SystemExit('Unexpected application role in secret.')
with psycopg.connect(host=host, dbname='call_my_bluff', user=admin['username'],
                      password=admin['password'], sslmode='verify-full',
                      sslrootcert=str(ca_path), connect_timeout=10) as conn:
    if not conn.execute('select 1 from pg_roles where rolname = %s', ('cmb_app',)).fetchone():
        conn.execute(sql.SQL('CREATE ROLE cmb_app LOGIN PASSWORD {}').format(sql.Literal(app['password'])))
    else:
        conn.execute(sql.SQL('ALTER ROLE cmb_app PASSWORD {}').format(sql.Literal(app['password'])))
    privileges = conn.execute(
        'select rolsuper, rolcreatedb, rolcreaterole, rolreplication from pg_roles where rolname = %s',
        ('cmb_app',)
    ).fetchone()
    if any(privileges):
        raise SystemExit('Application role has unexpected administrative privileges.')
    conn.execute('GRANT CONNECT ON DATABASE call_my_bluff TO cmb_app')
    conn.execute('GRANT USAGE ON SCHEMA public TO cmb_app')
    conn.execute('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cmb_app')
    conn.execute('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cmb_app')
    conn.execute('ALTER DEFAULT PRIVILEGES FOR ROLE cmb_admin IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cmb_app')
    conn.execute('ALTER DEFAULT PRIVILEGES FOR ROLE cmb_admin IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cmb_app')
app_url = connection_url(app['username'], app['password'])
app_env = dict(os.environ, DATABASE_URL=app_url, DATABASE_CA_FILE=str(ca_path))
check = subprocess.run(['pnpm', 'db:check'], cwd=root, env=app_env, capture_output=True)
if check.returncode:
    raise SystemExit('Application-role database check failed; local configuration has not been changed.')
with psycopg.connect(host=host, dbname='call_my_bluff', user='cmb_app',
                      password=app['password'], sslmode='verify-full',
                      sslrootcert=str(ca_path), connect_timeout=10) as conn:
    tls = conn.execute('select ssl from pg_stat_ssl where pid = pg_backend_pid()').fetchone()[0]
    can_create = conn.execute("select has_schema_privilege(current_user, 'public', 'CREATE')").fetchone()[0]
    if not tls or can_create:
        raise SystemExit('Application TLS/privilege verification failed.')
if args.activate_local:
    path = root / 'apps/web/.env.local'
    lines = path.read_text().splitlines() if path.exists() else []
    lines = [line for line in lines if not line.startswith(('DATABASE_URL=', 'DATABASE_CA_FILE='))]
    lines += [f'DATABASE_URL={app_url}', f'DATABASE_CA_FILE={ca_path}']
    path.write_text('\n'.join(lines) + '\n')
    path.chmod(0o600)
print(json.dumps({'database': 'ready', 'tls': True, 'applicationRole': 'cmb_app',
                  'schemaCreationAllowed': False, 'localActivated': args.activate_local}))

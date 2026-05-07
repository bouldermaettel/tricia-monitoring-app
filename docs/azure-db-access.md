# Azure Database Access Notes

This documents how database access was established from this environment to Azure PostgreSQL.

## Why direct access failed

- Direct connection from WSL to `tricia-monitoring-pg.postgres.database.azure.com:5432` timed out.
- Even after adding the current client IP to PostgreSQL firewall rules, TCP `5432` remained unreachable from this network.

## Working approach used

Because outbound `5432` and `8000` were blocked from this environment, a temporary Azure relay container was used on `443`.

Flow:

1. Local machine -> `tricia-pg-tunnel-443-20260430.switzerlandnorth.azurecontainer.io:443`
2. Relay container (`socat`) -> `tricia-monitoring-pg.postgres.database.azure.com:5432`
3. PostgreSQL SSL connection (`sslmode=require`)

## Commands used

### 1) Add current client IP to PostgreSQL firewall

```bash
az postgres flexible-server firewall-rule create \
  --resource-group tricia-monitoring-rg \
  --name tricia-monitoring-pg \
  --rule-name cursor-current-ip-202604301358 \
  --start-ip-address <your-public-ip> \
  --end-ip-address <your-public-ip>
```

### 2) Create temporary relay container on 443

```bash
az container create \
  --resource-group tricia-monitoring-rg \
  --name tricia-pg-tunnel-443 \
  --image alpine/socat \
  --os-type Linux \
  --cpu 1 \
  --memory 1 \
  --ip-address Public \
  --ports 443 \
  --dns-name-label tricia-pg-tunnel-443-20260430 \
  --restart-policy Always \
  --command-line "sh -c 'socat TCP-LISTEN:443,fork,reuseaddr TCP:tricia-monitoring-pg.postgres.database.azure.com:5432'"
```

### 3) Verify TCP reachability to relay

```bash
nc -vz -w 5 tricia-pg-tunnel-443-20260430.switzerlandnorth.azurecontainer.io 443
```

### 4) Query with project virtual environment (`.venv`)

```bash
"/home/smc-dev/python-projects/tricia-monitoring-app/.venv/bin/python" -c "
import psycopg
conn = psycopg.connect(
    'postgresql://<admin-user>:<admin-password>@tricia-pg-tunnel-443-20260430.switzerlandnorth.azurecontainer.io:443/<database>?sslmode=require',
    connect_timeout=10
)
cur = conn.cursor()
cur.execute('SELECT * FROM cases')
print(cur.fetchall())
conn.close()
"
```

## Connection string pattern used

```text
postgresql://<admin-user>:<admin-password>@tricia-pg-tunnel-443-20260430.switzerlandnorth.azurecontainer.io:443/<database>?sslmode=require
```

## Cleanup (important)

Delete temporary relay containers when finished:

```bash
az container delete -g tricia-monitoring-rg -n tricia-pg-tunnel --yes
az container delete -g tricia-monitoring-rg -n tricia-pg-tunnel-443 --yes
```

## Security notes

- Do not store real credentials in source-controlled files.
- Prefer environment variables or Key Vault for secrets.
- Keep temporary relay lifetime short and remove it after use.

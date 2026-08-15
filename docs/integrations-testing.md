# Running the integration tests

The `packages/graph` and `packages/integrations` suites talk to a real
Postgres. Start it before running them:

```bash
docker compose up -d
npm test -- packages/integrations
```

Without it the suites fail on connection timeouts rather than on anything
to do with the code under test.

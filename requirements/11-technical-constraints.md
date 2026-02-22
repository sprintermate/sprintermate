# 11. Technical Constraints & Notes

## Todo / Open Items

- [ ] Azure DevOps API rate limiting management (especially during bulk estimation)
- [ ] OAuth access token auto-renewal middleware (background refresh before expiry)
- [ ] PAT token encryption (AES-256-GCM)
- [ ] OAuth app registration environment variable references (`ADO_OAUTH_CLIENT_ID`, `ADO_OAUTH_CLIENT_SECRET`, `ADO_TOKEN_ENCRYPTION_KEY`)
- [ ] WebSocket reconnection strategy for dropped connections
- [ ] Queue system for AI bulk estimation — prevent too many concurrent requests
- [ ] Responsive design (for mobile participants)
- [ ] Work item caching (avoid redundant requests to Azure DevOps)
- [ ] Unit tests: mock tests for AI provider interface implementations

---

## Security Requirements

- [ ] OAuth access token and refresh token are never sent to the client side; all ADO calls are made server-side.
- [ ] The OAuth `state` parameter is regenerated on every authorization request (CSRF protection).
- [ ] Session cookie is set with `httpOnly; Secure; SameSite=Strict` flags.
- [ ] Tokens are stored encrypted in Redis using AES-256-GCM; plaintext is never written to any store.
- [ ] Room codes are generated using `crypto.randomBytes` to prevent guessing.
- [ ] User identity is verified on all WebSocket events.

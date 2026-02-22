# 2. Azure DevOps Authentication & URL Management

## 2.1 OAuth 2.0 Authentication

### Application Registration

- [ ] An OAuth application is registered on Azure DevOps: `https://app.vsaex.visualstudio.com/app/register`
- [ ] The following details are defined during registration:
  - **Application Name**: Scrum Poker
  - **Authorization callback URL**: `{APP_BASE_URL}/api/auth/ado/callback`
  - **Authorized scopes**: `vso.work`, `vso.work_write`, `vso.project`, `vso.profile`
- [ ] The resulting `App ID` and `Client Secret` are stored as environment variables (`ADO_OAUTH_CLIENT_ID`, `ADO_OAUTH_CLIENT_SECRET`).

---

### Authorization Code Flow

- [ ] The authorization flow starts when the user clicks the "Sign in with Azure DevOps" button.
- [ ] A `state` parameter is generated server-side (using `crypto.randomBytes(16)`) for CSRF protection.
- [ ] The user is redirected to:
  ```
  https://app.vssps.visualstudio.com/oauth2/authorize
    ?client_id={ADO_OAUTH_CLIENT_ID}
    &response_type=Assertion
    &scope=vso.work vso.work_write vso.project vso.profile
    &redirect_uri={APP_BASE_URL}/api/auth/ado/callback
    &state={state}
  ```
- [ ] After the user grants permission, the browser returns to the callback URL with `code` and `state` query parameters.
- [ ] The `state` parameter is validated; the flow is aborted if it does not match.

---

### Token Retrieval & Refresh

- [ ] `GET /api/auth/ado/callback` route:
  - [ ] Sends a `POST` request to `https://app.vssps.visualstudio.com/oauth2/token` with the `code` parameter.
  - [ ] Request body (form-encoded):
    ```
    client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
    client_assertion={CLIENT_SECRET}
    grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
    assertion={code}
    redirect_uri={APP_BASE_URL}/api/auth/ado/callback
    ```
  - [ ] On success, the response contains `access_token`, `refresh_token`, and `expires_in`.
  - [ ] Tokens are stored **server-side only**; raw tokens are never sent to the client.
  - [ ] A session identifier is set as an `httpOnly; Secure; SameSite=Strict` cookie.
- [ ] When the access token expires (`expires_in`), it is automatically renewed using the `refresh_token`.
- [ ] If the refresh token is invalid (revoked or expired), the user is redirected back to the login screen.

---

### Session Management

- [ ] `GET /api/auth/ado/me` — Returns the profile of the authenticated user (`displayName`, `emailAddress`, `id`).
- [ ] `POST /api/auth/ado/logout` — Terminates the session, removes the token from Redis, and clears the cookie.
- [ ] All server-side routes that call the ADO API return `401` without a valid session.
- [ ] The Next.js middleware (`middleware.ts`) redirects unauthenticated access to protected routes (`/room/*`, `/create-room`, etc.) to `/login`.

---

### UI Flow

- [ ] If no session exists when the app is first opened, the user is redirected to `/login`.
- [ ] The `/login` page contains only the "Sign in with Azure DevOps" button.
- [ ] After a successful login, the user is redirected to the home page (`/`).
- [ ] The header/navbar displays the username and a "Sign Out" button.

---

## 2.2 Project Configurations

- [ ] The user can add multiple projects; each project is identified by a separate URL.
- [ ] Projects are stored in `localStorage` or a server-side persistent store.
- [ ] PAT (Personal Access Token) is supported as an alternative to OAuth; if PAT is chosen, it is stored encrypted.
- [ ] Project configurations can be edited and deleted.

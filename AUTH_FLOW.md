# Unstable Forge — Authentication Flow

## 1. Login API

**Endpoint:** `POST /api/auth/login`

**Purpose:** Authenticate an existing user and issue a JWT.

### Request Body

```json
{
  "email": "alex@example.com",
  "password": "StrongPass123"
}
```

### Authentication Process

1. Validate the request body.
2. Find the user using their email.
3. Compare the submitted password with the stored bcrypt hash.
4. Reject invalid credentials.
5. Generate a signed JWT for successful authentication.
6. Return the token and safe user information.

## 2. JWT Configuration

- Use a strong secret stored in environment variables.
- Set an expiration time.
- Include the user's ID in the token payload.
- Never include passwords or password hashes.
- Verify the token on protected routes.

## 3. Protected Routes

Protected endpoints must require a valid JWT.

Example:

`GET /api/users/me`

Expected behavior:
- No token: `401 Unauthorized`
- Invalid or expired token: `401 Unauthorized`
- Valid token: return the authenticated user's profile.

## 4. Security Checklist

- [ ] Password comparison uses bcrypt.
- [ ] JWT secret is stored in `.env`.
- [ ] `.env` is excluded from Git.
- [ ] Tokens have an expiration time.
- [ ] Protected routes verify JWT signatures.
- [ ] User passwords are never returned in responses.
- [ ] Invalid credentials return a generic error.

## 5. Expected API Responses

| Status | Meaning |
|---|---|
| 200 | Login successful |
| 400 | Invalid request |
| 401 | Invalid credentials or token |
| 500 | Internal server error |

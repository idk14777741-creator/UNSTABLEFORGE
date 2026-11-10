# Unstable Forge — Authentication API

## 1. User Signup

**Endpoint:** `POST /api/auth/signup`

**Purpose:** Register a new participant on Unstable Forge.

### Request Body

```json
{
  "name": "Alex",
  "email": "alex@example.com",
  "password": "StrongPass123",
  "campus": "ALTA Jaipur"
}
```

### Validation Rules

- Name is required.
- Email must be valid and unique.
- Password must contain at least 8 characters.
- Campus is required.
- Passwords must be hashed before database storage.

### Expected Responses

| Status | Meaning |
|---|---|
| 201 | Account created |
| 400 | Invalid input |
| 409 | Email already registered |
| 500 | Internal server error |

### Security Requirements

- Never store plaintext passwords.
- Hash passwords using bcrypt.
- Never return password hashes in API responses.
- Validate input on the backend.

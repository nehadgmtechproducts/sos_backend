# SOS Emergency API

## Setup

1. Copy `.env.example` to `.env` and replace the JWT and OTP secrets.
2. Run `npm run dev`.

The API uses PostgreSQL. Import `database/schema.sql` into the selected
database, then set `DATABASE_URL` in `.env`, for example
`postgresql://postgres:your-password@localhost:5433/SOSdb`.

## API flow

Authenticate all routes below with `Authorization: Bearer <accessToken>` from
the existing `POST /api/v1/auth/otp/verify` endpoint.

## Firebase OTP push setup

1. In Firebase Console, open **Project settings → Service accounts** and create
   a new private key JSON file.
2. For local development, keep the ignored key file beside `package.json` and
   set `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`.
3. For a deployed server, do **not** commit the key file. Store its complete
   contents as the hosting platform's protected `FIREBASE_SERVICE_ACCOUNT_JSON`
   secret (recommended), or mount it as a protected file and set
   `FIREBASE_SERVICE_ACCOUNT_PATH` to that server-side path.
3. The Flutter app must obtain `FirebaseMessaging.instance.getToken()` and send
   it as `fcmToken` in `POST /api/v1/auth/otp/request`.

When `fcmToken` is provided, the backend sends the OTP in a Firebase Cloud
Messaging notification. FCM is best-effort, so use SMS as the production
fallback for account verification.

| UI screen | Endpoint |
| --- | --- |
| User details / view profile | `GET /api/v1/users/me` |
| Save profile | `PUT /api/v1/users/me` with `{ "name", "email" }` |
| Permanently delete profile and account data | `DELETE /api/v1/users/me` |
| Contacts list / detail | `GET /api/v1/contacts`, `GET /api/v1/contacts/:contactId` |
| Add a contact manually | `POST /api/v1/contacts` with `{ "name", "phone" }` |
| Edit / remove contact | `PATCH /api/v1/contacts/:contactId`, `DELETE /api/v1/contacts/:contactId` |
| SOS press-and-hold | `POST /api/v1/sos/activate` with optional `{ "latitude", "longitude", "accuracy", "message" }` |
| SOS history / finish event | `GET /api/v1/sos/history`, `POST /api/v1/sos/:activationId/resolve` |

`POST /api/v1/sos/activate` rejects requests without an emergency contact and
returns the recipient list. Connect its integration hook to your SMS, call,
alarm, and location-sharing provider before using it for real emergencies.

## Logout

`POST /api/v1/auth/logout` with `Authorization: Bearer <accessToken>` returns `204` and revokes that token. Further authenticated requests using it return `401`. Other sessions remain active. Revocations persist in PostgreSQL; startup creates the required table automatically.

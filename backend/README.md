# Backend setup

1. Copy `.env.example` to `.env` and set `MONGO_URI`, a private `JWT_SECRET` of at least 32 characters, and `ADMIN_PASSWORD`.
2. Install dependencies with `npm install`.
3. Create or update the admin account with `npm run seed:admin`.
4. Start the API with `npm start`.

The seed command uses `admin@tayonx.com` by default. Override it with `ADMIN_EMAIL` if needed. Passwords are hashed before they are stored; the seed command never prints the password.

The frontend signs in through `POST /api/auth/login` and validates sessions through `GET /api/auth/me`. Set `VITE_API_URL` in the frontend environment if the API is not at `http://localhost:5000`.

## Shipping request and offer API

All `/api/requests` endpoints require a bearer token from the login response. Requests and offers are stored in MongoDB in `ShippingRequest` documents; customers can only manage their own requests, providers can only manage their own offers, and admins can moderate all requests and offers.

| Method | Path | Access | Purpose |
|---|---|---|---|
| `GET` | `/api/requests` | Customer, provider, admin | List owned requests, open provider opportunities, or all requests for admins |
| `POST` | `/api/requests` | Customer | Create a shipping request |
| `GET` | `/api/requests/:id` | Authenticated | Read request details |
| `PUT` / `DELETE` | `/api/requests/:id` | Owner or admin | Edit or delete a request |
| `PATCH` | `/api/requests/:id/status` | Owner, assigned provider, admin | Cancel a request or advance shipment status |
| `POST` | `/api/requests/:id/decline` | Provider | Hide an opportunity from that provider |
| `POST` | `/api/requests/:id/offers` | Provider | Submit a quote |
| `GET` | `/api/requests/offers` | Customer, provider, admin | List visible offers |
| `PUT` / `DELETE` | `/api/requests/offers/:offerId` | Offer owner or admin | Edit or delete a pending quote |
| `PATCH` | `/api/requests/offers/:offerId/status` | Request owner or admin | Accept or decline a quote |

Request fields are `product`, `sourceCountry`, `destination`, `quantity`, and optional `details`. Offer fields are `price`, `deliveryDays`, and optional `includes`. Shipment statuses progress through `open`, `offers_received`, `in_progress`, `purchased`, `shipping`, and `delivered`; a customer may cancel before delivery. Only the assigned provider can advance an accepted shipment.

## Admin user management API

All `/api/users` endpoints require a bearer token belonging to an administrator. The routes read and update the `User` collection in MongoDB.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/users` | List registered accounts without returning password hashes |
| `POST` | `/api/users` | Create an account with a name, email, password, country, and role |
| `PUT` | `/api/users/:id` | Update supplied account fields; a password is optional |
| `DELETE` | `/api/users/:id` | Delete an account |

The admin create form supports the `customer`, `cargo_provider`, and `individual_cargo` roles. Passwords must be at least 8 characters and are hashed with bcrypt before storage. Email addresses must be unique. Administrators can edit existing admin accounts, but cannot delete their own account, demote themselves, or remove/demote the last administrator. Invalid IDs and fields return `400`; duplicate emails return `409`; unauthenticated and unauthorized requests return `401` and `403`.

## Real-time chat

Chat history and contacts are stored in the MongoDB `Chat` collection. All chat API requests require an authenticated bearer token. Customers and cargo providers can message one another when an offer connects them on a shipping request; any account can also contact an administrator, and administrators can message users for support.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/chats/contacts` | List permitted counterparties and recent conversation previews |
| `GET` | `/api/chats/:userId` | Fetch the latest 200 messages with a permitted contact |

Socket.IO clients must authenticate the handshake with `auth: { token }`. Emit `send_message` with `{ recipientId, text }`; the server validates permission, persists the message, then broadcasts `receive_message` to both participants. The sender receives an acknowledgement containing `{ message }` or `{ error }`. Messages are trimmed and limited to 4,000 characters. Socket.IO shares the configured `FRONTEND_ORIGIN` CORS policy; in development the Vite `/socket.io` WebSocket proxy forwards to the API server.

Non-admin participants can report a permitted conversation with `POST /api/chats/:userId/report` and `{ reason, details }`. Reasons are `harassment`, `spam`, `fraud`, `inappropriate`, or `other`. Reports are stored in the `ChatReport` collection and duplicate open reports by the same reporter are rejected.

## Admin chat moderation and platform settings

All `/api/admin` routes require an admin bearer token.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/chats` | Return conversation summaries, message counts, latest messages, and all report records |
| `GET` | `/api/admin/chats/conversations/:firstUserId/:secondUserId` | Inspect up to 200 messages between two users |
| `PATCH` | `/api/admin/chats/reports/:reportId` | Set a report to `open`, `reviewed`, `resolved`, or `dismissed`; optionally include a `resolutionNote` |
| `GET` | `/api/admin/settings` | Read the persisted platform settings (creates database defaults on first read) |
| `PUT` | `/api/admin/settings` | Save `siteName`, `supportEmail`, `systemNotifications`, and `platformFeeRate` |

Settings are stored in the `PlatformSettings` collection as a single platform configuration document. Fee rates are percentages from 0 through 100. Saving these values persists platform configuration; transaction processing must read and apply the fee in its own service if/when payments are introduced.

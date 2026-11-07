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

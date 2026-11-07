# Backend setup

1. Copy `.env.example` to `.env` and set `MONGO_URI`, a private `JWT_SECRET` of at least 32 characters, and `ADMIN_PASSWORD`.
2. Install dependencies with `npm install`.
3. Create or update the admin account with `npm run seed:admin`.
4. Start the API with `npm start`.

The seed command uses `admin@tayonx.com` by default. Override it with `ADMIN_EMAIL` if needed. Passwords are hashed before they are stored; the seed command never prints the password.

The frontend signs in through `POST /api/auth/login` and validates sessions through `GET /api/auth/me`. Set `VITE_API_URL` in the frontend environment if the API is not at `http://localhost:5000`.

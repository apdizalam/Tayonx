<div align="center">

<img src="frontend/src/assets/tayonx-logo.png" alt="Tayonx logo" width="120" />

# Tayonx

**A shipping marketplace that connects customers with cargo providers.**

Customers post what they want shipped, cargo providers send price quotes, and both sides chat in real time until the order is delivered.

<p>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/Node.js-Express_5-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js and Express 5" />
  <img src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Socket.IO-realtime-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO" />
</p>

</div>

---

## ✨ Features

**For customers**
- Create, edit, cancel and delete shipping requests (product, source country, destination, quantity, details)
- Compare quotes from cargo providers and accept or decline them
- Track each shipment: `open` → `offers_received` → `in_progress` → `purchased` → `shipping` → `delivered`

**For cargo providers** (companies and individuals)
- Browse open shipping opportunities and decline ones you don't want
- Send quotes with a price, delivery time and what is included
- Update the shipment status after a quote is accepted

**For everyone**
- Real-time chat between customers and providers connected by an offer, plus support chat with admins
- Report a conversation for harassment, spam, fraud or inappropriate content

**For admins**
- Manage user accounts (create, edit, delete) with safety rules: the last admin can't be removed
- Moderate chats: read conversations and review, resolve or dismiss reports
- Platform settings: site name, support email, notifications and platform fee rate

---

## 🛠️ Tech Stack

| Part | Technologies |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, Socket.IO client, Oxlint |
| Backend | Node.js, Express 5, Socket.IO, JSON Web Tokens, bcryptjs |
| Database | MongoDB (Mongoose) |

---

## 📁 Project Structure

```
Tayonx/
├── backend/
│   ├── middleware/      # JWT authentication
│   ├── models/          # User, ShippingRequest, Chat, ChatReport, PlatformSettings
│   ├── routes/          # auth, requests, users, chats, admin
│   ├── socket.js        # real-time chat events
│   ├── seedAdmin.js     # creates the admin account
│   └── server.js        # Express + Socket.IO server
└── frontend/
    └── src/
        ├── components/  # Chat, AdminChats, AdminSettings, DashboardWorkspace
        ├── pages/       # Login, Register, admin / customer / cargo dashboards
        ├── lib/api.js   # API client
        └── socket.js    # Socket.IO client
```

---

## 🚀 Getting Started

### Requirements
- [Node.js](https://nodejs.org/) 20 or newer
- A MongoDB database (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Clone the project

```bash
git clone https://github.com/apdizalam/Tayonx.git
cd Tayonx
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and fill in your own values:

| Variable | What it is |
|---|---|
| `PORT` | API port (default `5000`) |
| `MONGO_URI` | Your MongoDB connection string |
| `JWT_SECRET` | A random secret, at least 32 characters |
| `FRONTEND_ORIGIN` | Frontend URL allowed by CORS (default `http://localhost:5173`) |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | The admin account created by the seed script |

Create the admin account, then start the API:

```bash
npm run seed:admin
npm run dev
```

The API runs at `http://localhost:5000`.

### 3. Set up the frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. In development, Vite forwards `/api` and `/socket.io` to the backend automatically. If your API runs somewhere else, set `VITE_API_URL`.

---

## 👥 User Roles

| Role | Dashboard | Can do |
|---|---|---|
| `customer` | `/customer/dashboard` | Post shipping requests, accept quotes, chat |
| `cargo_provider` | `/cargo/dashboard` | Send quotes, update shipments, chat |
| `individual_cargo` | `/cargo/dashboard` | Same as a cargo provider, for individuals |
| `admin` | `/admin/dashboard` | Manage users, moderate chats, change settings |

---

## 🔌 API Overview

| Area | Base path | Description |
|---|---|---|
| Auth | `/api/auth` | Register, log in, get the current user |
| Requests & offers | `/api/requests` | Shipping requests, quotes and shipment status |
| Users | `/api/users` | Admin user management |
| Chats | `/api/chats` | Contacts, message history and reports |
| Admin | `/api/admin` | Chat moderation and platform settings |

Every endpoint except register and login needs a `Bearer` token. See **[backend/README.md](backend/README.md)** for the full API reference and the Socket.IO events.

---

## 👤 Author

**Abdisalam Mohamed**: [GitHub](https://github.com/apdizalam) · [LinkedIn](https://www.linkedin.com/in/abdisalam-m-muhumed-4b6351307) · [Email](mailto:apdizalammohameth@gmail.com)

# Computer Inventory System

A web-based IT asset management platform for tracking computer hardware, peripherals, and their lifecycle.

## Tech Stack
- **Backend**: Node.js + Express.js
- **Views**: Handlebars (HBS) — server-side rendering
- **Database**: MongoDB + Mongoose
- **Auth**: JWT (httpOnly cookie for UI, Bearer token for API) + API Key support
- **File Uploads**: Multer (local filesystem)
- **Security**: CORS, Rate-limiting (20 req/min), bcrypt, RBAC, Morgan audit logging

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, etc.
```

### 3. Seed the database (creates admin user + sample data)
```bash
npm run seed
```
Default admin: **username** `admin` | **password** `Admin@123!`

### 4. Start the server
```bash
npm run dev        # development (nodemon)
npm start          # production
```

Visit **http://localhost:3000** and log in.

---

## API Endpoints

| Method | Endpoint | Protection | Description |
|--------|----------|-----------|-------------|
| POST | `/api/auth/login` | Public | Get JWT token |
| POST | `/api/users` | JWT (Admin) | Create user |
| PATCH | `/api/users/:id/role` | JWT (Admin) | Update role |
| PATCH | `/api/users/:id/status` | JWT (Admin) | Enable/Disable user |
| POST | `/api/keys` | JWT (Admin) | Generate API key |
| GET | `/api/keys` | JWT (Admin) | List API keys |
| DELETE | `/api/keys/:id` | JWT (Admin) | Revoke API key |
| GET | `/api/items` | JWT or API Key | List items |
| GET | `/api/items/:id` | JWT or API Key | Get item |
| GET | `/api/items/:id/history` | JWT | Item transaction history |
| POST | `/api/items` | JWT | Create item |
| PUT | `/api/items/:id` | JWT | Update item |
| DELETE | `/api/items/:id` | JWT (Admin) | Soft-delete item |
| POST | `/api/transactions/checkout` | JWT (multipart) | Check out item |
| POST | `/api/transactions/checkin` | JWT (multipart) | Check in item |

### Example API usage
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123!"}'

# List items with JWT
curl http://localhost:3000/api/items \
  -H "Authorization: Bearer <token>"

# List items with API Key
curl http://localhost:3000/api/items \
  -H "x-api-key: <api-key>"
```

---

## UI Pages

| Path | Description |
|------|-------------|
| `/login` | Login page |
| `/dashboard` | Overview + recent activity |
| `/items` | Inventory list with search/filter |
| `/items/new` | Add new item |
| `/items/:id/edit` | Edit item |
| `/items/:id/history` | Item transaction timeline |
| `/transactions` | Check-out / Check-in forms |
| `/reports` | Status summary, aging, user audit |
| `/users` | User management (Admin only) |
| `/keys` | API key management (Admin only) |

---

## Roles

| Feature | Admin | Technician |
|---------|-------|-----------|
| View inventory | ✅ | ✅ |
| Add/Edit items | ✅ | ✅ |
| Delete items (soft) | ✅ | ❌ |
| Check in/out | ✅ | ✅ |
| View reports | ✅ | ✅ |
| Manage users | ✅ | ❌ |
| Manage API keys | ✅ | ❌ |

---

## Deployment

1. Set `NODE_ENV=production` and a strong `JWT_SECRET` + `SESSION_SECRET` in environment variables.
2. Set `APP_URL` to your production domain (used for CORS).
3. Connect to a production MongoDB instance (e.g., MongoDB Atlas).
4. Push to your cloud platform (Render, Railway, etc.).

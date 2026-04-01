## Wilaya-Municipality Bridge (Backend)

### Requirements
- Node.js 20+ (works on newer versions too)
- PostgreSQL 13+

### Configure
1. Copy env file:

```bash
copy .env.example .env
```

2. Edit `DATABASE_URL` in `.env` to match your local Postgres credentials.

Example:

```text
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/wilaya_bridge
JWT_SECRET=change_me_in_production
```

### Install

```bash
npm install
```

### Migrate DB

```bash
npx sequelize db:migrate
```

### Run

```bash
npm run dev
```

API:
- Health: `GET /health`
- Static files: `GET /files/...` (storage root)


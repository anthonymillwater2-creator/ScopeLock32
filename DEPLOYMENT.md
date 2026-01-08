# ScopeLock V1 - Deployment Guide

## Quick Deploy to Vercel

### 1. Prerequisites

- GitHub repository
- Vercel account
- PostgreSQL database (Supabase, Neon, Railway, etc.)

### 2. Database Setup

Create a PostgreSQL database and get the connection string:

```
postgresql://user:password@host:5432/database
```

### 3. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Import your repository
2. Configure environment variables:

```env
DATABASE_URL=postgresql://...
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=ScopeLock <noreply@scopelock.com>
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
```

3. Deploy

### 4. Initialize Database

After first deploy, run migrations:

```bash
npx prisma generate
npx prisma db push
```

## Alternative: Docker Deployment

### Docker Compose

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: scopelock_v1
      POSTGRES_USER: scopelock
      POSTGRES_PASSWORD: changeme
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://scopelock:changeme@postgres:5432/scopelock_v1
      SMTP_HOST: smtp.example.com
      SMTP_PORT: 587
      SMTP_USER: your-email
      SMTP_PASS: your-password
      NEXT_PUBLIC_APP_URL: http://localhost:3000
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SMTP_HOST` | No | SMTP server hostname |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From email address |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of your app |

**Note**: SMTP is optional but recommended for email notifications.

## Post-Deployment

### Create First Editor

Visit your dashboard and create an editor account using the "Create Editor" button.

### Test the System

1. Create a test project
2. Generate a review link
3. Open the link in a private browser window
4. Test the full workflow

## Monitoring

Check logs in Vercel dashboard or via CLI:

```bash
vercel logs
```

## Troubleshooting

### Database Connection Issues

- Verify DATABASE_URL is correct
- Check database is accessible from Vercel
- Ensure SSL mode is configured if required

### Email Not Sending

- Verify SMTP credentials
- Check SMTP port and security settings
- Test with a known working SMTP server

### Build Failures

- Clear `.next` directory: `rm -rf .next`
- Regenerate Prisma client: `npx prisma generate`
- Check Node.js version (18+)

## Production Checklist

- [ ] Database backups configured
- [ ] Environment variables set
- [ ] SMTP configured for emails
- [ ] SSL/TLS enabled
- [ ] Custom domain configured
- [ ] Error monitoring enabled
- [ ] Run acceptance tests
- [ ] Create first editor account
- [ ] Test full client workflow

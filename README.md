# ScopeLock V1

A timestamped video revision + scope-enforcement portal for short-form editors.

## Overview

ScopeLock V1 is a **SERVICE-BUSINESS TOOL** for managing video revision workflows with automated scope enforcement and revision cap management.

### Core Features

- **Magic Link Access**: Clients review videos without login via secure tokens
- **Revision Round Management**: Track and enforce revision caps automatically
- **Server-Side Scope Enforcement**: Automatic classification of client requests
- **Editor Dashboard**: Manage projects, upload videos, override scope
- **State Machine**: Projects flow through draft → in_review → awaiting_approval → approved
- **Immutable Approval**: Once approved, projects are locked permanently

## Architecture

**Single Next.js App** with:
- App Router (Next.js 15)
- Prisma + PostgreSQL
- API routes with server-side enforcement
- No microservices, no background jobs

## Hard Constraints

### Business Rules

1. **State Machine**: Projects must flow through defined states; `approved` is terminal
2. **One Open Round**: Maximum one open revision round per project at any time
3. **Revision Consumption**: Only "Submit Notes" consumes a revision round (not opening or adding notes)
4. **Revision Caps**: Submitting beyond `revision_cap` is blocked at DB + API level
5. **Approval Guards**: Cannot approve with open revision round
6. **Immutability After Approval**: All writes blocked after approval

### Scope Enforcement (Server-Side Only)

```
IF request_type ∈ allowed_request_types AND client_marked_new_idea = false
  → scope_status = in_scope
ELSE
  → scope_status = additional_request
```

Editors may override with required reason (auditable and immutable).

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Installation

```bash
npm install
```

### Environment Variables

Create `.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/scopelock_v1"

SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="your-email@example.com"
SMTP_PASS="your-password"
SMTP_FROM="ScopeLock <noreply@scopelock.com>"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Database Setup

```bash
npx prisma generate
npx prisma db push
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Usage

### Editor Workflow

1. **Create Project**: Define package tier, revision cap, allowed request types
2. **Upload Video**: Provide external video URL (V1 uses URLs only, no file hosting)
3. **Generate Review Link**: Create magic link for client
4. **Review Notes**: View auto-generated task list with scope badges
5. **Override Scope**: Change classification with required reason
6. **Upload New Version**: Closes open round, sends approval request

### Client Workflow

1. **Access via Magic Link**: No login required
2. **Review Video**: Watch current version
3. **Open Revision Round**: Start adding timestamped notes
4. **Add Notes**: Multiple notes with timestamps, request types
5. **Submit Notes**: Consumes 1 revision round
6. **Approve Project**: Locks project permanently

## Email Notifications

Status-based only (no per-note emails, no reminders):

1. Version uploaded → Client review link
2. Revision submitted → Editor notification
3. Final revision used → Client warning
4. Updated version uploaded → Client approval request
5. Approved → Editor confirmation

## Testing

### Acceptance Gates

Run tests to verify all business rules:

```bash
npm test
```

**The build is WRONG if any of these fail:**

1. Client can open review link without login
2. Client can add multiple notes before submitting
3. Submitting notes consumes exactly 1 revision round
4. Submitting beyond revision_cap is blocked
5. Approving with an open revision round is blocked
6. After approval, ALL write actions return 403
7. Uploading new version closes open revision round
8. Scope enforcement runs server-side only
9. Override requires a reason and is logged
10. Regenerating a link revokes the old token immediately

## API Routes

### Client (Magic Link)

- `GET /api/review/[token]` - Get project by token
- `POST /api/review/[token]/round` - Open/submit revision round
- `POST /api/review/[token]/notes` - Add note
- `POST /api/review/[token]/approve` - Approve project

### Editor

- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `GET /api/projects/[id]` - Get project details
- `POST /api/projects/[id]/video` - Upload video version
- `POST /api/projects/[id]/token` - Generate/regenerate token
- `POST /api/notes/[id]/override` - Override scope status

## Database Schema

### Models

- **editors**: Editor accounts
- **projects**: Video projects with state machine
- **review_tokens**: Magic link tokens
- **video_versions**: External video URLs
- **revision_rounds**: Batches of client feedback
- **notes**: Timestamped feedback with scope classification
- **activity_events**: Audit log

## What's NOT Included (V1)

- ❌ Payments or checkout
- ❌ White-label or custom domains
- ❌ Client accounts or logins
- ❌ AI summarization or suggestions
- ❌ Integrations (Slack, Trello, Drive)
- ❌ File hosting (use external URLs)
- ❌ Background jobs, queues, webhooks

## License

MIT

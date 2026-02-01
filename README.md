# RxLab Auth

A modern, full-featured authentication system built with Next.js 16 and React 19, featuring multiple authentication methods and comprehensive user management.

## Features

- 🔐 **Multiple Authentication Methods**
  - Email/Password authentication with secure Argon2 hashing
  - OAuth integration (configurable providers)
  - WebAuthn/Passkeys support for passwordless authentication
  
- 📧 **Email Services**
  - Email verification
  - Password reset functionality
  - Email notifications via Resend
  
- 👤 **User Management**
  - User registration and login
  - Account management dashboard
  - Admin panel for user administration
  - Profile customization with Identicon generation
  
- 🔒 **Security Features**
  - Iron Session for secure session management
  - JWT token support
  - Redis-based rate limiting via Upstash
  - Scope-based permissions system

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19
- **Database**: Drizzle ORM with libsql (Turso/SQLite)
- **Authentication**: SimpleWebAuthn, Iron Session, Jose (JWT)
- **UI Components**: shadcn/ui with base-vega style, built on @base-ui/react
- **Styling**: Tailwind CSS v4
- **Email**: Resend
- **Storage**: Vercel Blob
- **Cache/Rate Limiting**: Upstash Redis
- **Testing**: Playwright for E2E tests
- **Package Manager**: Bun

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed on your system
- A Turso database (or compatible libsql database)
- Redis instance (Upstash recommended)
- Resend API key for email functionality

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Database
TURSO_DATABASE_URL=your_turso_database_url
TURSO_AUTH_TOKEN=your_turso_auth_token

# Application
NEXT_PUBLIC_APP_NAME=RxLab Auth
NEXT_PUBLIC_APP_URL=http://localhost:3000

# JWT Keys (generate with openssl)
JWT_PRIVATE_KEY=your_jwt_private_key
JWT_PUBLIC_KEY=your_jwt_public_key

# Email
RESEND_API_KEY=your_resend_api_key

# OAuth (optional)
OAUTH_ISSUER_URL=your_oauth_issuer_url

# WebAuthn
WEBAUTHN_ORIGIN=http://localhost:3000
WEBAUTHN_RP_ID=localhost
WEBAUTHN_RP_NAME=RxLab Auth

# Redis
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/rxtech-lab/rxlab-auth.git
cd rxlab-auth
```

2. Install dependencies:
```bash
bun install
```

3. Set up the database:
```bash
# Generate migration files
bun db:generate

# Run migrations
bun db:migrate

# Or push schema directly (development)
bun db:push
```

4. Start the development server:
```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Development Commands

```bash
bun dev          # Start development server
bun build        # Build for production
bun start        # Start production server
bun lint         # Run ESLint

# Database commands
bun db:generate  # Generate Drizzle migrations
bun db:migrate   # Run migrations
bun db:push      # Push schema to database
bun db:studio    # Open Drizzle Studio
```

## Testing

### E2E Tests

```bash
bunx playwright test              # Run all E2E tests
bunx playwright test --ui         # Interactive UI mode
bunx playwright test e2e/admin    # Run specific test suite
bunx playwright test --debug      # Debug mode
```

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication routes (login, register, etc.)
│   ├── account/           # User account management
│   ├── admin/             # Admin panel
│   ├── api/               # API routes
│   └── oauth/             # OAuth integration
├── actions/               # Server actions
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── lib/                   # Utilities and configuration
│   ├── auth/             # Authentication logic
│   ├── db/               # Database schema and client
│   ├── email/            # Email templates and sending
│   ├── oauth/            # OAuth providers
│   ├── redis/            # Redis client and rate limiting
│   └── webauthn/         # WebAuthn/Passkeys logic
├── e2e/                   # Playwright E2E tests
└── public/                # Static assets
```

## Deploy on Vercel

The easiest way to deploy this app is to use the [Vercel Platform](https://vercel.com/new):

1. Push your code to a Git repository
2. Import the repository to Vercel
3. Configure your environment variables
4. Deploy!

Make sure to set up your database and configure all required environment variables before deploying.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team)
- [shadcn/ui](https://ui.shadcn.com)
- [SimpleWebAuthn](https://simplewebauthn.dev)
- [Tailwind CSS](https://tailwindcss.com)

## License

This project is private and proprietary.

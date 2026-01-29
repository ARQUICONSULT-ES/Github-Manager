# CENTRA - Technical Documentation

## Project Overview

**CENTRA** is a Next.js 16 application that manages Business Central applications, GitHub repositories, customers, tenants, and environments. It provides synchronization capabilities between Microsoft Business Central (BC) and GitHub with a PostgreSQL database.

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL with Prisma ORM 7.x
- **Authentication**: NextAuth.js 4.x with credential-based login + GitHub token integration
- **Styling**: Tailwind CSS 4.x
- **External APIs**: GitHub API v3, Business Central Admin API v2.28

---

## Folder Structure

```
Centra/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Authentication pages (login)
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── admin/                # Admin panel (user management)
│   │   ├── applications/         # BC Applications management
│   │   ├── customers/            # Customer management
│   │   ├── environments/         # BC Environments view
│   │   ├── installed-apps/       # Installed apps in environments
│   │   ├── repos/                # GitHub repositories view
│   │   └── settings/             # User settings
│   ├── api/                      # API Routes (REST endpoints)
│   │   ├── applications/         # CRUD + sync for applications
│   │   ├── auth/                 # NextAuth configuration
│   │   ├── customers/            # CRUD for customers
│   │   ├── environments/         # CRUD + sync for environments
│   │   ├── github/               # GitHub API proxy endpoints
│   │   ├── installedapps/        # CRUD + sync for installed apps
│   │   └── users/                # User management endpoints
│   └── generated/                # Prisma generated client
│       └── prisma/               # Auto-generated Prisma files
├── components/                   # Global React components
├── lib/                          # Core utilities
│   ├── auth-github.ts            # GitHub authentication helpers
│   ├── auth-permissions.ts       # Permission checking utilities
│   ├── github.ts                 # GitHub API client functions
│   └── prisma.ts                 # Prisma client singleton
├── modules/                      # Feature modules (domain-driven)
│   ├── admin/                    # Admin feature module
│   │   ├── components/           # Admin-specific components
│   │   ├── hooks/                # Admin custom hooks
│   │   └── types/                # Admin TypeScript types
│   ├── applications/             # Applications feature module
│   ├── customers/                # Customers feature module
│   │   ├── components/           # Customer UI components
│   │   ├── hooks/                # Custom hooks (useCustomers, etc.)
│   │   ├── pages/                # Page-level components
│   │   ├── services/             # API service functions
│   │   ├── types/                # TypeScript interfaces
│   │   └── utils/                # Utility functions
│   ├── repos/                    # GitHub repos feature module
│   └── shared/                   # Shared utilities across modules
├── prisma/
│   └── schema.prisma             # Database schema definition
├── scripts/                      # Utility scripts
├── types/                        # Global TypeScript definitions
│   ├── github.d.ts               # GitHub API types
│   └── next-auth.d.ts            # NextAuth type extensions
└── middleware.ts                 # Route protection middleware
```

### Module Pattern

Each feature module follows this structure:
```
modules/{feature}/
├── index.tsx                     # Main export / page component
├── components/                   # Feature-specific UI components
├── hooks/                        # Custom React hooks
├── services/                     # API calls and business logic
├── types/                        # TypeScript interfaces
└── utils/                        # Helper functions
```

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│    User     │──────<│   UserCustomer   │>──────│   Customer  │
│             │       │  (many-to-many)  │       │             │
└─────────────┘       └──────────────────┘       └──────┬──────┘
                                                        │ 1:N
                                                        ▼
                                                 ┌─────────────┐
                                                 │   Tenant    │
                                                 │ (Azure AD)  │
                                                 └──────┬──────┘
                                                        │ 1:N
                                                        ▼
                                                 ┌─────────────┐
                                                 │ Environment │
                                                 │    (BC)     │
                                                 └──────┬──────┘
                                                        │ 1:N
                                                        ▼
                                                 ┌─────────────┐
                                                 │ InstalledApp│
                                                 └─────────────┘

┌─────────────┐
│ Application │  (Standalone - synced from GitHub)
└─────────────┘
```

### Tables Description

#### `User`
Stores the users who can access the application. Each user has authentication credentials (email/password with bcrypt hashing) and a role that determines their permission level. Users can optionally link their GitHub account by storing a personal access token, which enables GitHub-related features like repository synchronization.

**Relationships**: Many-to-many with `Customer` via `UserCustomer`

---

#### `Customer`
Represents the client organizations that use Business Central. Each customer can have multiple Azure AD tenants associated with them. The table stores basic identification information and an optional logo image for display in the UI.

**Relationships**: 
- One-to-many with `Tenant`
- Many-to-many with `User` via `UserCustomer`

---

#### `UserCustomer` (Junction Table)
Controls access permissions by linking users to the customers they are allowed to view and manage. Admin users bypass this restriction and can access all customers. Regular users can only see data from customers explicitly assigned to them.

**Primary Key**: Composite (`userId`, `customerId`)

---

#### `Tenant`
Represents Azure AD tenants (Microsoft 365 organizations) that belong to a customer. Each tenant contains OAuth2 configuration for authenticating against the Business Central Admin API using the `client_credentials` grant. The table stores the Azure App Registration credentials and manages token lifecycle, including automatic refresh when tokens expire.

**Relationships**: 
- Many-to-one with `Customer`
- One-to-many with `Environment`

---

#### `Environment`
Stores Business Central environments that exist within each tenant. Environments are synchronized from the BC Admin API and can be either Production or Sandbox type. The table captures runtime information like BC version, platform version, status, and the web client URL for direct access to the environment.

**Primary Key**: Composite (`tenantId`, `name`)

**Relationships**: 
- Many-to-one with `Tenant`
- One-to-many with `InstalledApp`

---

#### `InstalledApp`
Tracks which Business Central extensions/applications are installed in each environment. This data is synchronized from BC and includes version information, publisher details, and installation state. Used to monitor what apps are deployed across customer environments and detect version discrepancies.

**Primary Key**: Composite (`tenantId`, `environmentName`, `id`)

**Relationships**: Many-to-one with `Environment`

---

#### `Application`
Master catalog of Business Central applications synchronized from GitHub repositories. When syncing, the system scans repositories for `app.json` files (the BC application manifest) and extracts application metadata. It also fetches the latest release information from GitHub Releases to track version history. This table acts as a central registry of available applications that can be cross-referenced with `InstalledApp` to identify update opportunities.

**Relationships**: None (standalone entity)

---

## Synchronization Flows

### 1. Business Central → Database (BC Sync)

#### Flow: Sync Environments
**Endpoint**: `POST /api/environments/sync-all`

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐
│   Frontend   │────>│  API Route  │────>│  Azure AD    │────>│ BC Admin │
│              │     │             │     │  (OAuth)     │     │   API    │
└──────────────┘     └──────┬──────┘     └──────────────┘     └────┬─────┘
                            │                                      │
                            │       ┌──────────────────────────────┘
                            │       │ environments list
                            ▼       ▼
                     ┌─────────────────┐
                     │   PostgreSQL    │
                     │   (upsert)      │
                     └─────────────────┘
```

**Process**:
1. Iterate through all tenants with valid OAuth configuration
2. For each tenant:
   - Check if token is valid (with 5-min buffer)
   - If expired, refresh token via Azure AD OAuth2 (`client_credentials` grant)
   - Call BC Admin API: `GET /admin/v2.28/applications/environments`
   - Use Prisma transaction to upsert environments
   - Soft-delete environments that no longer exist in BC

**Token Refresh Logic**:
```typescript
// Token is refreshed when:
// - No token exists
// - Token expires in less than 5 minutes
const needsRefresh = !token || !tokenExpiresAt || 
  (tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000);
```

---

#### Flow: Sync Installed Apps
**Endpoint**: `POST /api/installedapps/sync-all`

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌──────────┐
│   Frontend   │────>│  API Route  │────>│  Azure AD    │────>│ BC Admin │
│              │     │             │     │  (OAuth)     │     │   API    │
└──────────────┘     └──────┬──────┘     └──────────────┘     └────┬─────┘
                            │                                      │
                            │       ┌──────────────────────────────┘
                            │       │ apps per environment
                            ▼       ▼
                     ┌─────────────────┐
                     │   PostgreSQL    │
                     │   (upsert)      │
                     └─────────────────┘
```

**Process**:
1. Iterate through all tenants with valid OAuth configuration
2. For each tenant, get all environments
3. For each environment:
   - Ensure valid token (refresh if needed)
   - Call BC Admin API: `GET /admin/v2.28/applications/BusinessCentral/environments/{envName}/apps`
   - Use Prisma transaction to upsert installed apps
   - Delete apps that no longer exist in BC

---

### 2. GitHub → Database (GitHub Sync)

#### Flow: Sync Applications from GitHub
**Endpoint**: `POST /api/applications/sync-github`

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   Frontend   │────>│  API Route  │────>│  GitHub API  │
│              │     │             │     │              │
└──────────────┘     └──────┬──────┘     └──────┬───────┘
                            │                   │
                            │    ┌──────────────┘
                            │    │ repos + app.json + releases
                            ▼    ▼
                     ┌─────────────────┐
                     │   PostgreSQL    │
                     │   (upsert)      │
                     └─────────────────┘
```

**Process**:
1. **Authorization check**: Only ADMIN users can sync
2. **Get GitHub token** from cookies (set during GitHub OAuth)
3. **Fetch all user repositories** with pagination:
   - `GET /user/repos?per_page=100&page={n}&sort=updated`
4. For each repository:
   - Try to find `app.json` file (BC application manifest)
   - If found, extract: `id`, `name`, `publisher`
   - Try to fetch application logo (from path specified in `app.json` or default locations)
   - Fetch latest release from GitHub Releases API
   - Upsert application record in database

**App.json Detection Logic**:
```typescript
// app.json is searched in repository root
// It must contain: id, name, publisher
// Optional: version, brief, description, logo
```

---

## Authentication & Authorization

### Authentication Flow
1. User logs in via NextAuth credentials provider
2. Session contains user email and role
3. GitHub token is stored separately in cookies after GitHub OAuth

### Authorization Levels

| Permission | ADMIN (`allCustomers=true`) | USER (`allCustomers=false`) |
|------------|----------------------------|----------------------------|
| **View customers** | All customers | Only assigned customers via `UserCustomer` |
| **Create customers** | ✅ Yes (auto-visible) | ✅ Yes (auto-assigned to created customer) |
| **Edit customers** | ✅ All customers | Only assigned customers |
| **Delete customers** | ✅ All customers | Only assigned customers |
| **Sync operations** | ✅ Yes | ❌ No |
| **User management** | ✅ Yes | ❌ No |

**Key Points**:
- 🔓 **Any authenticated user** can create customers (not just admins)
- 🎯 **Non-admin users** are automatically assigned to customers they create
- 🔍 **Duplicate validation** checks ALL customers globally (regardless of user permissions)
- 👁️ **Viewing** customers remains filtered by user permissions

### Route Protection

**Middleware** (`middleware.ts`) protects these routes:
- `/customers/*`
- `/repos/*`
- `/environments/*`
- `/applications/*`
- `/admin/*`
- `/api/customers/*`
- `/api/installedapps/*`
- `/api/environments/*`
- `/api/github/*`
- `/api/users/*`

### Permission Helper

```typescript
// lib/auth-permissions.ts
const permissions = await getUserPermissions();
// Returns:
// - isAuthenticated: boolean
// - userId: string
// - canAccessRepos: boolean
// - canAccessCustomers: boolean
// - allCustomers: boolean (admin = true, user = false)
// - canAccessAdmin: boolean
// - allowedCustomerIds: string[] (empty array if allCustomers=true)
```

---

## API Endpoints Reference

### Applications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/applications` | List all applications |
| GET | `/api/applications/[id]` | Get application details |
| POST | `/api/applications` | Create application |
| PUT | `/api/applications/[id]` | Update application |
| DELETE | `/api/applications/[id]` | Delete application |
| POST | `/api/applications/sync-github` | Sync from GitHub |
| POST | `/api/applications/sync-all` | Sync all applications |

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List customers (filtered by user permissions) |
| GET | `/api/customers/[id]` | Get customer details |
| POST | `/api/customers` | Create customer (any authenticated user) |
| PUT | `/api/customers/[id]` | Update customer |
| DELETE | `/api/customers/[id]` | Delete customer |
| GET | `/api/customers/check-duplicate` | Check if customer name exists (global search) |
| GET | `/api/customers/tenants` | Get tenants for customer |

### Environments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/environments` | List all environments |
| POST | `/api/environments/sync-all` | Sync from BC |

### Installed Apps
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/installedapps` | List installed apps |
| POST | `/api/installedapps/sync-all` | Sync from BC |

### GitHub Proxy
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/github/repos` | List user repositories |
| GET | `/api/github/user` | Get authenticated user |
| GET | `/api/github/branches` | Get repository branches |
| GET | `/api/github/latest-release` | Get latest release |
| POST | `/api/github/trigger-workflow` | Trigger GitHub Action |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List all users (admin only) |
| GET | `/api/users/[id]` | Get user details |
| POST | `/api/users` | Create user |
| PUT | `/api/users/[id]` | Update user |
| DELETE | `/api/users/[id]` | Delete user |
| GET | `/api/users/me` | Get current user |

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# NextAuth
NEXTAUTH_SECRET=your-secret-key

# Business Central
BC_ADMIN_API_URL=https://api.businesscentral.dynamics.com/admin/v2.28/applications

# GitHub
GITHUB_CLIENT_ID=your-github-client-id             # OAuth para login de usuarios
GITHUB_CLIENT_SECRET=your-github-client-secret     # OAuth para login de usuarios
GITHUB_ADMIN_TOKEN=ghp_xxxxxxxxxxxxx              # Token admin para despliegues (necesita permisos: repo, read:packages)
```

---

## Development Guidelines

### Adding a New Feature Module

1. Create folder structure under `modules/{feature}/`
2. Define TypeScript types in `types/index.ts`
3. Create API services in `services/`
4. Implement UI components in `components/`
5. Add custom hooks in `hooks/`
6. Create API routes under `app/api/{feature}/`
7. Add page component under `app/(dashboard)/{feature}/`

### Database Migrations

```bash
# Generate Prisma client
npx prisma generate

# Apply migrations to production
npx prisma db push
```

### Sync Operations Best Practices

1. Always use Prisma transactions for bulk operations
2. Implement token refresh logic before BC API calls
3. Handle rate limiting from external APIs
4. Log sync results for debugging
5. Use soft-delete pattern for environments that disappear

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema definition |
| `lib/prisma.ts` | Prisma client singleton |
| `lib/auth-permissions.ts` | Permission checking utilities |
| `lib/github.ts` | GitHub API client |
| `middleware.ts` | Route protection |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth configuration |
| `modules/customers/types/index.ts` | Core type definitions |

# Supabase Integration Setup

This document describes the Supabase authentication setup for the LiveKit Meet application.

## Overview

The codebase is now configured with Supabase for B2B authentication using the modern `@supabase/ssr` package, which provides proper server-side rendering support for Next.js 15.

## Architecture

### Client Utilities (`/lib/supabase/`)

Three separate Supabase client creators for different contexts:

1. **`client.ts`** - Browser Client
   - For Client Components
   - Uses browser localStorage
   - Example: Sign in forms, user profile components

2. **`server.ts`** - Server Client
   - For Server Components, Server Actions, API Routes
   - Uses Next.js cookies (async)
   - Example: Protected pages, server-side data fetching

3. **`middleware.ts`** - Middleware Client
   - For session management across requests
   - Handles cookie updates and session refresh
   - Called by the root `middleware.ts`

### Middleware (`/middleware.ts`)

- Runs on every request (except static assets)
- Manages session cookies automatically
- Keeps user sessions alive
- Can be extended to redirect unauthenticated users

### API Routes (`/app/api/auth/`)

1. **`/api/auth/callback`** - OAuth callback handler
2. **`/api/auth/signout`** - Sign out endpoint
3. **README.md** - Documentation for future endpoints

## Environment Variables

Required variables in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Usage Examples

### Client Component (Browser)
```tsx
'use client'

import { createClient } from '@/lib/supabase/client'

export default function SignInButton() {
  const supabase = createClient()

  async function handleSignIn() {
    const { error } = await supabase.auth.signInWithPassword({
      email: 'user@example.com',
      password: 'password'
    })
  }

  return <button onClick={handleSignIn}>Sign In</button>
}
```

### Server Component
```tsx
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <div>Hello {user.email}</div>
}
```

### Server Action
```tsx
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
}
```

## Supabase MCP Server (Optional)

For enhanced database management capabilities with AI assistants, you can configure the Supabase MCP server.

### Configuration

Add to your MCP client configuration (e.g., Claude Desktop config):

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--read-only",
        "--project-ref=YOUR_PROJECT_REF"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "YOUR_ACCESS_TOKEN"
      }
    }
  }
}
```

### Get Your Project Ref
1. Go to your Supabase Dashboard
2. Settings > General
3. Copy the "Reference ID"

### Get Your Access Token
1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Copy the token

### MCP Server Capabilities

When configured, the MCP server provides:
- Database schema exploration
- SQL query execution
- Migration management
- TypeScript type generation
- Edge function deployment
- Project management

### Read-Only Mode

The `--read-only` flag restricts operations to prevent accidental writes. Remove it for full capabilities.

## Integration with LiveKit

This authentication layer is **separate** from LiveKit functionality:

- Supabase handles user authentication and B2B organization management
- LiveKit handles real-time video/audio communication
- LiveKit tokens are still generated via `/app/api/connection-details/route.ts`
- You can integrate them by adding Supabase user checks before generating LiveKit tokens

## Next Steps (Phase 2)

1. **Database Connection**: Connect to your actual Supabase database
2. **Authentication UI**: Build login, signup, and profile pages
3. **B2B Logic**: Implement organization/team management
4. **Role-Based Access**: Add role checks for teacher/student/admin
5. **Protected Routes**: Uncomment middleware redirect logic
6. **LiveKit Integration**: Add Supabase auth checks to LiveKit token generation

## Best Practices

### ✅ DO
- Use the appropriate client for each context (browser/server/middleware)
- Always check for users in protected routes
- Handle authentication errors gracefully
- Use Server Actions for mutations

### ❌ DON'T
- Mix client types (e.g., using browser client in Server Components)
- Add logic between `createServerClient` and `getUser()` calls
- Modify middleware cookies directly
- Store sensitive tokens in client-side code

## Troubleshooting

### Users Getting Logged Out Randomly
- Check middleware implementation - no logic between client creation and `getUser()`
- Ensure middleware is returning the `supabaseResponse` object correctly

### Session Not Persisting
- Verify environment variables are set correctly
- Check that middleware is running (matcher configuration)
- Ensure cookies are not being blocked by browser

### TypeScript Errors
- Run `pnpm install` to ensure all dependencies are installed
- Check that `@supabase/supabase-js` and `@supabase/ssr` are in package.json

## Resources

- [Supabase Next.js Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Supabase SSR Package](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase MCP Server](https://github.com/supabase-community/supabase-mcp)
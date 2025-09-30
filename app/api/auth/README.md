# Authentication API Routes

This directory contains API route handlers for Supabase authentication.

## Available Endpoints

### `/api/auth/callback`
- **Method**: GET
- **Purpose**: Handles OAuth callback redirects from authentication providers
- **Used For**: Google, GitHub, and other OAuth provider sign-ins
- **Auto-configured**: This endpoint is automatically used by Supabase when you set up OAuth providers

### `/api/auth/signout`
- **Method**: POST
- **Purpose**: Signs out the current user and clears their session
- **Usage**: Call from client components or server actions

## Future Endpoints (To be added in Phase 2)

When you're ready to add authentication UI, you'll likely add:

- `/api/auth/signin` - Email/password sign in
- `/api/auth/signup` - Email/password registration
- `/api/auth/reset-password` - Password reset initiation
- `/api/auth/update-password` - Password update handler

## Configuration

Make sure your Supabase project has the correct redirect URLs configured:

1. Go to your Supabase Dashboard
2. Navigate to Authentication > URL Configuration
3. Add your callback URL to "Redirect URLs":
   - Local: `http://localhost:3000/api/auth/callback`
   - Production: `https://yourdomain.com/api/auth/callback`

## Next Steps

Phase 2 will involve:
1. Creating login/signup UI components
2. Adding server actions for authentication
3. Connecting to your Supabase database
4. Implementing B2B authentication logic (organization management, role-based access, etc.)
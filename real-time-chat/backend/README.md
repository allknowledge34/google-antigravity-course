# Backend Application

## Tech Stack
- Node.js
- Express.js
- MongoDB & Mongoose
- Clerk (`@clerk/express`)
- Zod (Validation)
- Pino (Logging)
- Helmet, CORS, express-rate-limit (Security)

## Setup
1. Copy `.env.example` to `.env`
2. Configure Clerk keys in your `.env` file (you will need a Clerk account)
3. Run `npm install`
4. Run `npm run dev` to start the development server

## Required Environment Variables
See `.env.example` for details. You must configure:
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

## Authentication & User Synchronization Architecture
We use **Clerk** as the primary identity provider. Our Express application uses the `@clerk/express` SDK to verify authentication headers via middleware. 

When an authenticated request hits the backend (e.g. `/api/v1/users/me`), our `userService` intercepts the Clerk ID and synchronizes a local MongoDB `User` document. This local document stores app-specific profiles (username, displayName, bio) without needing to hit Clerk APIs for every request, and without duplicating password or token storage. Our internal relations use this local `clerkId`.

## API Endpoints
- `GET /api/v1/health`: API Health Check (Public)
- `GET /api/v1/users/me`: Get current authenticated user profile (Protected)
- `PATCH /api/v1/users/me`: Update editable profile fields (Protected)
- `GET /api/v1/users/search?q=query`: Search for users by username/displayName (Protected)

## Testing
Run `npm run test` (uses Vitest and mongodb-memory-server to mock database connections).

## Future Phases
- Socket.IO Real-time Messaging
- Cloudinary Integration for Media Uploads

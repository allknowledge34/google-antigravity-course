# Frontend Application

## Tech Stack
- React
- Vite
- React Router
- TanStack Query
- Zustand
- Axios
- Clerk (`@clerk/react`)

## Setup
1. Copy `.env.example` to `.env.local`
2. Configure `VITE_CLERK_PUBLISHABLE_KEY` with your Clerk Publishable Key
3. Run `npm install`
4. Run `npm run dev` to start the frontend application

## Required Environment Variables
- `VITE_API_URL`: Backend API URL (default: http://localhost:5000/api/v1)
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk Frontend Key

> **WARNING**: Never expose `CLERK_SECRET_KEY` or `CLOUDINARY_API_SECRET` to the frontend `.env`.

## Authentication Architecture
We use the official `@clerk/react` SDK to manage all client-side authentication states. `ClerkProvider` wraps our application, providing contexts like `useAuth()` to manage tokens. An Axios request interceptor dynamically injects the Clerk token into the `Authorization` header for all requests going to our backend. 

Local app state (like dark mode or UI toggles) is managed by **Zustand**. Server state (like the current user profile fetched from our backend) is managed and cached by **TanStack Query**.

## Testing
Run `npm run test` (uses Vitest, JSDOM, and React Testing Library).

## Future Phases
- WebSocket bindings
- Real-time chat interfaces
- Cloudinary avatar uploads

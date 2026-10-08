# Real-Time Chat Application

A production-grade real-time chat application built with Node.js, Express, React, Vite, MongoDB, and Redis.

## Architecture

- **Frontend**: React, Vite, Zustand, TanStack Query, Clerk, Socket.IO Client
- **Backend**: Node.js, Express, MongoDB/Mongoose, Redis, Socket.IO, Clerk Backend SDK
- **Infrastructure**: Docker, Docker Compose
- **Features**: Real-time messaging, group chats, delivery/read receipts, unread badges, presence, typing indicators, Cloudinary attachments, rate limiting.

## Prerequisites

- Node.js (v20+)
- Docker and Docker Compose
- MongoDB (if running locally without Docker)
- Redis (if running locally without Docker)
- Clerk account
- Cloudinary account

## Environment Setup

Create a `.env` file in the root directory by copying the provided example:

```bash
cp .env.example .env
```

Fill in the required values:
- `VITE_CLERK_PUBLISHABLE_KEY` (Browser-safe)
- `CLERK_PUBLISHABLE_KEY` (Backend requirement)
- `CLERK_SECRET_KEY` (Secret)
- `CLOUDINARY_*` keys (Secret)

> **Note**: Do NOT commit your `.env` file. Do NOT expose `CLERK_SECRET_KEY` or `CLOUDINARY_API_SECRET` to the frontend via `VITE_*`.

## Running in Production / Docker Compose

The simplest and most reproducible way to run the application is via Docker Compose. This completely encapsulates the frontend runtime, backend runtime, MongoDB database, and Redis cache.

### Build and Start

To build the images and start all services:

```bash
docker compose build
docker compose up -d
```

### Accessing the Application

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5001/api/v1/health](http://localhost:5001/api/v1/health)

### Internal Architecture

When running via Docker Compose:
- **MongoDB** is strictly internal and accessible via the `mongodb:27017` hostname. (Port 27017 is temporarily exposed for local inspection).
- **Redis** is strictly internal and accessible via the `redis:6379` hostname. (Port 6379 is temporarily exposed for local inspection).
- **Backend** runs as an unprivileged user in an Alpine container and connects automatically.
- **Frontend** is served as a statically built SPA using a lightweight Nginx container.

### Helpful Docker Commands

- View logs: `docker compose logs -f`
- Stop containers: `docker compose down`
- Rebuild containers after code changes: `docker compose up --build -d`
- Completely wipe all local database and cache data: `docker compose down -v`

## Running Locally for Development

To run the application locally outside of Docker for active development:

1. Start local MongoDB and Redis instances.
2. In the `backend` directory:
   ```bash
   npm i
   npm run dev
   ```
3. In the `frontend` directory:
   ```bash
   npm i
   npm run dev
   ```

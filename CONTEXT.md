# Meetup — Project Context

> A full-stack, real-time peer-to-peer video calling application built with React, Node.js, Socket.IO, WebRTC, Clerk Auth, and Neon PostgreSQL.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Environment Variables](#4-environment-variables)
5. [Architecture Overview](#5-architecture-overview)
6. [Authentication — Clerk](#6-authentication--clerk)
7. [API Routes](#7-api-routes)
8. [Database Schema](#8-database-schema)
9. [Socket.IO Events](#9-socketio-events)
10. [WebRTC Flow](#10-webrtc-flow)
11. [Client Pages & Components](#11-client-pages--components)
12. [Custom Hooks](#12-custom-hooks)
13. [Plan Limits & Business Logic](#13-plan-limits--business-logic)
14. [Data Flow Summary](#14-data-flow-summary)
15. [Known Issues / Notes](#15-known-issues--notes)

---

## 1. Project Overview

**Meetup** is a full-stack video calling web app where:
- Users **register/login** via Clerk (OAuth or email/password)
- Authenticated users can **create a meeting** (generates a shareable `abc-def-ghi` style ID)
- Other users can **join a meeting** by entering the ID
- Inside a room, all participants connect **peer-to-peer via WebRTC** for video/audio
- **Socket.IO** acts as the signaling server (relaying WebRTC offer/answer/ICE)
- **In-meeting chat** messages are broadcast via socket AND persisted to PostgreSQL
- After a meeting ends, full **session history** (participants + chat transcript) is viewable

---

## 2. Tech Stack

### Client (`/client`)

| Tool | Version | Purpose |
|---|---|---|
| React | 19.2.8 | UI framework |
| Vite | 8.2.0 | Build tool & dev server |
| React Router DOM | 7.18.2 | Client-side routing |
| Clerk React | 6.14.3 | Auth UI + session hooks |
| Axios | 1.19.0 | HTTP client (REST API calls) |
| Socket.IO Client | 4.8.3 | Real-time signaling connection |
| Tailwind CSS | 4.3.3 | Utility-first styling |
| Lucide React | 1.31.0 | Icon library |
| React Hot Toast | 2.6.0 | Toast notifications |
| oxlint | 1.75.0 | Linter (Rust-based, fast) |

### Server (`/server`)

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 20.9.0 | Runtime |
| Express | 5.2.1 | HTTP server framework |
| Socket.IO | 4.8.3 | WebSocket signaling server |
| @clerk/express | 2.1.61 | Server-side auth middleware |
| @neondatabase/serverless | 1.1.0 | Neon PostgreSQL driver (HTTP) |
| dotenv | 17.4.2 | Environment variable loader |
| cors | 2.8.6 | Cross-origin request handling |
| cookie-parser | 1.4.7 | Cookie middleware |
| nodemon | 3.1.14 | Dev auto-restart |

### External Services

| Service | Role |
|---|---|
| **Clerk** | Authentication, user management, plan/subscription tracking |
| **Neon PostgreSQL** | Serverless cloud database (ap-southeast-1 / Singapore) |
| **Google STUN Servers** | ICE candidate resolution for WebRTC NAT traversal |

---

## 3. Directory Structure

```
meetup/
├── client/                         # React frontend
│   ├── src/
│   │   ├── assets/
│   │   │   └── asset.js            # Dummy/fallback data constants
│   │   ├── components/
│   │   │   ├── meeting/
│   │   │   │   ├── ChatPanel.jsx       # Sliding chat drawer
│   │   │   │   ├── ControlBar.jsx      # Bottom toolbar (mic/cam/chat/leave)
│   │   │   │   ├── ParticipantList.jsx # Sidebar participant list
│   │   │   │   ├── VideoGrid.jsx       # Grid layout for video tiles
│   │   │   │   └── VideoTile.jsx       # Single participant video tile
│   │   │   ├── sessions/
│   │   │   │   ├── EmptySessions.jsx       # Empty state UI
│   │   │   │   ├── SessionCard.jsx         # Individual session card
│   │   │   │   ├── SessionChatTab.jsx      # Chat transcript tab
│   │   │   │   ├── SessionDetailModal.jsx  # Full session detail modal
│   │   │   │   └── SessionParticipantsTab.jsx
│   │   │   ├── Footer.jsx
│   │   │   ├── Loader.jsx              # Loading spinner
│   │   │   ├── Navbar.jsx
│   │   │   ├── Protectedlayout.jsx     # Layout wrapper with Navbar/Footer
│   │   │   └── ProtectedRoute.jsx      # Clerk auth guard
│   │   ├── config/
│   │   │   ├── api.js              # Axios instance + Clerk token interceptor
│   │   │   └── socket.js           # Socket.IO client singleton (autoConnect: false)
│   │   ├── hooks/
│   │   │   ├── useWebRTC.js        # All WebRTC + socket signaling logic
│   │   │   └── useChat.js          # Chat send/receive + unread count
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Home: create/join meeting + stats card
│   │   │   ├── Login.jsx           # Clerk login/register page
│   │   │   ├── MeetingRoom.jsx     # Full video call room
│   │   │   ├── Pricing.jsx         # Plan upgrade page
│   │   │   └── Sessions.jsx        # Past meeting history
│   │   ├── App.jsx                 # Route definitions
│   │   ├── main.jsx                # Entry point (ClerkProvider, BrowserRouter)
│   │   └── index.css
│   ├── .env                        # VITE_BASE_URL, VITE_CLERK_PUBLISHABLE_KEY
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                         # Express backend
│   ├── config/
│   │   └── db.js                   # Neon DB connection + table initialization
│   ├── controllers/
│   │   ├── meetingController.js    # All REST API logic (CRUD for meetings)
│   │   └── webhookController.js    # Clerk webhook → user upsert/delete in DB
│   ├── middleware/
│   │   └── auth.js                 # Clerk JWT verification + plan sync
│   ├── routes/
│   │   └── meetingRoutes.js        # Express router for /api/meetings
│   ├── socket.js                   # Socket.IO event handlers (signaling + chat)
│   ├── server.js                   # App entry point
│   ├── .env                        # DATABASE_URL, CLERK keys, ORIGINS
│   └── package.json
│
├── CONTEXT.md                      # This file
└── How to Run Project.pdf
```

---

## 4. Environment Variables

### `server/.env`

```env
ORIGINS="http://localhost:5173,http://localhost:3000"
DATABASE_URL='postgresql://<user>:<pass>@<host>-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

### `client/.env`

```env
VITE_BASE_URL="http://localhost:3000"
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

> **Note:** `VITE_` prefix is required for Vite to expose env vars to the browser bundle.

---

## 5. Architecture Overview

```
Browser (React)
    │
    ├─── REST API (Axios) ──────────────────────► Express Server (:3000)
    │         Bearer: Clerk JWT                        │
    │                                            ┌─────┴──────┐
    │                                       auth.js       meetingController.js
    │                                       middleware           │
    │                                            └─────┬──────┘
    │                                                  │
    │                                          Neon PostgreSQL
    │                                       (users, meetings,
    │                                        participants, messages)
    │
    ├─── Socket.IO ─────────────────────────────► Socket.IO Server
    │    (signaling: offer/answer/ICE,             socket.js
    │     chat, room events)                        │
    │                                          Neon PostgreSQL
    │                                       (messages persisted here)
    │
    └─── WebRTC P2P ◄──────────────────────────► Other Browser(s)
         (video/audio streams)                (direct, no server relay)
         via Google STUN servers
```

**Key principle:** The server **never handles video/audio data**. It only relays signaling messages. Once WebRTC is established, streams go peer-to-peer directly.

---

## 6. Authentication — Clerk

### How it works

1. `main.jsx` wraps the entire app in `<ClerkProvider publishableKey={...}>`
2. `ProtectedRoute.jsx` uses Clerk's `<SignedIn>` / `<SignedOut>` to guard private routes
3. On every REST API call, `api.js` (Axios interceptor) auto-attaches the Clerk JWT:
   ```js
   config.headers.Authorization = `Bearer ${token}` // from window.Clerk.session.getToken()
   ```
4. Server `auth.js` middleware calls `getAuth(req)` from `@clerk/express` to verify the token

### Plan Sync (auth.js middleware)
```js
const userActivePlan = auth.has({plan: "premium"}) ? "premium" : "free";
// Compare with DB plan — update if mismatch
if (userActivePlan !== userPlan) {
    await sql`UPDATE users SET plan = ${userActivePlan} WHERE id = ${userId}`
}
```
This ensures the DB plan always stays in sync with Clerk's subscription state on every API request.

### Webhook (webhookController.js)
Clerk fires webhooks to `POST /api/clerk` on:
- `user.created` → `INSERT INTO users ... ON CONFLICT DO UPDATE`
- `user.updated` → Update name/email/image
- `user.deleted` → `DELETE FROM users` (cascades to all meetings/participants/messages)

---

## 7. API Routes

All routes are prefixed with `/api/meetings` and protected by the `protect` middleware.

| Method | Path | Controller | Description |
|---|---|---|---|
| `POST` | `/api/meetings` | `createMeeting` | Create a new meeting |
| `GET` | `/api/meetings/stats` | `getMeetingStats` | Get user's plan + monthly usage |
| `GET` | `/api/meetings/sessions` | `getUserSessions` | All sessions (hosted + joined) |
| `GET` | `/api/meetings/sessions/:id` | `getSessionDetails` | Single session full detail |
| `GET` | `/api/meetings/:meetingId` | `getMeeting` | Verify meeting exists & active |
| `POST` | `/api/clerk` | `handleClerkWebhook` | Clerk webhook handler (public) |

> **Route ordering matters:** `/stats` and `/sessions` are registered before `/:meetingId` so they are matched first and not treated as meetingId params.

---

## 8. Database Schema

### `users`
Synced from Clerk via webhook. Primary key is Clerk's `userId` (VARCHAR, not SERIAL).

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR(255) PK | Clerk userId (e.g. `user_2xAbc...`) |
| `name` | VARCHAR(255) | Full name |
| `email` | VARCHAR(255) UNIQUE | Primary email |
| `image` | VARCHAR(500) | Avatar URL from Clerk |
| `plan` | VARCHAR(20) | `'free'` or `'premium'` — default `'free'` |
| `created_at` | TIMESTAMPTZ | Auto |
| `updated_at` | TIMESTAMPTZ | Updated by auth middleware & webhook |

### `meetings`
One row per meeting created. Has two IDs — internal (`id`) and public (`meeting_id`).

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | Internal FK used by participants/messages |
| `meeting_id` | VARCHAR(50) UNIQUE | Public shareable slug (`abc-def-ghi`) |
| `title` | VARCHAR(255) | Default: `'Instant Meeting'` |
| `host_id` | VARCHAR(255) FK → users.id | `ON DELETE CASCADE` |
| `status` | VARCHAR(20) | `'active'` or `'ended'` |
| `ended_at` | TIMESTAMPTZ | NULL until host ends meeting |
| `created_at` | TIMESTAMPTZ | Auto |

### `meeting_participants`
Every person who joined a meeting. `user_id` is nullable (anonymous guests allowed).

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `meeting_id` | INT FK → meetings.id | `ON DELETE CASCADE` |
| `user_id` | VARCHAR FK → users.id | `ON DELETE SET NULL` — nullable |
| `name` | VARCHAR(255) | Always stored even if user_id is null |
| `joined_at` | TIMESTAMPTZ | Auto |
| `left_at` | TIMESTAMPTZ | Not currently populated (future feature) |

### `meeting_messages`
Every chat message sent during a meeting. Persisted in real-time on each socket event.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `meeting_id` | INT FK → meetings.id | `ON DELETE CASCADE` |
| `sender_id` | VARCHAR FK → users.id | `ON DELETE SET NULL` — nullable |
| `sender_name` | VARCHAR(255) | Always stored |
| `text` | TEXT | Message content |
| `timestamp` | TIMESTAMPTZ | Auto |

### Cascade Behaviour
- Delete a **user** → their hosted meetings are deleted → participants & messages in those meetings are deleted
- Delete a **meeting** → all its participants and messages are deleted
- Delete a **user** who was a participant → `user_id` set to NULL (record kept)

---

## 9. Socket.IO Events

The socket server is set up in `server/socket.js`. Each socket tracks `currentRoomId` and `currentUser` in closure scope.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `join-room` | `{ roomId, user, audioEnabled, videoEnabled }` | Join a meeting room |
| `offer` | `{ targetSocketId, callerSocketId, sdp }` | WebRTC offer to a specific peer |
| `answer` | `{ targetSocketId, responderSocketId, sdp }` | WebRTC answer back to caller |
| `ice-candidate` | `{ targetSocketId, senderSocketId, candidate }` | ICE candidate exchange |
| `toggle-audio` | `{ roomId, audioEnabled }` | Notify others of mic state |
| `toggle-video` | `{ roomId, videoEnabled }` | Notify others of camera state |
| `send-message` | `{ roomId, message }` | Send a chat message |
| `end-meeting` | `{ roomId }` | Host ends meeting for all |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `all-users` | `existingUsers[]` | Sent to newcomer: list of current room participants |
| `user-joined` | `newUser` | Broadcast to room: a new user arrived |
| `offer` | `{ callerSocketId, sdp, callerUser }` | Relayed WebRTC offer |
| `answer` | `{ responderSocketId, sdp }` | Relayed WebRTC answer |
| `ice-candidate` | `{ senderSocketId, candidate }` | Relayed ICE candidate |
| `user-toggled-audio` | `{ socketId, audioEnabled }` | Broadcast mic state change |
| `user-toggled-video` | `{ socketId, videoEnabled }` | Broadcast camera state change |
| `receive-message` | `{ ...message, senderSocketId }` | Broadcast chat message to all |
| `user-left` | `{ socketId, user }` | Broadcast on disconnect |
| `meeting-ended` | `{ message }` | Sent when host ends meeting or meeting not found |

### In-Memory Room State
```js
const rooms = new Map();  // roomId → Map<socketId, participantObject>
```
This Map is used for real-time capacity enforcement and broadcasting. It is **not** persisted — it resets on server restart.

---

## 10. WebRTC Flow

### STUN Servers (ICE Config)
```js
const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
    ],
};
```

> **No TURN server configured.** This means in restrictive network environments (corporate firewalls, symmetric NAT), connections may fail. This is a known limitation.

### Signaling Sequence (New User Joining)

```
NewUser joins room
    ↓
Server sends "all-users" (existing participants) to NewUser
Server sends "user-joined" to existing participants

For EACH existing user:
    NewUser creates RTCPeerConnection
    NewUser creates offer → setLocalDescription
    NewUser emits "offer" to Server
    Server relays offer to ExistingUser

    ExistingUser: setRemoteDescription(offer) → createAnswer → setLocalDescription
    ExistingUser emits "answer" to Server
    Server relays answer to NewUser

    NewUser: setRemoteDescription(answer)

    Both sides exchange ICE candidates via Server
    ↓
    P2P video/audio stream established ✅
```

### Media Initialization
```js
// useWebRTC.js — tries video+audio, falls back to audio-only
const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
// On failure:
const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

---

## 11. Client Pages & Components

### Pages

| Page | Route | Description |
|---|---|---|
| `Login.jsx` | `/login`, `/register` | Clerk-powered auth UI |
| `Dashboard.jsx` | `/dashboard` | Create/join meetings; shows live clock, plan stats |
| `MeetingRoom.jsx` | `/meeting/:meetingId` | Full video call interface |
| `Sessions.jsx` | `/sessions` | Past meeting history with participant & chat logs |
| `Pricing.jsx` | `/pricing` | Plan comparison / upgrade page |

### Meeting Room Components

| Component | Responsibility |
|---|---|
| `VideoGrid.jsx` | Responsive grid layout for all video tiles |
| `VideoTile.jsx` | Renders a single participant's video stream + name badge |
| `ControlBar.jsx` | Bottom toolbar: mic, cam, chat, participants, leave/end |
| `ChatPanel.jsx` | Sliding right drawer for in-meeting text chat |
| `ParticipantList.jsx` | Sliding right drawer listing all participants |

### Session History Components

| Component | Responsibility |
|---|---|
| `SessionCard.jsx` | Summary card with title, date, participant count, status badge |
| `SessionDetailModal.jsx` | Full-screen modal with tabs |
| `SessionParticipantsTab.jsx` | Table of participants with join time |
| `SessionChatTab.jsx` | Full chat transcript with timestamps |
| `EmptySessions.jsx` | Empty state illustration when no sessions exist |

### Shared Components

| Component | Responsibility |
|---|---|
| `ProtectedRoute.jsx` | Wraps private routes; redirects unauthenticated users to `/login` |
| `Protectedlayout.jsx` | Adds `<Navbar>` and `<Footer>` to dashboard/sessions/pricing |
| `Loader.jsx` | Full-screen centered spinner with optional text |
| `Navbar.jsx` | Top navigation with user avatar and sign-out |
| `Footer.jsx` | Bottom footer bar |

---

## 12. Custom Hooks

### `useWebRTC(roomId, user, onMeetingEnded, enabled)`
**File:** `client/src/hooks/useWebRTC.js`

The core hook that manages:
- Local camera/mic stream acquisition
- Socket.IO connection lifecycle (connect on mount, disconnect on unmount)
- WebRTC `RTCPeerConnection` creation and management (stored in a `useRef` Map)
- All socket event listeners for signaling (offer/answer/ICE/user-left/meeting-ended)
- Audio and video toggle with socket broadcast
- Host `endMeeting` action

**Returns:** `{ localStream, remoteUsers, audioEnabled, videoEnabled, toggleAudio, toggleVideo, endMeeting }`

**`enabled` param:** WebRTC only starts AFTER the meeting validity check succeeds (`Boolean(meeting)` from `MeetingRoom.jsx`). This prevents camera access on invalid rooms.

### `useChat(roomId, user)`
**File:** `client/src/hooks/useChat.js`

Manages:
- Listening to `receive-message` socket events
- Sending messages via `send-message` socket emit
- Tracking `unreadCount` (increments when chat panel is closed)
- `isChatOpen` toggle state (resets unread count on open)

**Returns:** `{ messages, sendMessage, unreadCount, isChatOpen, toggleChat }`

---

## 13. Plan Limits & Business Logic

### Free Plan
- **30 meetings** per calendar month (enforced at creation time in `createMeeting`)
- **10 participants** max per room (enforced at socket `join-room` time)

### Premium Plan
- **Unlimited** meetings per month
- **100 participants** max per room

### Enforcement Points

```
1. Meeting Creation (REST API):
   createMeeting() → COUNT meetings in current month → 403 if ≥ 30 (free only)

2. Room Join (Socket):
   join-room handler → rooms.get(roomId).size ≥ maxParticipants → emit "meeting-ended" with error

3. Plan Sync (Every API Request):
   auth.js middleware → compare Clerk plan vs DB plan → UPDATE if different
```

### Meeting ID Format
Generated in `meetingController.js` as three 3-letter lowercase segments:
- Pattern: `[a-z]{3}-[a-z]{3}-[a-z]{3}` (e.g., `abc-def-ghi`)
- Uniqueness guaranteed via DB lookup loop before insert
- Validated on client with regex: `/^[a-z]{3}(?:-[a-z]{3}){2}$/`

---

## 14. Data Flow Summary

### Creating a Meeting
```
Dashboard → POST /api/meetings (Clerk JWT)
    → auth.js: verify token + sync plan
    → createMeeting: check monthly limit → generate ID → INSERT meetings + INSERT host participant
    → return { meetingId }
    → navigate to /meeting/:meetingId
```

### Joining a Meeting Room
```
MeetingRoom mounts
    → GET /api/meetings/:meetingId (verify active)
    → useWebRTC initializes:
        → getUserMedia (camera + mic)
        → socket.connect()
        → emit "join-room"
        → server: verify in DB → check capacity → add to rooms Map → save to DB
        → server: emit "all-users" to joiner
        → joiner: create RTCPeerConnection for each existing user → createOffer → emit "offer"
        → server relays to target → target: createAnswer → emit "answer"
        → server relays back → ICE candidates exchanged
        → P2P stream established
```

### Sending a Chat Message
```
ChatPanel → sendMessage(text)
    → useChat: emit "send-message" { roomId, message }
    → socket.js: INSERT INTO meeting_messages
    → io.in(roomId).emit("receive-message") to ALL in room
    → useChat: receive-message handler → append to messages[]
    → if chat closed → increment unreadCount
```

### Ending a Meeting (Host)
```
ControlBar → onEndMeeting()
    → MeetingRoom.handleEndMeeting()
    → useWebRTC.endMeeting() → emit "end-meeting" { roomId }
    → socket.js: UPDATE meetings SET status = 'ended', ended_at = NOW()
    → broadcast "meeting-ended" to all
    → all participants: navigate to /dashboard
    → rooms.delete(roomId)
```

---

## 15. Known Issues / Notes

| Issue | Detail |
|---|---|
| No TURN server | WebRTC may fail on restrictive networks. Only Google STUN is configured. For production, add a TURN server (e.g., Coturn or Metered). |
| `left_at` not recorded | `meeting_participants.left_at` column exists but is never written to in the current code. |
| `end-meeting` socket bug | In `socket.js` line 176, `io.on(roomId)` should be `io.in(roomId)` — this means the meeting-ended event is not broadcast to all participants when host ends the meeting via socket. |
| Dummy data in MeetingRoom | `dummyMeetingDetails.title` and `dummyUser.id` are referenced in `MeetingRoom.jsx` for the title and host check — should use the real `meeting` state object. |
| `left_at` timestamp | Currently `NULL` for all participants since disconnect cleanup only removes from the in-memory Map, not updating the DB. |
| Single server Socket.IO | The `rooms` Map lives in server memory. Not compatible with horizontal scaling / multiple server instances without adding Redis adapter. |

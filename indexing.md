# 📋 Meetup — Project Index

> A full-stack, real-time peer-to-peer video calling application built with **React**, **Node.js**, **Socket.IO**, **WebRTC**, **Clerk Auth**, and **Neon PostgreSQL**.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [File Structure](#3-file-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [How the App Works — End to End](#5-how-the-app-works--end-to-end)
6. [Authentication (Clerk)](#6-authentication-clerk)
7. [Database Schema](#7-database-schema)
8. [REST API Routes](#8-rest-api-routes)
9. [Socket.IO Signaling Events](#9-socketio-signaling-events)
10. [WebRTC Flow](#10-webrtc-flow)
11. [Client Pages](#11-client-pages)
12. [Client Components](#12-client-components)
13. [Custom Hooks](#13-custom-hooks)
14. [Plan Limits & Business Logic](#14-plan-limits--business-logic)
15. [Environment Variables](#15-environment-variables)
16. [Known Issues & Notes](#16-known-issues--notes)

---

## 1. Project Overview

**Meetup** is a full-stack video calling web app where:

- Users **register / login** via Clerk (OAuth or email/password)
- Authenticated users can **create a meeting** — generates a shareable `abc-def-ghi` style ID
- Other users can **join a meeting** by entering the ID
- Inside a room, all participants connect **peer-to-peer via WebRTC** for video/audio
- **Socket.IO** acts as the signaling server (relaying WebRTC offer / answer / ICE candidates)
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

## 3. File Structure

```
meetup/
│
├── client/                               # ⚛️  React Frontend (Vite)
│   ├── public/
│   │   ├── favicon.svg                   # App favicon
│   │   ├── icons.svg                     # SVG icon sprite
│   │   ├── layout_bg.png                 # Background image for layout
│   │   ├── login_bg.png                  # Background image for login page
│   │   └── logo.svg                      # App logo
│   │
│   ├── src/
│   │   ├── assets/
│   │   │   └── asset.js                  # Dummy/fallback data constants
│   │   │
│   │   ├── components/
│   │   │   ├── meeting/                  # 🎥 In-Meeting UI Components
│   │   │   │   ├── ChatPanel.jsx         # Sliding chat drawer (right panel)
│   │   │   │   ├── ControlBar.jsx        # Bottom toolbar: mic/cam/chat/leave
│   │   │   │   ├── ParticipantList.jsx   # Sidebar list of participants
│   │   │   │   ├── VideoGrid.jsx         # Responsive grid layout for video tiles
│   │   │   │   └── VideoTile.jsx         # Single participant video tile + name badge
│   │   │   │
│   │   │   ├── sessions/                 # 📋 Session History UI Components
│   │   │   │   ├── EmptySessions.jsx     # Empty state illustration
│   │   │   │   ├── SessionCard.jsx       # Summary card per session
│   │   │   │   ├── SessionChatTab.jsx    # Chat transcript tab view
│   │   │   │   ├── SessionDetailModal.jsx# Full-screen detail modal with tabs
│   │   │   │   └── SessionParticipantsTab.jsx # Participant table with join time
│   │   │   │
│   │   │   ├── Footer.jsx                # Bottom footer bar
│   │   │   ├── Loader.jsx                # Full-screen centered spinner
│   │   │   ├── Navbar.jsx                # Top nav with user avatar + sign-out
│   │   │   ├── Protectedlayout.jsx       # Layout wrapper (Navbar + Footer)
│   │   │   └── ProtectedRoute.jsx        # Clerk auth guard for private routes
│   │   │
│   │   ├── config/
│   │   │   ├── api.js                    # Axios instance + Clerk JWT interceptor
│   │   │   └── socket.js                 # Socket.IO client singleton (autoConnect: false)
│   │   │
│   │   ├── hooks/
│   │   │   ├── useWebRTC.js              # All WebRTC + socket signaling logic
│   │   │   └── useChat.js                # Chat send/receive + unread count tracking
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx             # Home: create/join meeting + plan stats
│   │   │   ├── Login.jsx                 # Clerk-powered login/register page
│   │   │   ├── MeetingRoom.jsx           # Full video call room interface
│   │   │   ├── Pricing.jsx               # Plan comparison + upgrade page
│   │   │   └── Sessions.jsx              # Past meeting history viewer
│   │   │
│   │   ├── App.jsx                       # Route definitions (React Router)
│   │   ├── main.jsx                      # App entry: ClerkProvider + BrowserRouter
│   │   └── index.css                     # Global styles + Tailwind directives
│   │
│   ├── .env                              # VITE_BASE_URL, VITE_CLERK_PUBLISHABLE_KEY
│   ├── .gitignore
│   ├── .oxlintrc.json                    # Linter config
│   ├── index.html                        # HTML entry point
│   ├── package.json                      # Client dependencies
│   ├── README.md
│   └── vite.config.js                    # Vite + Tailwind plugin config
│
├── server/                               # 🟢 Node.js/Express Backend
│   ├── config/
│   │   └── db.js                         # Neon DB connection + CREATE TABLE init
│   │
│   ├── controllers/
│   │   ├── meetingController.js          # REST API logic (CRUD for meetings/sessions)
│   │   └── webhookController.js          # Clerk webhook → user upsert/delete in DB
│   │
│   ├── middleware/
│   │   └── auth.js                       # Clerk JWT verification + plan sync middleware
│   │
│   ├── routes/
│   │   └── meetingRoutes.js              # Express router for /api/meetings
│   │
│   ├── socket.js                         # Socket.IO event handlers (signaling + chat)
│   ├── server.js                         # App entry point (Express + Socket.IO setup)
│   ├── .env                              # DATABASE_URL, CLERK keys, ORIGINS
│   ├── .gitignore
│   └── package.json                      # Server dependencies
│
├── assets/
│   └── flowchart.html                    # Architecture flowchart (HTML)
│
├── CONTEXT.md                            # Detailed project context documentation
├── indexing.md                           # 📄 This file — project index
└── .gitignore
```

---

## 4. Architecture Overview

```
Browser (React Client)
     │
     ├── REST API (Axios) ──────────────► Express Server (:3000)
     │        Bearer: Clerk JWT                   │
     │                                     ┌──────┴───────┐
     │                                  auth.js      meetingController.js
     │                                  middleware          │
     │                                     └──────┬───────┘
     │                                            │
     │                                    Neon PostgreSQL
     │                                (users, meetings,
     │                                 participants, messages)
     │
     ├── Socket.IO ──────────────────────► Socket.IO Server
     │   (signaling: offer/answer/ICE,      socket.js
     │    chat, room events)                     │
     │                                    Neon PostgreSQL
     │                                 (messages persisted)
     │
     └── WebRTC P2P ◄────────────────────► Other Browsers
         (video/audio streams)          (direct, no server relay)
         via Google STUN servers
```

> **Key principle:** The server **never handles video/audio data**. It only relays WebRTC signaling messages. Once WebRTC is established, media streams flow peer-to-peer directly between browsers.

---

## 5. How the App Works — End to End

### 5.1 App Startup

1. `main.jsx` bootstraps the app:
   - Wraps app in `<ClerkProvider>` for auth context
   - Wraps in `<BrowserRouter>` for routing
   - Mounts `<App />` with all routes
2. `server.js` runs on startup:
   - Calls `initDB()` → creates all 4 database tables if they don't exist
   - Sets up CORS, cookie-parser, Clerk middleware
   - Mounts Express routes + Socket.IO server

---

### 5.2 Creating a Meeting

```
Dashboard
  → User clicks "Start Meeting"
  → POST /api/meetings (with Clerk JWT)
  → auth.js: verifies JWT, syncs plan in DB
  → createMeeting():
      • Checks monthly meeting count (Free: max 30)
      • Generates unique abc-def-ghi ID
      • INSERT into meetings table
      • INSERT host into meeting_participants
      • Returns { meetingId }
  → Client navigates to /meeting/:meetingId
```

---

### 5.3 Joining a Meeting Room

```
MeetingRoom.jsx mounts
  → GET /api/meetings/:meetingId (verify meeting is active)
  → useWebRTC hook initializes:
      • getUserMedia (video + audio; falls back to audio-only)
      • socket.connect()
      • emit "join-room" { roomId, user, audioEnabled, videoEnabled }
  → server socket.js:
      • Verifies meeting in DB, checks status !== "ended"
      • Checks room capacity (10 Free / 100 Premium)
      • Adds participant to rooms Map + DB
      • Emits "all-users" (existing participants) → to newcomer
      • Emits "user-joined" → to everyone else in room
  → Newcomer creates RTCPeerConnection for each existing user:
      • createOffer → setLocalDescription → emit "offer"
      • Server relays offer to target peer
      • Target: setRemoteDescription → createAnswer → setLocalDescription → emit "answer"
      • Server relays answer back
      • Both sides exchange ICE candidates via server
      • ✅ P2P video/audio stream established
```

---

### 5.4 Sending a Chat Message

```
User types in ChatPanel → sendMessage(text)
  → useChat: emit "send-message" { roomId, message }
  → socket.js:
      • INSERT INTO meeting_messages (persisted to DB)
      • io.in(roomId).emit("receive-message") → ALL participants
  → useChat receive-message handler:
      • Appends to messages[]
      • If chat panel is closed → increments unreadCount badge
```

---

### 5.5 Toggling Mic / Camera

```
ControlBar → toggleAudio() / toggleVideo()
  → useWebRTC:
      • Enables/disables localStream audio/video tracks
      • emit "toggle-audio" / "toggle-video" { roomId, audioEnabled/videoEnabled }
  → socket.js:
      • Updates participant state in rooms Map
      • Broadcasts "user-toggled-audio" / "user-toggled-video" to room
  → Other participants:
      • Update their remote peer's mute/camera state in UI
```

---

### 5.6 Ending a Meeting (Host)

```
ControlBar → "End Meeting" button
  → MeetingRoom.handleEndMeeting()
  → useWebRTC.endMeeting() → emit "end-meeting" { roomId }
  → socket.js:
      • UPDATE meetings SET status = 'ended', ended_at = NOW()
      • Broadcast "meeting-ended" to all participants
      • rooms.delete(roomId) — clears in-memory state
  → All participants:
      • Navigate to /dashboard on "meeting-ended" event
```

---

### 5.7 Viewing Session History

```
Sessions.jsx mounts
  → GET /api/meetings/sessions (authenticated)
  → Returns all sessions where user is host OR participant
  → Renders SessionCard list
  → User clicks a card → GET /api/meetings/sessions/:id
  → SessionDetailModal opens with two tabs:
      • Participants tab (SessionParticipantsTab.jsx)
      • Chat transcript tab (SessionChatTab.jsx)
```

---

## 6. Authentication (Clerk)

### How It Works

| Step | Location | What Happens |
|---|---|---|
| 1 | `main.jsx` | App wrapped in `<ClerkProvider publishableKey={...}>` |
| 2 | `ProtectedRoute.jsx` | Uses Clerk `<SignedIn>/<SignedOut>` to guard private routes |
| 3 | `api.js` | Axios interceptor auto-attaches Clerk JWT as `Bearer` token |
| 4 | `auth.js` (server) | `getAuth(req)` from `@clerk/express` verifies the JWT |

### Plan Sync (Every API Request)

On every protected API call, `auth.js` middleware syncs the user's plan:

```js
const userActivePlan = auth.has({ plan: "premium" }) ? "premium" : "free";
// If DB plan doesn't match Clerk → update DB
if (userActivePlan !== userPlan) {
    await sql`UPDATE users SET plan = ${userActivePlan} WHERE id = ${userId}`;
}
```

### Clerk Webhook (`webhookController.js`)

Clerk fires webhooks to `POST /api/clerk` for user lifecycle events:

| Event | Action |
|---|---|
| `user.created` | `INSERT INTO users ... ON CONFLICT DO UPDATE` |
| `user.updated` | Update name / email / image |
| `user.deleted` | `DELETE FROM users` (cascades to all meetings/participants/messages) |

---

## 7. Database Schema

### `users`
Synced from Clerk via webhooks. Primary key is Clerk's `userId` string.

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

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `meeting_id` | INT FK → meetings.id | `ON DELETE CASCADE` |
| `user_id` | VARCHAR FK → users.id | `ON DELETE SET NULL` — nullable (anonymous guests) |
| `name` | VARCHAR(255) | Always stored even if user_id is null |
| `joined_at` | TIMESTAMPTZ | Auto |
| `left_at` | TIMESTAMPTZ | Currently not populated (future feature) |

### `meeting_messages`

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `meeting_id` | INT FK → meetings.id | `ON DELETE CASCADE` |
| `sender_id` | VARCHAR FK → users.id | `ON DELETE SET NULL` — nullable |
| `sender_name` | VARCHAR(255) | Always stored |
| `text` | TEXT | Message content |
| `timestamp` | TIMESTAMPTZ | Auto |

### Cascade Behaviour

| Delete | Effect |
|---|---|
| A **user** | Their hosted meetings deleted → participants & messages in those meetings deleted |
| A **meeting** | All its participants and messages deleted |
| A **participant user** | `user_id` set to NULL — record kept for history |

---

## 8. REST API Routes

All routes are prefixed `/api/meetings` and protected by `protect` middleware (except webhook).

| Method | Path | Controller | Description |
|---|---|---|---|
| `POST` | `/api/meetings` | `createMeeting` | Create a new meeting |
| `GET` | `/api/meetings/stats` | `getMeetingStats` | Get user's plan + monthly usage |
| `GET` | `/api/meetings/sessions` | `getUserSessions` | All sessions (hosted + joined) |
| `GET` | `/api/meetings/sessions/:id` | `getSessionDetails` | Single session full detail |
| `GET` | `/api/meetings/:meetingId` | `getMeeting` | Verify meeting exists & active |
| `POST` | `/api/clerk` | `handleClerkWebhook` | Clerk webhook handler (public, no auth) |

> **Note:** `/stats` and `/sessions` are registered before `/:meetingId` to prevent them being treated as a meetingId parameter.

---

## 9. Socket.IO Signaling Events

The socket server (`server/socket.js`) tracks `currentRoomId` and `currentUser` per socket in closure scope. In-memory room state:

```js
const rooms = new Map();  // roomId → Map<socketId, participantObject>
```

### Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `join-room` | `{ roomId, user, audioEnabled, videoEnabled }` | Join a meeting room |
| `offer` | `{ targetSocketId, callerSocketId, sdp }` | WebRTC offer to a specific peer |
| `answer` | `{ targetSocketId, responderSocketId, sdp }` | WebRTC answer back to caller |
| `ice-candidate` | `{ targetSocketId, senderSocketId, candidate }` | ICE candidate exchange |
| `toggle-audio` | `{ roomId, audioEnabled }` | Notify others of mic state change |
| `toggle-video` | `{ roomId, videoEnabled }` | Notify others of camera state change |
| `send-message` | `{ roomId, message }` | Send a chat message |
| `end-meeting` | `{ roomId }` | Host ends meeting for all |

### Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `all-users` | `existingUsers[]` | Sent to newcomer: list of current room participants |
| `user-joined` | `newUser` | Broadcast: a new user arrived |
| `offer` | `{ callerSocketId, sdp, callerUser }` | Relayed WebRTC offer |
| `answer` | `{ responderSocketId, sdp }` | Relayed WebRTC answer |
| `ice-candidate` | `{ senderSocketId, candidate }` | Relayed ICE candidate |
| `user-toggled-audio` | `{ socketId, audioEnabled }` | Broadcast mic state change |
| `user-toggled-video` | `{ socketId, videoEnabled }` | Broadcast camera state change |
| `receive-message` | `{ ...message, senderSocketId }` | Broadcast chat message to all |
| `user-left` | `{ socketId, user }` | Broadcast on disconnect |
| `meeting-ended` | `{ message }` | Sent when host ends meeting / meeting not found |

---

## 10. WebRTC Flow

### ICE / STUN Config

```js
const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
    ],
};
```

> No TURN server configured — connections may fail on restrictive networks (corporate firewalls, symmetric NAT).

### Signaling Sequence Diagram

```
NewUser                Server              ExistingUser
   │                     │                      │
   │── join-room ────────►│                      │
   │◄── all-users ────────│                      │
   │                      │── user-joined ───────►│
   │                      │                      │
   │── offer ─────────────►│                      │
   │                      │── offer ─────────────►│
   │                      │◄── answer ────────────│
   │◄── answer ───────────│                      │
   │                      │                      │
   │◄──── ICE candidates exchanged (both ways) ──►│
   │                      │                      │
   │◄══════════ P2P WebRTC stream established ════►│
```

### Media Acquisition (`useWebRTC.js`)

```js
// Try video + audio first; fall back to audio-only
try {
  stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
} catch {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
}
```

---

## 11. Client Pages

| Page | Route | File | Description |
|---|---|---|---|
| Login | `/login` | `pages/Login.jsx` | Clerk-powered login UI |
| Register | `/register` | `pages/Login.jsx` | Clerk-powered register UI (same component, different mode) |
| Dashboard | `/dashboard` | `pages/Dashboard.jsx` | Create/join meeting; live clock; plan stats card |
| Meeting Room | `/meeting/:meetingId` | `pages/MeetingRoom.jsx` | Full real-time video call interface |
| Sessions | `/sessions` | `pages/Sessions.jsx` | Past meeting history with participant & chat logs |
| Pricing | `/pricing` | `pages/Pricing.jsx` | Plan comparison / upgrade page |

**Route Config (`App.jsx`):**
- `/login` and `/register` — public
- All others — wrapped in `<ProtectedRoute>` (Clerk auth guard)
- `Dashboard`, `Sessions`, `Pricing` — also wrapped in `<Protectedlayout>` (adds Navbar + Footer)
- `*` — redirects to `/dashboard`

---

## 12. Client Components

### Meeting Room Components

| Component | File | Responsibility |
|---|---|---|
| VideoGrid | `components/meeting/VideoGrid.jsx` | Responsive CSS grid layout for all participant video tiles |
| VideoTile | `components/meeting/VideoTile.jsx` | Renders a single participant's `<video>` stream + name badge; mute/camera indicators |
| ControlBar | `components/meeting/ControlBar.jsx` | Bottom toolbar: toggle mic, toggle camera, open chat, participants list, leave/end meeting |
| ChatPanel | `components/meeting/ChatPanel.jsx` | Sliding right drawer for in-meeting text chat; shows unread badge when closed |
| ParticipantList | `components/meeting/ParticipantList.jsx` | Sliding right drawer listing all current room participants |

### Session History Components

| Component | File | Responsibility |
|---|---|---|
| SessionCard | `components/sessions/SessionCard.jsx` | Summary card: title, date, participant count, status badge (active/ended) |
| SessionDetailModal | `components/sessions/SessionDetailModal.jsx` | Full-screen modal with tabbed view (Participants + Chat) |
| SessionParticipantsTab | `components/sessions/SessionParticipantsTab.jsx` | Table of participants with join timestamps |
| SessionChatTab | `components/sessions/SessionChatTab.jsx` | Full chat transcript with timestamps |
| EmptySessions | `components/sessions/EmptySessions.jsx` | Empty state illustration when no sessions exist yet |

### Shared / Layout Components

| Component | File | Responsibility |
|---|---|---|
| ProtectedRoute | `components/ProtectedRoute.jsx` | Guards private routes; redirects unauthenticated users to `/login` |
| Protectedlayout | `components/Protectedlayout.jsx` | Wraps dashboard/sessions/pricing with `<Navbar>` and `<Footer>` |
| Navbar | `components/Navbar.jsx` | Top navigation bar with app logo, links, user avatar, and sign-out |
| Footer | `components/Footer.jsx` | Bottom footer bar |
| Loader | `components/Loader.jsx` | Full-screen centered spinner with optional label text |

---

## 13. Custom Hooks

### `useWebRTC(roomId, user, onMeetingEnded, enabled)`
**File:** [`client/src/hooks/useWebRTC.js`](file:///D:/mini%20project%205th%20sem/Meetup%20-%20Full%20Stack%20Video%20Calling%20App%20(1)/meetup/client/src/hooks/useWebRTC.js)

The core real-time hook managing:

| Responsibility | Detail |
|---|---|
| Local media | Acquires camera/mic via `getUserMedia`; falls back to audio-only |
| Socket lifecycle | Connects on mount, disconnects on unmount |
| Peer connections | Creates and stores `RTCPeerConnection` objects in a `useRef` Map (keyed by socketId) |
| Signaling listeners | Handles `offer`, `answer`, `ice-candidate`, `user-left`, `meeting-ended` events |
| Media toggle | Enables/disables local stream tracks + broadcasts state to room |
| End meeting | Emits `end-meeting` socket event (host only) |

**Returns:** `{ localStream, remoteUsers, audioEnabled, videoEnabled, toggleAudio, toggleVideo, endMeeting }`

> **`enabled` param:** WebRTC only starts AFTER the meeting validity REST check succeeds. Prevents camera access on invalid/ended rooms.

---

### `useChat(roomId, user)`
**File:** [`client/src/hooks/useChat.js`](file:///D:/mini%20project%205th%20sem/Meetup%20-%20Full%20Stack%20Video%20Calling%20App%20(1)/meetup/client/src/hooks/useChat.js)

Manages in-meeting chat state:

| Responsibility | Detail |
|---|---|
| Receive messages | Listens to `receive-message` socket events, appends to `messages[]` |
| Send messages | Emits `send-message` via socket |
| Unread count | Increments when chat panel is closed and a message arrives |
| Panel toggle | `isChatOpen` state; resets unread count when panel is opened |

**Returns:** `{ messages, sendMessage, unreadCount, isChatOpen, toggleChat }`

---

## 14. Plan Limits & Business Logic

### Free Plan
- **30 meetings** per calendar month (enforced at REST API creation time)
- **10 participants** max per room (enforced at Socket `join-room` time)

### Premium Plan
- **Unlimited** meetings per month
- **100 participants** max per room

### Enforcement Points

| Point | Where | How |
|---|---|---|
| Meeting creation limit | `meetingController.js → createMeeting()` | `COUNT` meetings in current month → `403` if ≥ 30 (free only) |
| Participant capacity | `socket.js → join-room handler` | `rooms.get(roomId).size >= maxParticipants` → emit `meeting-ended` with error message |
| Plan sync | `middleware/auth.js` | On every API request, compare Clerk plan vs DB plan → `UPDATE` if mismatch |

### Meeting ID Generation

- Format: `[a-z]{3}-[a-z]{3}-[a-z]{3}` (e.g., `abc-def-ghi`)
- Generated in `meetingController.js` with three random 3-letter lowercase segments
- Uniqueness guaranteed via DB lookup loop before insert
- Client-side validation regex: `/^[a-z]{3}(?:-[a-z]{3}){2}$/`

---

## 15. Environment Variables

### `server/.env`

```env
ORIGINS="http://localhost:5173,http://localhost:3000"
DATABASE_URL='postgresql://<user>:<pass>@<host>-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
PORT=3000
```

### `client/.env`

```env
VITE_BASE_URL="http://localhost:3000"
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

> `VITE_` prefix is required for Vite to expose env vars to the browser bundle.

---

## 16. Known Issues & Notes

| Issue | Detail |
|---|---|
| ⚠️ No TURN server | WebRTC may fail on restrictive networks. Only Google STUN servers are configured. For production, add TURN (e.g., Coturn or Metered.ca). |
| 🐛 `end-meeting` socket bug | In `socket.js` line 176, `io.on(roomId)` should be `io.in(roomId)` — the `meeting-ended` event is NOT broadcast to all participants when host clicks "End Meeting" via socket. |
| ⏱️ `left_at` not recorded | `meeting_participants.left_at` column exists but is never written — always NULL in current code. |
| 🧪 Dummy data in MeetingRoom | `dummyMeetingDetails.title` and `dummyUser.id` are still referenced in `MeetingRoom.jsx` — should use the real `meeting` state. |
| 📦 Single-server Socket.IO | The `rooms` Map lives in server memory. Not horizontally scalable without Redis adapter. |
| 🔒 Anonymous guests | `user_id` in `meeting_participants` is nullable — anonymous users are stored with just a `name`. |

---

*Generated by project indexing — Meetup Full Stack Video Calling App*

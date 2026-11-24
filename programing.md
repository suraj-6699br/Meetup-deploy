# 🎙️ Feature Plans — Meetup

---

# ✅ Feature 1: Host "Mute All Participants"

## Progress Tracker

| Step | Task | Status |
|---|---|---|
| 1 | Add `mute-all` Socket.IO event on the **server** | ✅ Done |
| 2 | Add `muted-by-host` Socket.IO event listener on the **client hook** | ✅ Done |
| 3 | Add `muteAll` function to `useWebRTC` hook | ✅ Done |
| 4 | Add "Mute All" button to `ControlBar.jsx` (host only) | ✅ Done |
| 5 | Wire `muteAll` from `MeetingRoom.jsx` down to `ControlBar` | ✅ Done |
| 6 | Fix the existing `io.on(roomId)` → `io.in(roomId)` bug in `socket.js` | ✅ Done |

---
---

# 🔴 Feature 2: Meeting Audio Recording → Transcript → AI Summary

> **Feasibility:** ✅ YES — Fully implementable.
> Uses: Browser `MediaRecorder` API + Web Audio API + Google Cloud Speech-to-Text + Gemini API + Neon PostgreSQL (text only, no audio stored in DB)

---

## 📋 Progress Tracker

| Step | Task | Status |
|---|---|---|
| 1 | Add `transcript` + `summary` + `recording_status` columns to DB | ✅ Done |
| 2 | Install server packages (`multer`, `assemblyai`) | ✅ Done |
| 3 | Create `useRecording.js` hook (client-side audio capture + upload) | ✅ Done |
| 4 | Create `recordingController.js` (receive audio → STT → AssemblyAI summary → save to DB) | ✅ Done |
| 5 | Add recording route to `meetingRoutes.js` | ✅ Done |
| 6 | Integrate `useRecording` into `MeetingRoom.jsx` | ✅ Done |
| 7 | Add `transcript` + `summary` data to `getUserSessions` / `getSessionDetails` responses | ✅ Done |
| 8 | Create `TranscriptTab.jsx` component | ✅ Done |
| 9 | Create `SummaryTab.jsx` component | ✅ Done |
| 10 | Update `SessionDetailModal.jsx` to show new tabs | ✅ Done |

---

## 🧠 Architecture Decision: Where Does Recording Happen?

### ❌ Why NOT server-side recording

WebRTC is **peer-to-peer**. The server never touches audio/video streams. It only relays signaling (offer/answer/ICE). There is no audio data to record on the server — it physically never arrives there.

### ✅ Solution: Client-side recording by the HOST

The **host's browser** has access to:
- Their own microphone via `getUserMedia` (local stream)
- ALL remote participants' audio via WebRTC `ontrack` events (remote streams)

Using the **Web Audio API**, we mix all these streams into one and record with `MediaRecorder`.

```
Host's Browser
   │
   ├── localStream (host mic)         ─┐
   ├── remoteStream[participant 1]     ├──► AudioContext mixer ──► MediaRecorder ──► Blob
   ├── remoteStream[participant 2]     │       (Web Audio API)        (WebM/Opus)
   └── remoteStream[participant N]    ─┘
```

> **Result:** A single mixed audio file (WebM/Opus format) of everything spoken in the meeting — from the host's perspective. This is the same approach used by browser-based tools like Loom, Otter.ai integrations, etc.

---

## 💾 Where Audio Is Stored

> [!IMPORTANT]
> Audio is **NEVER stored permanently**. It is a temporary file on disk only during the 5–30 seconds it takes Google STT to process it, then it is deleted. Only the transcript text and summary text go into the database.

```
Host Browser
     │
     │  (meeting ends — audio blob uploaded)
     ▼
POST /api/meetings/:meetingId/recording
     │
     ▼
server/uploads/recordings/     ← TEMP folder on disk (multer)
     │
     │  Audio file saved: recording-<meetingId>-<timestamp>.webm
     │
     ▼
Google Cloud Speech-to-Text API
     │
     │  Transcript text returned
     ▼
Gemini 1.5 Flash API
     │
     │  Summary text returned
     ▼
Neon PostgreSQL
     │  meetings.transcript = "Speaker 1: Hello everyone..."
     │  meetings.summary    = "The meeting discussed..."
     │  meetings.recording_status = "done"
     ▼
DELETE temp audio file from disk  ← File removed immediately
```

### Why this is fine for 512MB Neon RAM
- Neon RAM limit applies to **query working memory** (sorting, joins), not column storage
- `TEXT` columns (transcript, summary) are stored on Neon's SSD disk, not RAM
- A 1-hour transcript is ~10–50KB of text — negligible
- No BYTEA blobs, no base64, no audio data in the database

---

## 🗂️ Files to Create / Modify

### New Files
| File | Purpose |
|---|---|
| `client/src/hooks/useRecording.js` | Mixes all audio streams → MediaRecorder → uploads blob on meeting end |
| `server/controllers/recordingController.js` | Receives audio → STT → Gemini → saves transcript/summary to DB |
| `client/src/components/sessions/TranscriptTab.jsx` | Displays full speech-to-text transcript |
| `client/src/components/sessions/SummaryTab.jsx` | Displays AI-generated meeting summary |

### Modified Files
| File | What Changes |
|---|---|
| `server/config/db.js` | Add 3 new columns to `meetings` table |
| `server/routes/meetingRoutes.js` | Add `POST /api/meetings/:meetingId/recording` route |
| `server/server.js` | Add `multer` middleware for file uploads |
| `server/controllers/meetingController.js` | Return `transcript`, `summary`, `recording_status` in `getUserSessions` + `getSessionDetails` |
| `client/src/pages/MeetingRoom.jsx` | Import + wire `useRecording` hook |
| `client/src/components/sessions/SessionDetailModal.jsx` | Add Summary + Transcript tabs |

---

## 🔧 APIs Required

### AssemblyAI — One API Key Does Everything

> [!IMPORTANT]
> AssemblyAI replaces **both** Google Cloud STT and Gemini. One API key, one SDK, one package. No service account JSON file needed.

- **Package:** `assemblyai` (official Node.js SDK)
- **STT:** Converts WebM/Opus audio → English transcript, with speaker labels (who said what)
- **Summarization:** Built-in `lemur.task()` — sends transcript to an LLM and returns a structured meeting summary
- **WebM support:** ✅ Natively supported, no conversion needed
- **Free tier:** \$50 free credits on signup — easily covers hundreds of meeting transcriptions
- **API Key:** Get at → [https://www.assemblyai.com](https://www.assemblyai.com) (sign up → Dashboard → API Key)

#### Comparison vs Original Plan

| | ~~Google Cloud STT~~ | AssemblyAI ✅ |
|---|---|---|
| Setup | Service account JSON file + Cloud project | Just an API key |
| Packages needed | `@google-cloud/speech` + `@google/generative-ai` | `assemblyai` only |
| Speaker labels | Manual config | Built-in |
| Summarization | Need separate Gemini API | Built-in LeMUR |
| Free tier | 60 min/month | \$50 credits (~500+ meetings) |
| Complexity | High | Low |

---

## 📝 Step-by-Step Implementation

---

### Step 1 — Database: Add New Columns

**File:** `server/config/db.js`

Add these 3 columns to the `meetings` table inside `initDB()`:

```js
await sql`
    ALTER TABLE meetings
    ADD COLUMN IF NOT EXISTS transcript TEXT,
    ADD COLUMN IF NOT EXISTS summary TEXT,
    ADD COLUMN IF NOT EXISTS recording_status VARCHAR(20) DEFAULT 'none'
`;
```

| Column | Type | Values |
|---|---|---|
| `transcript` | TEXT | Full STT output text, NULL until processed |
| `summary` | TEXT | Gemini summary text, NULL until processed |
| `recording_status` | VARCHAR(20) | `'none'` → `'processing'` → `'done'` → `'failed'` |

---

### Step 2 — Install Server Packages

```bash
cd server
npm install multer assemblyai
```

| Package | Use |
|---|---|
| `multer` | Handles multipart/form-data audio file upload |
| `assemblyai` | AssemblyAI SDK — handles STT transcription + LeMUR AI summarization (all-in-one) |

---

### Step 3 — Client Hook: `useRecording.js`

**File:** `client/src/hooks/useRecording.js`

This hook does all client-side recording work. It:
1. Creates a Web Audio API `AudioContext`
2. Connects every audio stream (local + all remotes) to a destination node
3. Records the destination node with `MediaRecorder`
4. When `stopAndUpload()` is called (on meeting end) — stops recording, creates a Blob, POSTs it to the server

```js
import { useRef, useCallback } from "react";
import api from "../config/api";

export const useRecording = (roomId, isHost) => {
    const mediaRecorderRef = useRef(null);
    const audioChunksRef   = useRef([]);
    const audioContextRef  = useRef(null);
    const destinationRef   = useRef(null);
    const connectedStreamsRef = useRef(new Set());

    // Call this when a new stream is available (local + each remote)
    const addStreamToMix = useCallback((stream) => {
        if (!isHost || !stream) return;

        // Create AudioContext on first call
        if (!audioContextRef.current) {
            audioContextRef.current = new AudioContext();
            destinationRef.current  = audioContextRef.current.createMediaStreamDestination();

            // Start MediaRecorder on the mixed destination stream
            const recorder = new MediaRecorder(destinationRef.current.stream, {
                mimeType: "audio/webm;codecs=opus",
            });
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            recorder.start(1000); // collect chunks every 1 second
            mediaRecorderRef.current = recorder;
        }

        // Avoid connecting the same stream twice
        if (connectedStreamsRef.current.has(stream.id)) return;
        connectedStreamsRef.current.add(stream.id);

        // Connect this stream's audio to the mixer
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(destinationRef.current);
    }, [isHost]);

    // Call this on meeting end — stops recording and uploads
    const stopAndUpload = useCallback(async () => {
        if (!isHost || !mediaRecorderRef.current) return;

        return new Promise((resolve) => {
            const recorder = mediaRecorderRef.current;

            recorder.onstop = async () => {
                try {
                    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

                    // Don't upload if recording is too short (< 3 seconds)
                    if (audioBlob.size < 5000) { resolve(); return; }

                    const formData = new FormData();
                    formData.append("audio", audioBlob, `recording-${roomId}.webm`);

                    await api.post(`/api/meetings/${roomId}/recording`, formData, {
                        headers: { "Content-Type": "multipart/form-data" },
                    });
                } catch (err) {
                    console.error("Recording upload failed:", err);
                } finally {
                    // Cleanup
                    audioContextRef.current?.close();
                    audioChunksRef.current = [];
                    resolve();
                }
            };

            recorder.stop();
        });
    }, [isHost, roomId]);

    return { addStreamToMix, stopAndUpload };
};
```

---

### Step 4 — Server: `recordingController.js`

**File:** `server/controllers/recordingController.js`

```
POST /api/meetings/:meetingId/recording
  │
  ├─ Verify meeting exists + user is host
  ├─ Save audio file via multer (temp to server/uploads/recordings/)
  ├─ Update recording_status = 'processing'
  ├─ Call AssemblyAI SDK → transcribe(audioFilePath) → transcript text + speaker labels
  ├─ Call AssemblyAI LeMUR → lemur.task(transcriptId) → meeting summary
  ├─ UPDATE meetings SET transcript=..., summary=..., recording_status='done'
  └─ Delete temp audio file
```

```js
import { AssemblyAI } from "assemblyai";
import { sql } from "../config/db.js";
import fs from "fs";

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY });

export const processRecording = async (req, res) => {
    const { meetingId } = req.params;
    const userId = req.user.id;
    const audioFile = req.file; // from multer

    if (!audioFile) {
        return res.status(400).json({ error: "No audio file uploaded" });
    }

    try {
        // 1. Verify meeting exists and user is the host
        const meetings = await sql`
            SELECT id, host_id FROM meetings WHERE meeting_id = ${meetingId}
        `;
        if (meetings.length === 0) {
            fs.unlinkSync(audioFile.path);
            return res.status(404).json({ error: "Meeting not found" });
        }

        const meeting = meetings[0];
        if (meeting.host_id !== userId) {
            fs.unlinkSync(audioFile.path);
            return res.status(403).json({ error: "Only the host can submit a recording" });
        }

        // 2. Mark as processing, respond immediately (don't block the browser)
        await sql`UPDATE meetings SET recording_status = 'processing' WHERE id = ${meeting.id}`;
        res.status(202).json({ message: "Recording received, processing started" });

        // 3. Run STT + Summary in background (after responding 202 to client)
        (async () => {
            try {
                // --- AssemblyAI: Transcribe audio file ---
                const transcript = await client.transcripts.transcribe({
                    audio: audioFile.path,          // SDK auto-uploads the local file
                    language_code: "en",
                    speaker_labels: true,            // labels each speaker (Speaker A, B, C...)
                    auto_punctuation: true,
                });

                // Build transcript text with speaker labels
                let transcriptText = "";
                if (transcript.utterances && transcript.utterances.length > 0) {
                    transcriptText = transcript.utterances
                        .map(u => `Speaker ${u.speaker}: ${u.text}`)
                        .join("\n");
                } else {
                    transcriptText = transcript.text || "No speech detected";
                }

                // --- AssemblyAI LeMUR: Generate meeting summary ---
                let summary = "No summary available.";
                if (transcript.text && transcript.text.length > 50) {
                    const lemurResult = await client.lemur.task({
                        transcript_ids: [transcript.id],
                        prompt: `You are a professional meeting assistant. Analyze this meeting transcript and provide:
1. A 2-3 sentence overview of what the meeting was about
2. Key topics discussed (bullet points)
3. Decisions made (bullet points, if any)
4. Action items (bullet points, if any)
Keep it concise and professional.`,
                        final_model: "anthropic/claude-haiku-20240307",
                    });
                    summary = lemurResult.response;
                }

                // --- Save transcript + summary to DB ---
                await sql`
                    UPDATE meetings
                    SET transcript = ${transcriptText},
                        summary = ${summary},
                        recording_status = 'done'
                    WHERE id = ${meeting.id}
                `;
                console.log(`✅ Recording processed for meeting ${meetingId}`);

            } catch (err) {
                console.error("AssemblyAI processing failed:", err);
                await sql`UPDATE meetings SET recording_status = 'failed' WHERE id = ${meeting.id}`;
            } finally {
                // Always delete the temp audio file from disk
                if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
            }
        })();

    } catch (error) {
        console.error("processRecording error:", error);
        if (audioFile?.path && fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
        if (!res.headersSent) res.status(500).json({ error: "Failed to process recording" });
    }
};
```

> **Key design:** We respond `202 Accepted` immediately so the host's browser isn't blocked. AssemblyAI transcription takes ~20–60 seconds depending on meeting length. The processing runs fully async in the background.

---

### Step 5 — Server Route + Multer Config

**File:** `server/routes/meetingRoutes.js`

```js
import multer from "multer";
import path from "path";
import { processRecording } from "../controllers/recordingController.js";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/recordings/"); // must exist — created on server startup
    },
    filename: (req, file, cb) => {
        cb(null, `recording-${req.params.meetingId}-${Date.now()}.webm`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 150 * 1024 * 1024 }, // 150MB max (safe for ~2hr meeting)
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("audio/")) cb(null, true);
        else cb(new Error("Only audio files allowed"), false);
    },
});

// Add to existing routes:
meetingRouter.post("/:meetingId/recording", protect, upload.single("audio"), processRecording);
```

**File:** `server/server.js` — add this after `initDB()`:

```js
import { mkdirSync } from "fs";
mkdirSync("uploads/recordings", { recursive: true }); // ensure upload folder exists
```

---

### Step 6 — Integrate `useRecording` into `MeetingRoom.jsx`

The key integration points are:

**A. Add `addStreamToMix` calls:**
```js
// After localStream is acquired — add local audio
useEffect(() => {
    if (localStream && isHost) addStreamToMix(localStream);
}, [localStream, isHost]);

// When a new remote user stream arrives — add it
useEffect(() => {
    if (isHost) {
        remoteUsers.forEach(u => {
            if (u.stream) addStreamToMix(u.stream);
        });
    }
}, [remoteUsers, isHost]);
```

**B. Call `stopAndUpload` on meeting end (host only):**
```js
const handleEndMeeting = async () => {
    endMeeting();                  // emit socket event
    await stopAndUpload();         // upload recording (non-blocking, fires async)
    toast("Meeting ended for all participants");
    navigate("/dashboard");
};
```

> **Why only the host records?** The host has access to ALL remote streams via WebRTC `ontrack`. Participants also have all streams, but recording from multiple sources would create duplicates. One centralized host recording is simpler and sufficient.

---

### Step 7 — Update `getUserSessions` + `getSessionDetails`

**File:** `server/controllers/meetingController.js`

Add `transcript`, `summary`, `recording_status` to the SELECT queries and return them in the response:

```js
// In the return object for each meeting:
return {
    id: m.id,
    meetingId: m.meeting_id,
    title: m.title,
    status: m.status,
    createdAt: m.created_at,
    endedAt: m.ended_at,
    transcript: m.transcript || null,          // ← ADD
    summary: m.summary || null,                // ← ADD
    recordingStatus: m.recording_status,       // ← ADD
    host: { ... },
    participants: [ ... ],
    messages: [ ... ],
};
```

---

### Step 8 — `TranscriptTab.jsx`

**File:** `client/src/components/sessions/TranscriptTab.jsx`

```jsx
const TranscriptTab = ({ transcript, recordingStatus }) => {
    if (recordingStatus === "processing") {
        return (
            <div className="text-center py-12 text-slate-500">
                <span className="animate-spin text-3xl block mb-3">⏳</span>
                Processing transcript... this may take a minute.
            </div>
        );
    }
    if (recordingStatus === "failed") {
        return <p className="text-rose-500 text-center py-12">Transcription failed.</p>;
    }
    if (!transcript || recordingStatus === "none") {
        return <p className="text-slate-400 text-center py-12">No recording available for this session.</p>;
    }
    return (
        <div className="bg-slate-50 rounded-2xl p-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">
            {transcript}
        </div>
    );
};
export default TranscriptTab;
```

---

### Step 9 — `SummaryTab.jsx`

**File:** `client/src/components/sessions/SummaryTab.jsx`

```jsx
const SummaryTab = ({ summary, recordingStatus }) => {
    if (recordingStatus === "processing") {
        return (
            <div className="text-center py-12 text-slate-500">
                <span className="animate-spin text-3xl block mb-3">🤖</span>
                AI is summarizing your meeting...
            </div>
        );
    }
    if (!summary || recordingStatus === "none") {
        return <p className="text-slate-400 text-center py-12">No summary available yet.</p>;
    }
    return (
        <div className="prose prose-slate max-w-none text-sm">
            <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-2xl p-5 text-slate-700 leading-relaxed whitespace-pre-wrap">
                {summary}
            </div>
        </div>
    );
};
export default SummaryTab;
```

---

### Step 10 — Update `SessionDetailModal.jsx`

Add two new tabs: **AI Summary** and **Transcript** alongside existing Chat and Participants tabs:

```jsx
// Add to tab bar:
<button onClick={() => setActiveTab("summary")} className={...}>
    🤖 AI Summary
</button>
<button onClick={() => setActiveTab("transcript")} className={...}>
    📝 Transcript
</button>

// Add to tab content:
{activeTab === "summary" && (
    <SummaryTab summary={session.summary} recordingStatus={session.recordingStatus} />
)}
{activeTab === "transcript" && (
    <TranscriptTab transcript={session.transcript} recordingStatus={session.recordingStatus} />
)}
```

---

## 🔑 New Environment Variables Required

### `server/.env` — add these:

```env
# AssemblyAI — single key for both STT + summarization
ASSEMBLYAI_API_KEY=your_key_here
```

> Get your free key at: **https://www.assemblyai.com** → Sign Up → Dashboard → API Key
> Free \$50 credit is enough for hundreds of meeting recordings.

---

## 📊 Full Data Flow — End to End

```
1. Meeting starts
        │
        ▼
2. useRecording.addStreamToMix(localStream)      ← host's mic
   useRecording.addStreamToMix(remoteStream[0])  ← participant 1
   useRecording.addStreamToMix(remoteStream[1])  ← participant 2
        │
        │   AudioContext mixer → MediaRecorder (collecting webm chunks every 1s)
        │
        ▼
3. Host clicks "End Meeting"
        │
        ▼
4. endMeeting() fires    → socket: meeting ended, all leave
   stopAndUpload() fires → MediaRecorder.stop()
                        → Blob assembled from all chunks
                        → POST /api/meetings/:id/recording (FormData)
        │
        ▼
5. Server receives audio (multer saves to uploads/recordings/)
   → Responds 202 immediately → host navigates to /dashboard
   → Background async process starts:
        │
        ├─► Google STT: audio → transcript text
        ├─► Gemini Flash: transcript → summary bullets
        └─► DB: UPDATE meetings SET transcript=..., summary=..., status='done'
              → DELETE temp audio file
        │
        ▼
6. User opens Sessions → clicks "View Details"
   → SessionDetailModal shows:
        • Chat Transcript tab (existing)
        • Participants tab (existing)
        • 🤖 AI Summary tab ← NEW
        • 📝 Transcript tab ← NEW
```

---

## ⚠️ Important Limitations

| Limitation | Detail |
|---|---|
| **Google STT sync limit** | `recognize()` only handles audio ≤ 60 seconds / 10MB inline. For longer meetings, must use `longRunningRecognize()` with Google Cloud Storage as intermediary. We'll implement auto-fallback. |
| **Host must stay to end** | If host closes tab (instead of clicking End Meeting), `stopAndUpload()` won't fire cleanly. Need `beforeunload` handler as a fallback. |
| **Audio quality** | MediaRecorder captures what the host's browser receives. If a participant has bad connection, their audio may be choppy in the recording. |
| **Free STT quota** | Google STT free tier: 60 min/month. Beyond that: $0.016/min. For a student project this is essentially free. |
| **Gemini free tier** | Gemini 1.5 Flash: 15 requests/min, 1 million tokens/day free. More than enough. |
| **No TURN server** | If WebRTC fails between host and a participant (restrictive NAT), that participant's audio won't be in the recording. Same known limitation as the base app. |

---

## 📦 Final Summary

| Item | Detail |
|---|---|
| New DB columns | `transcript TEXT`, `summary TEXT`, `recording_status VARCHAR(20)` |
| Audio storage | ❌ NOT in DB — temp file on disk, deleted after STT |
| New packages (server) | `multer`, `assemblyai` |
| New packages (client) | ❌ None — uses native `MediaRecorder` + Web Audio API |
| Google APIs needed | ~~Google STT + Gemini~~ → **AssemblyAI only** (one key) |
| New files | 4 (hook, controller, 2 UI components) |
| Modified files | 6 (db, routes, server, meetingController, MeetingRoom, SessionDetailModal) |
| Risk level | 🟡 Medium — involves Google Cloud credentials setup |

---

*Feature plan written for Meetup Full Stack Video Calling App*

import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http"
import cookieParser from "cookie-parser";
import { mkdirSync } from "fs";
import { initDB } from "./config/db.js";
import { clerkMiddleware } from '@clerk/express'
import { handleClerkWebhook } from "./controllers/webhookController.js";
import meetingRouter from "./routes/meetingRoutes.js";
import { Server } from "socket.io";
import { setupSocketIO } from "./socket.js";

const app = express();
const server = http.createServer(app)

// Connect to Neon & Initialize Tables
await initDB()
mkdirSync("uploads/recordings", { recursive: true });

const rawOrigins = (process.env.ORIGINS || "http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);

const isOriginAllowed = (origin) => {
    if (!origin) return true;
    const clean = origin.replace(/\/$/, "");
    return rawOrigins.includes(clean) || clean.endsWith(".onrender.com");
};

const corsOptions = {
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            callback(null, origin || true);
        } else {
            console.warn(`[CORS Blocked] Origin: ${origin}`);
            callback(null, false);
        }
    },
    credentials: true,
};

app.use(cors(corsOptions))
app.use(cookieParser())


app.use("/api/clerk", express.raw({type: "application/json" }), handleClerkWebhook)
app.use(express.json())
app.use(clerkMiddleware())

app.get("/", (req, res)=> res.send("API is Live!"))
app.use("/api/meetings", meetingRouter)

const io = new Server(server, {
    cors: corsOptions,
})

setupSocketIO(io)

// Centralized Error Handler
app.use((err, _req, res, _next)=>{
    console.error(`[Error] ${err.message}`);
    res.status(500).json({ error: "Internal server error" });
})

const port = process.env.PORT || 3000;

server.listen(port, ()=>{
    console.log(`Server is running at http://localhost:${port}`);
})
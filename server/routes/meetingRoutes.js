import express from "express";
import multer from "multer";
import { protect } from "../middleware/auth.js";
import { createMeeting, getMeeting, getMeetingStats, getSessionDetails, getUserSessions } from "../controllers/meetingController.js";
import { processRecording } from "../controllers/recordingController.js";

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/recordings/");
    },
    filename: (req, file, cb) => {
        cb(null, `recording-${req.params.meetingId}-${Date.now()}.webm`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 150 * 1024 * 1024 },
});

const meetingRouter = express.Router();

meetingRouter.post("/", protect, createMeeting);
meetingRouter.get("/stats", protect, getMeetingStats);
meetingRouter.get("/sessions", protect, getUserSessions);
meetingRouter.get("/sessions/:id", protect, getSessionDetails);
meetingRouter.post("/:meetingId/recording", protect, upload.single("audio"), processRecording);
meetingRouter.get("/:meetingId", protect, getMeeting);

export default meetingRouter;

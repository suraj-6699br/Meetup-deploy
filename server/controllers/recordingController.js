import { AssemblyAI } from "assemblyai";
import { sql } from "../config/db.js";
import fs from "fs";

export const processRecording = async (req, res) => {
    const { meetingId } = req.params;
    const userId = req.user.id;
    const audioFile = req.file;

    if (!audioFile) {
        return res.status(400).json({ error: "No audio file uploaded" });
    }

    try {
        // 1. Verify meeting exists and user is the host
        const meetings = await sql`
            SELECT id, host_id FROM meetings WHERE meeting_id = ${meetingId}
        `;
        if (meetings.length === 0) {
            if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
            return res.status(404).json({ error: "Meeting not found" });
        }

        const meeting = meetings[0];
        if (meeting.host_id !== userId) {
            if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
            return res.status(403).json({ error: "Only the host can submit a recording" });
        }

        // 2. Mark as processing and respond immediately so host UI navigates without delay
        await sql`UPDATE meetings SET recording_status = 'processing' WHERE id = ${meeting.id}`;
        res.status(202).json({ message: "Recording received, processing started" });

        // 3. Process transcription & summary asynchronously in background
        (async () => {
            try {
                const apiKey = process.env.ASSEMBLYAI_API_KEY;
                if (!apiKey) {
                    console.error("ASSEMBLYAI_API_KEY is not configured in server/.env");
                    await sql`UPDATE meetings SET recording_status = 'failed' WHERE id = ${meeting.id}`;
                    return;
                }

                const client = new AssemblyAI({ apiKey });

                console.log(`[Recording] Starting AssemblyAI transcription for meeting ${meetingId}...`);
                const transcript = await client.transcripts.transcribe({
                    audio: audioFile.path,
                    language_code: "en",
                    speaker_labels: true,
                    auto_punctuation: true,
                    summarization: true,
                    summary_model: "informative",
                    summary_type: "bullets",
                });

                if (transcript.status === "error") {
                    console.error("[Recording] AssemblyAI error:", transcript.error);
                    await sql`UPDATE meetings SET recording_status = 'failed' WHERE id = ${meeting.id}`;
                    return;
                }

                // Format transcript with speaker labels
                let transcriptText = "";
                if (transcript.utterances && transcript.utterances.length > 0) {
                    transcriptText = transcript.utterances
                        .map((u) => `Speaker ${u.speaker}: ${u.text}`)
                        .join("\n");
                } else {
                    transcriptText = transcript.text || "No speech detected";
                }

                const summaryText = transcript.summary || (transcriptText ? `Summary:\n${transcriptText.slice(0, 300)}...` : "No summary available.");

                await sql`
                    UPDATE meetings
                    SET transcript = ${transcriptText},
                        summary = ${summaryText},
                        recording_status = 'done',
                        updated_at = NOW()
                    WHERE id = ${meeting.id}
                `;
                console.log(`[Recording] ✅ Transcription and summary saved for meeting ${meetingId}`);

            } catch (err) {
                console.error("[Recording] Transcription failed:", err);
                await sql`UPDATE meetings SET recording_status = 'failed', updated_at = NOW() WHERE id = ${meeting.id}`;
            } finally {
                // Delete temporary audio file from disk
                if (fs.existsSync(audioFile.path)) {
                    fs.unlinkSync(audioFile.path);
                }
            }
        })();

    } catch (error) {
        console.error("processRecording controller error:", error);
        if (audioFile?.path && fs.existsSync(audioFile.path)) {
            fs.unlinkSync(audioFile.path);
        }
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to process recording" });
        }
    }
};

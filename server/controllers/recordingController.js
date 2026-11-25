import { AssemblyAI } from "assemblyai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Files } from "files-sdk";
import { neon } from "files-sdk/neon";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { sql } from "../config/db.js";
import fs from "fs";
import path from "path";

// Configure ffmpeg static binary
if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
}

// Convert audio (WebM) to MP3 format
const convertToMp3 = (inputPath, outputPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat("mp3")
            .audioBitrate(128)
            .save(outputPath)
            .on("end", () => {
                console.log(`[Recording] Converted audio to MP3 successfully: ${outputPath}`);
                resolve(outputPath);
            })
            .on("error", (err) => {
                console.warn("[Recording] ffmpeg conversion warning/fallback:", err.message);
                reject(err);
            });
    });
};

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

        // 3. Process conversion, object storage upload, transcription & summary asynchronously in background
        (async () => {
            const mp3Path = path.join("uploads/recordings", `recording-${meetingId}-${Date.now()}.mp3`);
            let finalAudioPath = audioFile.path;

            try {
                // Convert WebM to standard MP3
                try {
                    await convertToMp3(audioFile.path, mp3Path);
                    if (fs.existsSync(mp3Path)) {
                        finalAudioPath = mp3Path;
                    }
                } catch (convErr) {
                    console.warn("[Recording] MP3 conversion failed, using original file:", convErr.message);
                }

                // --- 1. Upload MP3 to Neon Object Storage ---
                let recordingUrl = null;
                const s3Key = `recordings/meeting-${meetingId}-${Date.now()}.mp3`;

                if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                    try {
                        console.log(`[Recording] Uploading audio to Neon Object Storage bucket "uploads"...`);
                        const files = new Files({ adapter: neon({ bucket: "uploads" }) });
                        const audioBuffer = fs.readFileSync(finalAudioPath);

                        await files.upload(s3Key, audioBuffer, {
                            contentType: "audio/mpeg",
                        });

                        // Generate 7-day presigned playback & download URL
                        recordingUrl = await files.url(s3Key, { expiresIn: 7 * 24 * 3600 });
                        console.log(`[Recording] ✅ Audio successfully saved to Neon Object Storage! Key: ${s3Key}`);
                    } catch (storageErr) {
                        console.error("[Recording] Neon Object Storage upload failed:", storageErr.message);
                    }
                } else {
                    console.warn("[Recording] AWS_* credentials not found. Skipping Neon Object Storage upload.");
                }

                // --- 2. Transcribe Audio with AssemblyAI ---
                const assemblyApiKey = (process.env.ASSEMBLYAI_API_KEY || "").replace(/['"]/g, "").trim();
                if (!assemblyApiKey) {
                    console.error("[Recording] ASSEMBLYAI_API_KEY is not configured in server environment");
                    await sql`UPDATE meetings SET recording_url = ${recordingUrl}, recording_status = 'failed' WHERE id = ${meeting.id}`;
                    return;
                }

                const client = new AssemblyAI({ apiKey: assemblyApiKey });

                console.log(`[Recording] Starting AssemblyAI transcription with automatic language detection for meeting ${meetingId}...`);
                
                // Transcription with automatic multi-language detection & speaker identification
                const transcript = await client.transcripts.transcribe({
                    audio: finalAudioPath,
                    language_detection: true, // Auto-detects English, Hindi, Spanish, etc.
                    speaker_labels: true,
                    auto_punctuation: true,
                });

                if (transcript.status === "error") {
                    console.error("[Recording] AssemblyAI error:", transcript.error);
                    await sql`UPDATE meetings SET recording_url = ${recordingUrl}, recording_status = 'failed' WHERE id = ${meeting.id}`;
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

                console.log(`[Recording] Transcription complete (${transcriptText.length} chars). Detected language: ${transcript.language_code || 'auto'}`);

                // --- 3. Generate Structured Meeting Summary with Google Gemini ---
                let summaryText = "";
                const geminiApiKey = (process.env.GEMINI_API_KEY || "").replace(/['"]/g, "").trim();

                if (geminiApiKey && transcriptText && transcriptText.length > 20) {
                    try {
                        console.log(`[Recording] Generating summary using Google Gemini (gemini-1.5-flash)...`);
                        const genAI = new GoogleGenerativeAI(geminiApiKey);
                        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

                        const prompt = `You are an expert AI meeting assistant. Analyze the following meeting transcript (which may be in English, Hindi, Spanish, or multilingual) and provide a professional, structured executive meeting summary in English.

Format your response cleanly with these exact sections:

## 📌 Executive Overview
(A concise 2-3 sentence overview of what the meeting was about)

## 🎯 Key Topics Discussed
(Bullet points covering the main themes, discussions, and ideas)

## ✅ Decisions Made
(Bullet points of any agreements, finalized plans, or conclusions reached. If none, write "No formal decisions were finalized.")

## 📋 Action Items & Next Steps
(Bullet points with clear tasks, assignees if mentioned, and next steps. If none, write "No action items assigned.")

Meeting Transcript:
"""
${transcriptText}
"""`;

                        const result = await model.generateContent(prompt);
                        summaryText = result.response.text();
                        console.log(`[Recording] ✅ Gemini summary generated successfully!`);
                    } catch (geminiErr) {
                        console.error("[Recording] Gemini summarization error:", geminiErr.message);
                        summaryText = `Executive Overview:\n${transcriptText.slice(0, 300)}...\n\n(Note: An error occurred with Gemini summarization. Check your GEMINI_API_KEY quota/setup.)`;
                    }
                } else {
                    if (!geminiApiKey) {
                        console.warn("[Recording] GEMINI_API_KEY is not set. Add GEMINI_API_KEY to enable Gemini summaries.");
                        summaryText = transcriptText && transcriptText.length > 20
                            ? `Meeting Summary:\n${transcriptText.slice(0, 300)}...\n\n(Tip: Add GEMINI_API_KEY to your Render environment variables to generate full Gemini AI meeting summaries with action items and key decisions.)`
                            : "No speech detected in this meeting.";
                    } else {
                        summaryText = "No speech detected to summarize.";
                    }
                }

                // --- 4. Update Database ---
                await sql`
                    UPDATE meetings
                    SET recording_url = ${recordingUrl},
                        transcript = ${transcriptText},
                        summary = ${summaryText},
                        recording_status = 'done',
                        updated_at = NOW()
                    WHERE id = ${meeting.id}
                `;
                console.log(`[Recording] ✅ Audio URL, transcription and Gemini summary saved to database for meeting ${meetingId}`);

            } catch (err) {
                console.error("[Recording] Processing failed:", err);
                await sql`UPDATE meetings SET recording_status = 'failed', updated_at = NOW() WHERE id = ${meeting.id}`;
            } finally {
                // Delete temporary files from disk
                if (fs.existsSync(audioFile.path)) {
                    fs.unlinkSync(audioFile.path);
                }
                if (fs.existsSync(mp3Path)) {
                    fs.unlinkSync(mp3Path);
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

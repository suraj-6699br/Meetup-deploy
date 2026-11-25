import { AssemblyAI } from "assemblyai";
import { GoogleGenerativeAI } from "@google/generative-ai";
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
                const assemblyApiKey = (process.env.ASSEMBLYAI_API_KEY || "").replace(/['"]/g, "").trim();
                if (!assemblyApiKey) {
                    console.error("[Recording] ASSEMBLYAI_API_KEY is not configured in server environment");
                    await sql`UPDATE meetings SET recording_status = 'failed' WHERE id = ${meeting.id}`;
                    return;
                }

                const client = new AssemblyAI({ apiKey: assemblyApiKey });

                console.log(`[Recording] Starting AssemblyAI transcription with automatic language detection for meeting ${meetingId}...`);
                
                // Transcription with automatic multi-language detection (English, Hindi, Spanish, etc.) & speaker identification
                const transcript = await client.transcripts.transcribe({
                    audio: audioFile.path,
                    language_detection: true, // Automatically detects the spoken language
                    speaker_labels: true,
                    auto_punctuation: true,
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

                console.log(`[Recording] Transcription complete (${transcriptText.length} chars). Detected language: ${transcript.language_code || 'auto'}`);

                // --- Generate Structured Meeting Summary with Google Gemini ---
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

                await sql`
                    UPDATE meetings
                    SET transcript = ${transcriptText},
                        summary = ${summaryText},
                        recording_status = 'done',
                        updated_at = NOW()
                    WHERE id = ${meeting.id}
                `;
                console.log(`[Recording] ✅ Full transcription and Gemini summary saved to database for meeting ${meetingId}`);

            } catch (err) {
                console.error("[Recording] Processing failed:", err);
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

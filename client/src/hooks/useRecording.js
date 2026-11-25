import { useRef, useCallback, useEffect, useState } from "react";
import api from "../config/api";
import toast from "react-hot-toast";

export const useRecording = (roomId, isHost) => {
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioContextRef = useRef(null);
    const destinationRef = useRef(null);
    const connectedStreamsRef = useRef(new Set());
    const pendingStreamsRef = useRef(new Set());
    
    // recordingState: "idle" | "recording" | "paused"
    const [recordingState, setRecordingState] = useState("idle");
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const timerIntervalRef = useRef(null);

    // Initialize or get the Web Audio API context and destination mixer
    const getOrCreateMixer = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return null;

            const ctx = new AudioContextClass();
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => {});
            }

            const destination = ctx.createMediaStreamDestination();
            audioContextRef.current = ctx;
            destinationRef.current = destination;
        }
        return {
            ctx: audioContextRef.current,
            destination: destinationRef.current,
        };
    }, []);

    // Connect a stream's audio tracks to the destination mixer
    const addStreamToMix = useCallback((stream) => {
        if (!isHost || !stream) return;
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) return;

        pendingStreamsRef.current.add(stream);

        const mixer = getOrCreateMixer();
        if (!mixer || !mixer.ctx || !mixer.destination) return;

        const streamId = stream.id;
        if (connectedStreamsRef.current.has(streamId)) return;
        connectedStreamsRef.current.add(streamId);

        try {
            const audioOnlyStream = new MediaStream(audioTracks);
            const source = mixer.ctx.createMediaStreamSource(audioOnlyStream);
            source.connect(mixer.destination);
        } catch (err) {
            console.error("Error connecting stream to audio mixer:", err);
        }
    }, [isHost, getOrCreateMixer]);

    // Timer management
    const startTimer = useCallback(() => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = setInterval(() => {
            setRecordingSeconds((prev) => prev + 1);
        }, 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
    }, []);

    // Start or Resume recording
    const startRecording = useCallback(() => {
        if (!isHost) return;

        const mixer = getOrCreateMixer();
        if (!mixer) {
            toast.error("Audio recording is not supported on this browser");
            return;
        }

        // Connect any pending streams that arrived before recording started
        pendingStreamsRef.current.forEach((st) => {
            const audioTracks = st.getAudioTracks();
            if (audioTracks.length > 0 && !connectedStreamsRef.current.has(st.id)) {
                try {
                    connectedStreamsRef.current.add(st.id);
                    const audioOnly = new MediaStream(audioTracks);
                    const src = mixer.ctx.createMediaStreamSource(audioOnly);
                    src.connect(mixer.destination);
                } catch (e) {
                    console.error("Error connecting pending stream:", e);
                }
            }
        });

        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
            mediaRecorderRef.current.resume();
            setRecordingState("recording");
            startTimer();
            toast.success("Recording resumed");
            return;
        }

        let mimeType = "audio/webm;codecs=opus";
        if (typeof MediaRecorder !== "undefined") {
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
            }
        }

        try {
            const recorder = new MediaRecorder(mixer.destination.stream, mimeType ? { mimeType } : undefined);
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.start(1000); // 1-second chunks
            mediaRecorderRef.current = recorder;
            setRecordingState("recording");
            startTimer();
            toast.success("Audio recording started!");
        } catch (err) {
            console.error("Failed to start MediaRecorder:", err);
            toast.error("Could not start recording");
        }
    }, [isHost, getOrCreateMixer, startTimer]);

    // Pause recording
    const pauseRecording = useCallback(() => {
        if (!isHost || !mediaRecorderRef.current) return;

        if (mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.pause();
            setRecordingState("paused");
            stopTimer();
            toast("Recording paused");
        }
    }, [isHost, stopTimer]);

    // Stop recording and upload to server
    const stopAndUpload = useCallback(async () => {
        stopTimer();
        if (!isHost || !mediaRecorderRef.current) return;

        return new Promise((resolve) => {
            const recorder = mediaRecorderRef.current;
            setRecordingState("idle");

            recorder.onstop = async () => {
                try {
                    const audioBlob = new Blob(audioChunksRef.current, {
                        type: recorder.mimeType || "audio/webm",
                    });

                    // Only upload if there is recorded audio (> 3KB)
                    if (audioBlob.size > 3000) {
                        toast.loading("Uploading meeting recording...", { id: "upload-rec" });
                        const formData = new FormData();
                        formData.append("audio", audioBlob, `recording-${roomId}.webm`);

                        await api.post(`/api/meetings/${roomId}/recording`, formData);
                        toast.success("Audio recording uploaded! Processing AI summary...", { id: "upload-rec" });
                        console.log("Audio recording successfully uploaded for meeting:", roomId);
                    }
                } catch (err) {
                    console.error("Failed to upload recording:", err);
                    toast.error("Failed to upload recording", { id: "upload-rec" });
                } finally {
                    try {
                        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
                            audioContextRef.current.close().catch(() => {});
                        }
                    } catch {}
                    audioChunksRef.current = [];
                    connectedStreamsRef.current.clear();
                    resolve();
                }
            };

            try {
                if (recorder.state !== "inactive") {
                    recorder.stop();
                } else {
                    resolve();
                }
            } catch (err) {
                console.error("Error stopping recorder:", err);
                resolve();
            }
        });
    }, [isHost, roomId, stopTimer]);

    // Format seconds into MM:SS
    const formatTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopTimer();
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                try {
                    mediaRecorderRef.current.stop();
                } catch {}
            }
            if (audioContextRef.current && audioContextRef.current.state !== "closed") {
                try {
                    audioContextRef.current.close().catch(() => {});
                } catch {}
            }
        };
    }, [stopTimer]);

    return {
        recordingState,
        recordingTime: formatTime(recordingSeconds),
        startRecording,
        pauseRecording,
        addStreamToMix,
        stopAndUpload,
    };
};

import { useRef, useCallback, useEffect } from "react";
import api from "../config/api";

export const useRecording = (roomId, isHost) => {
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioContextRef = useRef(null);
    const destinationRef = useRef(null);
    const connectedStreamsRef = useRef(new Set());
    const isRecordingRef = useRef(false);

    // Initialize the audio context and destination mixer
    const getOrCreateMixer = useCallback(() => {
        if (!audioContextRef.current) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return null;

            const ctx = new AudioContextClass();
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => {});
            }

            const destination = ctx.createMediaStreamDestination();

            let mimeType = "audio/webm;codecs=opus";
            if (typeof MediaRecorder !== "undefined") {
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                    mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
                }
            }

            try {
                const recorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : undefined);
                recorder.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) {
                        audioChunksRef.current.push(e.data);
                    }
                };
                recorder.start(1000); // 1-second chunks
                mediaRecorderRef.current = recorder;
                isRecordingRef.current = true;
            } catch (err) {
                console.error("Failed to start MediaRecorder:", err);
            }

            audioContextRef.current = ctx;
            destinationRef.current = destination;
        }
        return {
            ctx: audioContextRef.current,
            destination: destinationRef.current,
        };
    }, []);

    // Connect a stream to the mixed recording destination
    const addStreamToMix = useCallback((stream) => {
        if (!isHost || !stream) return;
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length === 0) return;

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

    // Stop recording and upload to server
    const stopAndUpload = useCallback(async () => {
        if (!isHost || !mediaRecorderRef.current || !isRecordingRef.current) return;

        return new Promise((resolve) => {
            const recorder = mediaRecorderRef.current;
            isRecordingRef.current = false;

            recorder.onstop = async () => {
                try {
                    const audioBlob = new Blob(audioChunksRef.current, {
                        type: recorder.mimeType || "audio/webm",
                    });

                    // Avoid uploading empty recordings (< 3KB)
                    if (audioBlob.size > 3000) {
                        const formData = new FormData();
                        formData.append("audio", audioBlob, `recording-${roomId}.webm`);

                        await api.post(`/api/meetings/${roomId}/recording`, formData);
                        console.log("Audio recording successfully uploaded for meeting:", roomId);
                    }
                } catch (err) {
                    console.error("Failed to upload recording:", err);
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
    }, [isHost, roomId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
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
    }, []);

    return { addStreamToMix, stopAndUpload };
};

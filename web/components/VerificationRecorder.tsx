"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { VerificationResultCard } from "@/components/VerificationResultCard";
import type { VerificationSession } from "@/lib/types";

type Phase = "idle" | "requesting" | "ready" | "recording" | "uploading" | "done" | "error";

const MAX_SECONDS = 20;

/**
 * Webcam verification recorder.
 *
 * Lives here rather than in a page so the verification hub and the legacy
 * /candidate/verify/[id] URL share one implementation. The camera, the
 * recording and the upload are all local: this component never computes or
 * interprets a score, it only posts the clip and displays what the service
 * returned.
 */
export function VerificationRecorder({
  applicationId,
  jobTitle,
  onComplete,
}: {
  applicationId: string;
  jobTitle?: string;
  onComplete?: (s: VerificationSession) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Always release the camera on unmount -- a stuck webcam light is the fastest
  // way to lose a live demo.
  useEffect(() => stopStream, [stopStream]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
    };
  }, []);

  async function startCamera() {
    setError(null);
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPhase("ready");
    } catch (err) {
      setPhase("error");
      setError(
        `Could not open the camera/microphone: ${(err as Error).message}. Check the browser permission prompt, then retry.`,
      );
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    stopStream();
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) {
      setError("Camera is not running. Start it first.");
      return;
    }
    // Prefer a container the ML stack can decode. Browsers usually offer webm;
    // Safari offers mp4. The extension has to match what we hand to ffmpeg.
    const mime = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(
      (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
    );
    if (!mime) {
      setError("This browser cannot record video in a supported format.");
      setPhase("error");
      return;
    }

    chunksRef.current = [];
    const rec = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      void upload(new Blob(chunksRef.current, { type: mime }));
    };

    rec.start(250);
    setElapsed(0);
    setPhase("recording");
    timerRef.current = setInterval(() => {
      setElapsed((s) => {
        const next = s + 1;
        if (next >= MAX_SECONDS) stopRecording();
        return next;
      });
    }, 1000);
  }

  async function upload(blob: Blob) {
    setPhase("uploading");
    setError(null);
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const form = new FormData();
    form.append("clip", blob, `clip.${ext}`);

    try {
      const res = await fetch(`/api/applications/${applicationId}/verify`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `verification failed (${res.status})`);
      const s = data.session as VerificationSession;
      setSession(s);
      setDiagnostics((data.diagnostics as Record<string, unknown>) ?? null);
      setPhase("done");
      onComplete?.(s);
    } catch (err) {
      setPhase("error");
      setError((err as Error).message);
    }
  }

  const steps: { key: Phase; label: string }[] = [
    { key: "ready", label: "Camera" },
    { key: "recording", label: "Recording" },
    { key: "uploading", label: "Scoring" },
    { key: "done", label: "Result" },
  ];
  const phaseIndex = steps.findIndex((s) => s.key === phase);
  const live = phase === "ready" || phase === "recording";

  return (
    <>
      {error && <div className="msg error">{error}</div>}

      <div className="verify-shell">
        <div className="panel" style={{ marginBottom: 0 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            {steps.map((s, i) => (
              <span
                key={s.key}
                className={
                  "phase-pill" +
                  (phase === "done" ? (i < steps.length ? " done" : "") : i < phaseIndex ? " done" : i === phaseIndex ? " busy" : "")
                }
              >
                {s.label}
              </span>
            ))}
          </div>

          <video
            ref={videoRef}
            playsInline
            muted
            style={{ display: live ? "block" : "none", width: "100%", borderRadius: 8, background: "#000" }}
          />
          {!live && (
            <p className="muted small" style={{ margin: 0 }}>
              Camera preview appears here once you allow access.
            </p>
          )}

          <div className="row" style={{ marginTop: 14 }}>
            {phase === "idle" || phase === "error" || phase === "requesting" ? (
              <button onClick={startCamera} disabled={phase === "requesting"}>
                {phase === "requesting" ? "Requesting…" : phase === "error" ? "Retry camera" : "Start camera"}
              </button>
            ) : null}
            {phase === "ready" ? <button onClick={startRecording}>Start recording</button> : null}
            {phase === "recording" ? (
              <>
                <button className="danger" onClick={stopRecording}>
                  Stop &amp; submit
                </button>
                <span className="badge flagged">
                  {elapsed}s / {MAX_SECONDS}s
                </span>
              </>
            ) : null}
            {phase === "uploading" ? (
              <>
                <button disabled>Scoring clip…</button>
                <span className="muted small">gaze + lip-sync + audio, this can take a minute</span>
              </>
            ) : null}
            {phase === "done" ? (
              <button
                className="secondary"
                onClick={() => {
                  setPhase("idle");
                  setSession(null);
                  setDiagnostics(null);
                  setElapsed(0);
                }}
              >
                Record another clip
              </button>
            ) : null}
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0 }}>
          <h3 style={{ marginTop: 0 }}>What to do</h3>
          <ol className="small muted" style={{ paddingLeft: 18, marginTop: 0 }}>
            <li>Keep your face centred and on screen for the whole clip.</li>
            <li>Speak out loud — the audio track is what lip-sync is measured against.</li>
            <li>Keep the room quiet; a second voice is the strongest gaming signal.</li>
          </ol>
          <h3 style={{ marginTop: 18 }}>Good to know</h3>
          <ul className="small muted" style={{ paddingLeft: 18, margin: 0 }}>
            <li>WebM is recorded by default; ffmpeg on the server converts it.</li>
            <li>
              Lip-sync needs <span className="mono">SYNCNET_REPO_DIR</span> set on the server; without it that signal
              returns a neutral 0.5 and says so.
            </li>
            <li>A flagged result is not an automatic rejection — it routes to a human reviewer.</li>
          </ul>
          {jobTitle ? (
            <p className="muted small" style={{ margin: "14px 0 0" }}>
              Verifying your application for <strong>{jobTitle}</strong>.
            </p>
          ) : null}
        </div>
      </div>

      {phase === "done" && session && (
        <div style={{ marginTop: 16 }}>
          <VerificationResultCard
            session={session}
            actions={
              <>
                <button onClick={() => router.push("/candidate/applications")}>Back to applications</button>
                <button
                  className="secondary"
                  onClick={() => {
                    setPhase("idle");
                    setSession(null);
                    setDiagnostics(null);
                    setElapsed(0);
                  }}
                >
                  Record another clip
                </button>
              </>
            }
          />
          {diagnostics && (
            <details style={{ marginTop: 12 }}>
              <summary className="muted small" style={{ cursor: "pointer" }}>
                Raw service diagnostics
              </summary>
              <pre className="mono muted" style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
                {JSON.stringify(diagnostics, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </>
  );
}

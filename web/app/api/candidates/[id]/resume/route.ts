import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { ensureUploadDir, getDb, nowIso, UPLOAD_DIR } from "@/lib/db";
import { extractResumeText } from "@/lib/ml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [".pdf", ".docx", ".txt", ".md"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();

  const candidate = db.prepare("SELECT id, resumeName FROM candidates WHERE id = ?").get(id) as
    | { id: string; resumeName: string | null }
    | undefined;
  if (!candidate) return NextResponse.json({ error: "candidate not found" }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data with a `file` field" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no `file` field in the request" }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "uploaded file is empty" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `file is too large (max ${MAX_BYTES / 1024 / 1024}MB)` }, { status: 413 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.includes(ext)) {
    return NextResponse.json(
      { error: `unsupported file type ${ext || "(none)"} — use one of: ${ALLOWED.join(", ")}` },
      { status: 415 },
    );
  }

  // Extract first: a file we can't parse should never overwrite a good resume.
  let text: string;
  try {
    text = await extractResumeText(file, file.name);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  ensureUploadDir();
  const storedName = `${id}-${Date.now()}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, storedName), bytes);

  // Drop the previous resume so re-uploading doesn't leak files.
  const previous = db.prepare("SELECT resumePath FROM candidates WHERE id = ?").get(id) as
    | { resumePath: string | null }
    | undefined;
  if (previous?.resumePath && previous.resumePath !== storedName) {
    await fs.rm(path.join(UPLOAD_DIR, previous.resumePath), { force: true }).catch(() => {});
  }

  db.prepare("UPDATE candidates SET resumePath = ?, resumeName = ?, resumeText = ? WHERE id = ?").run(
    storedName,
    file.name,
    text,
    id,
  );

  return NextResponse.json({
    resumeName: file.name,
    characters: text.length,
    preview: text.slice(0, 600),
    uploadedAt: nowIso(),
  });
}

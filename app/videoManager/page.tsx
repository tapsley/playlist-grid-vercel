"use client";

import { useState } from "react";

export default function AdminVideosPage() {
  const [syncResult, setSyncResult] = useState<string>("");
  const [uploadResult, setUploadResult] = useState<string>("");
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);

  async function runSync(formData: FormData) {
    setLoadingSync(true);
    setSyncResult("");

    const body = {
      prefix: String(formData.get("prefix") ?? ""),
      limit: Number(formData.get("limit") ?? 200),
      dryRun: formData.get("dryRun") === "on",
    };

    const secret = String(formData.get("syncSecret") ?? "").trim();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (secret) headers["x-sync-secret"] = secret;

    const res = await fetch("/api/videos/sync", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const json = await res.json();
    setSyncResult(JSON.stringify(json, null, 2));
    setLoadingSync(false);
  }

  async function uploadVideo(formData: FormData) {
    setLoadingUpload(true);
    setUploadResult("");

    const res = await fetch("/api/videos/upload", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    setUploadResult(JSON.stringify(json, null, 2));
    setLoadingUpload(false);
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16, display: "grid", gap: 24 }}>
      <h1>Hello and welcome, this is a little utility to upload videos to my database. Sync will add videos that already exist in GCS to the database. If you upload a video from here, it will be uploaded to the Google Bucket and the Database at the same time so sync is not necessary.</h1>

      <section style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
        <h2>Sync GCS → DB</h2>
        <form
          action={async (fd) => {
            await runSync(fd);
          }}
          style={{ display: "grid", gap: 10 }}
        >
          <input name="prefix" placeholder="prefix (optional), e.g. splatoon_3/" />
          <input name="limit" type="number" defaultValue={200} min={1} max={5000} />
          <label>
            <input name="dryRun" type="checkbox" defaultChecked /> Dry run
          </label>
          <input name="syncSecret" placeholder="sync secret (if required)" />
          <button type="submit" disabled={loadingSync} className="cursor-pointer border-2 border-gray-500 rounded px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-500">
            {loadingSync ? "Syncing..." : "Run Sync"}
          </button>
        </form>
        {syncResult && <pre style={{ whiteSpace: "pre-wrap" }}>{syncResult}</pre>}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
        <h2>Upload Video</h2>
        <form
          action={async (fd) => {
            await uploadVideo(fd);
          }}
          style={{ display: "grid", gap: 10 }}
        >
          <input name="title" placeholder="Title" required />
          <input name="game" placeholder="Game (e.g. Super Mario Galaxy)" required />
          <input name="file" type="file" accept="video/*" required className="cursor-pointer" />
          <button type="submit" disabled={loadingUpload} className="cursor-pointer border-2 border-gray-500 rounded px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-500">
            {loadingUpload ? "Uploading..." : "Upload"}
          </button>
        </form>
        {uploadResult && <pre style={{ whiteSpace: "pre-wrap" }}>{uploadResult}</pre>}
      </section>
    </main>
  );
}
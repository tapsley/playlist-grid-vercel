"use client";

import { useState } from "react";

type VideoItem = {
  id: string;
  name: string;
  game: string | null;
  url: string;
  gcsPath: string;
  contentType: string | null;
  size: number | null;
  createdAt: string;
  updatedAt: string | null;
};

export default function AdminVideosPage() {
  const [syncResult, setSyncResult] = useState<string>("");
  const [uploadResult, setUploadResult] = useState<string>("");
  const [searchResult, setSearchResult] = useState<string>("");
  const [searchItems, setSearchItems] = useState<VideoItem[]>([]);
  const [searchMeta, setSearchMeta] = useState<string>("");
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [previewById, setPreviewById] = useState<Record<string, boolean>>({});

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

  async function runSearch(formData: FormData) {
    setLoadingSearch(true);
    setSearchResult("");
    setSearchItems([]);
    setSearchMeta("");

    const game = String(formData.get("game") ?? "").trim();
    const q = String(formData.get("q") ?? "").trim();
    const limit = Number(formData.get("limit") ?? 25);

    const params = new URLSearchParams();
    if (game) params.set("game", game);
    if (q) params.set("q", q);
    params.set("limit", String(limit));

    const res = await fetch(`/api/videos/search?${params.toString()}`);
    const json = await res.json();

    setSearchResult(JSON.stringify(json, null, 2)); // optional, keep for debugging
    setSearchItems(Array.isArray(json?.items) ? json.items : []);
    setSearchMeta(`Found ${json?.count ?? 0} result(s)`);
    setLoadingSearch(false);
  }

  function togglePreview(id: string) {
    setPreviewById((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: 16, display: "grid", gap: 24 }}>
      <h1>Hello and welcome, this is a little utility to upload videos to my database. Sync will add videos that already exist in GCS to the database. If you upload a video from here, it will be uploaded to the Google Bucket and the Database at the same time so sync is not necessary. Upload only works if you are authenticated in Google Cloud</h1>

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
        <h2>Search Videos</h2>

        <form
          action={async (fd) => {
            await runSearch(fd);
          }}
          style={{ display: "grid", gap: 10 }}
        >
          <input name="game" placeholder="Game (e.g. Mario Kart 8 Deluxe)" />
          <input name="q" placeholder="Keyword (optional)" />
          <input name="limit" type="number" min={1} max={100} defaultValue={25} />
          <button type="submit" disabled={loadingSearch} className="cursor-pointer border-2 border-gray-500 rounded px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-500">
            {loadingSearch ? "Searching..." : "Search"}
          </button>
        </form>

        {!!searchMeta && <p style={{ marginTop: 12 }}>{searchMeta}</p>}

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {searchItems.map((v) => {
            const showPreview = !!previewById[v.id];

            return (
              <article key={v.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
                <div style={{ fontWeight: 600 }}>{v.name}</div>
                <div style={{ fontSize: 14, opacity: 0.8 }}>
                  {v.game ?? "Unknown game"} • {v.contentType ?? "unknown type"}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>{v.gcsPath}</div>

                <button
                  type="button"
                  onClick={() => togglePreview(v.id)}
                  style={{ marginTop: 10 }}
                  className="cursor-pointer border-2 border-gray-500 rounded px-3 py-1 bg-gray-100 hover:bg-gray-200"
                >
                  {showPreview ? "Hide preview" : "Load preview"}
                </button>

                {showPreview && (
                  <div style={{ marginTop: 10, borderRadius: 8, overflow: "hidden", border: "1px solid #ddd" }}>
                    <video
                      controls
                      preload="metadata"
                      playsInline
                      style={{ width: "100%", display: "block", maxHeight: 320, background: "#000" }}
                      src={v.url}
                    />
                  </div>
                )}

                <a href={v.url} target="_blank" rel="noreferrer" className="mx-3 cursor-pointer border-2 border-gray-500 rounded px-3 py-1 bg-gray-100 hover:bg-gray-200">
                  Open video in new tab
                </a>
              </article>
            );
          })}
        </div>
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
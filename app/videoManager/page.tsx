"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type VideoItem = {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  tags: string[];
  game: string | null;
  url: string;
  gcsPath: string;
  contentType: string | null;
  size: number | null;
  createdAt: string;
  updatedAt: string | null;
};

export default function AdminVideosPage() {
  const pageSize = 10;
  const [syncResult, setSyncResult] = useState<string>("");
  const [uploadResult, setUploadResult] = useState<string>("");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [tableMeta, setTableMeta] = useState<string>("");
  const [draftById, setDraftById] = useState<Record<string, { game: string; title: string; description: string; tags: string }>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [loadingTable, setLoadingTable] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [previewVideo, setPreviewVideo] = useState<{ title: string; url: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [gameSort, setGameSort] = useState<"asc" | "desc">("asc");

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
    await loadVideos();
  }

  function toDraft(item: VideoItem) {
    return {
      game: item.game ?? "",
      title: item.title ?? item.name,
      description: item.description ?? "",
      tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
    };
  }

  function normalizeTags(value: string) {
    return value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
      .join(",");
  }

  function isDirty(video: VideoItem) {
    const draft = draftById[video.id] ?? toDraft(video);
    const originalGame = (video.game ?? "").trim();
    const draftGame = draft.game.trim();
    const originalTitle = (video.title ?? video.name).trim();
    const draftTitle = draft.title.trim();
    const originalDescription = (video.description ?? "").trim();
    const draftDescription = draft.description.trim();
    const originalTags = normalizeTags(Array.isArray(video.tags) ? video.tags.join(",") : "");
    const draftTags = normalizeTags(draft.tags);

    return (
      originalGame !== draftGame ||
      originalTitle !== draftTitle ||
      originalDescription !== draftDescription ||
      originalTags !== draftTags
    );
  }

  const loadVideos = useCallback(async () => {
    setLoadingTable(true);
    setTableMeta("");

    const res = await fetch("/api/videos?limit=1000");
    const json = await res.json();
    const items: VideoItem[] = Array.isArray(json?.items) ? (json.items as VideoItem[]) : [];

    setVideos(items);
    setDraftById(
      items.reduce((acc: Record<string, { game: string; title: string; description: string; tags: string }>, item: VideoItem) => {
        acc[item.id] = toDraft(item);
        return acc;
      }, {})
    );
    setTableMeta(`Loaded ${json?.count ?? items.length} video(s)`);
    setLoadingTable(false);
  }, []);

  useEffect(() => {
    void loadVideos();
  }, [loadVideos]);

  const filteredVideos = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) return videos;

    return videos.filter((video) => {
      const haystack = [
        video.game ?? "",
        video.title ?? "",
        video.name,
        video.description ?? "",
        Array.isArray(video.tags) ? video.tags.join(" ") : "",
        video.gcsPath,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [filterText, videos]);

  const sortedVideos = useMemo(() => {
    return [...filteredVideos].sort((a, b) => {
      const gameA = (draftById[a.id]?.game ?? a.game ?? "").trim().toLowerCase();
      const gameB = (draftById[b.id]?.game ?? b.game ?? "").trim().toLowerCase();
      const compared = gameA.localeCompare(gameB);
      return gameSort === "asc" ? compared : -compared;
    });
  }, [draftById, filteredVideos, gameSort]);

  const totalPages = Math.max(1, Math.ceil(sortedVideos.length / pageSize));
  const pagedVideos = useMemo(() => {
    const safePage = Math.min(Math.max(currentPage, 1), totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedVideos.slice(start, start + pageSize);
  }, [currentPage, sortedVideos, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterText]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function updateDraft(id: string, field: "game" | "title" | "description" | "tags", value: string) {
    setDraftById((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { game: "", title: "", description: "", tags: "" }),
        [field]: value,
      },
    }));
  }

  async function saveRow(id: string) {
    const draft = draftById[id] ?? { game: "", title: "", description: "", tags: "" };

    setSavingById((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch("/api/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          game: draft.game,
          title: draft.title,
          description: draft.description,
          tags: draft.tags,
        }),
      });

      const updated = await res.json();
      if (!res.ok) {
        const message = typeof updated?.error === "string" ? updated.error : "Save failed";
        setTableMeta(message);
        return;
      }

      setVideos((prev) => prev.map((video) => (video.id === id ? updated : video)));
      setDraftById((prev) => ({
        ...prev,
        [id]: toDraft(updated),
      }));
      setTableMeta("Saved changes");
    } finally {
      setSavingById((prev) => ({ ...prev, [id]: false }));
    }
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
        <h1>All Videos</h1>
        <input
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          placeholder="Filter table (game, title, description, tags, path)"
          style={{ width: "100%", marginBottom: 10 }}
        />
        <button
          type="button"
          onClick={async () => {
            await loadVideos();
          }}
          disabled={loadingTable}
          className="cursor-pointer border-2 border-gray-500 rounded px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-500"
        >
          {loadingTable ? "Loading..." : "Reload Videos"}
        </button>

        {!!tableMeta && <p style={{ marginTop: 12 }}>{tableMeta}</p>}
        <p style={{ marginTop: 4, opacity: 0.8 }}>
          Showing {pagedVideos.length} of {sortedVideos.length} filtered video(s) • Page {currentPage} of {totalPages}
        </p>

        <div style={{ marginTop: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                  <button
                    type="button"
                    onClick={() => setGameSort((prev) => (prev === "asc" ? "desc" : "asc"))}
                    className="cursor-pointer border-2 border-gray-500 rounded px-2 py-1 bg-gray-100 hover:bg-gray-200"
                  >
                    Game {gameSort === "asc" ? "↑" : "↓"}
                  </button>
                </th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Title</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Description</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Tags</th>
                <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedVideos.map((video) => {
                const dirty = isDirty(video);

                return (
                <tr key={video.id}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, verticalAlign: "top" }}>
                    <input
                      value={draftById[video.id]?.game ?? ""}
                      onChange={(event) => updateDraft(video.id, "game", event.target.value)}
                      placeholder="Game"
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, verticalAlign: "top" }}>
                    <input
                      value={draftById[video.id]?.title ?? ""}
                      onChange={(event) => updateDraft(video.id, "title", event.target.value)}
                      placeholder="Title"
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, verticalAlign: "top" }}>
                    <textarea
                      value={draftById[video.id]?.description ?? ""}
                      onChange={(event) => updateDraft(video.id, "description", event.target.value)}
                      placeholder="Description"
                      style={{ width: "100%", height: 70, overflowY: "auto", resize: "none", whiteSpace: "pre-wrap" }}
                    />
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, verticalAlign: "top" }}>
                    <input
                      value={draftById[video.id]?.tags ?? ""}
                      onChange={(event) => updateDraft(video.id, "tags", event.target.value)}
                      placeholder="tag1, tag2"
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8, verticalAlign: "top", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewVideo({ title: video.title?.trim() || video.name, url: video.url });
                      }}
                      className="cursor-pointer border-2 border-gray-500 rounded px-3 py-1 bg-gray-100 hover:bg-gray-200"
                      style={{ marginRight: 8 }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await saveRow(video.id);
                      }}
                      disabled={!!savingById[video.id] || !dirty}
                      className="cursor-pointer border-2 border-gray-500 rounded px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-500"
                    >
                      {savingById[video.id] ? "Saving..." : "Save"}
                    </button>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                      {dirty ? "Unsaved changes" : "Saved"}
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
            className="cursor-pointer border-2 border-gray-500 rounded px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-500"
          >
            Previous
          </button>

          {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setCurrentPage(page)}
              disabled={page === currentPage}
              className="cursor-pointer border-2 border-gray-500 rounded px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-500"
            >
              {page}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
            className="cursor-pointer border-2 border-gray-500 rounded px-3 py-1 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-500"
          >
            Next
          </button>
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
          <input name="description" placeholder="Description (optional)" />
          <input name="tags" placeholder="Tags (comma-separated, optional)" />
          <input name="game" placeholder="Game (e.g. Super Mario Galaxy)" required />
          <input name="file" type="file" accept="video/*" required className="cursor-pointer" />
          <button type="submit" disabled={loadingUpload} className="cursor-pointer border-2 border-gray-500 rounded px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-300 disabled:text-gray-500">
            {loadingUpload ? "Uploading..." : "Upload"}
          </button>
        </form>
        {uploadResult && <pre style={{ whiteSpace: "pre-wrap" }}>{uploadResult}</pre>}
      </section>

      {previewVideo && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewVideo(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, padding: 12, width: "min(900px, 95vw)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong>{previewVideo.title}</strong>
              <button
                type="button"
                onClick={() => setPreviewVideo(null)}
                className="cursor-pointer border-2 border-gray-500 rounded px-3 py-1 bg-gray-100 hover:bg-gray-200"
              >
                Close
              </button>
            </div>
            <video
              controls
              autoPlay
              preload="metadata"
              playsInline
              style={{ width: "100%", display: "block", maxHeight: 500, background: "#000" }}
              src={previewVideo.url}
            />
          </div>
        </div>
      )}
    </main>
  );
}
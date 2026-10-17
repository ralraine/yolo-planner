"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, Check, Disc3, ListMusic, Music2, Pencil, Plus, Trash2, X } from "lucide-react";
import { parseSpotifyPlaylistId, useSpotifyPlayer } from "./SpotifySystem";

export default function SpotifyPlaylistWidget({ username: _username }: { username: string }) {
  const { playlists, active, hydrated, playback, setActive, add, remove, rename, registerDashboardHost, togglePlayback } = useSpotifyPlayer();
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = title.trim();
    const id = parseSpotifyPlaylistId(url);
    if (!name || name.length > 60) return setError("Playlist name must have 1–60 characters.");
    if (!id) return setError("Paste a complete Spotify playlist URL or spotify:playlist:… URI.");
    if (playlists.some(p => p.spotifyId === id)) return setError("This playlist is already saved.");
    if (playlists.length >= 20) return setError("Maximum 20 playlists per browser account.");
    add(name, id);
    setTitle(""); setUrl(""); setAdding(false); setError("");
  }
  function removeSaved(key: string) {
    const name = playlists.find(p => p.key === key)?.title ?? "this playlist";
    if (!window.confirm(`Remove “${name}” from YOLO? It stays on Spotify.`)) return;
    remove(key);
    if (editKey === key) setEditKey(null);
  }
  function saveRename(key: string) {
    const name = editTitle.trim();
    if (!name || name.length > 60) return setError("Use a playlist name between 1 and 60 characters.");
    rename(key, name); setEditKey(null); setError("");
  }

  return <section className="db-panel db-v56-spotify yolo57-playlist-manager" aria-labelledby="spotify-heading">
    <div className="db-section-heading db-v56-spotify-heading"><div><span className="db-overline">YOUR STUDY SOUNDTRACK</span><h2 id="spotify-heading"><Music2 size={22}/> Spotify playlists</h2><p>Choose your playlist here. The animated vinyl player stays open across YOLO tabs.</p></div><span className="db-v56-spotify-count"><ListMusic size={15}/>{playlists.length} saved</span></div>
    {!hydrated ? <p className="db-help">Loading saved playlists…</p> : <>
      {active ? <>
        <div className="db-v56-player-toolbar"><label htmlFor="yolo57-playlist">Choose playlist</label>
          <select id="yolo57-playlist" className="db-input" value={active.key} onChange={e => setActive(e.target.value)}>{playlists.map(p => <option key={p.key} value={p.key}>{p.title}</option>)}</select>
          <a href={`https://open.spotify.com/playlist/${active.spotifyId}`} target="_blank" rel="noopener noreferrer" title="Open Spotify"><ArrowUpRight size={17}/> Spotify</a>
        </div>
        <div className="yolo58-dashboard-player">
          <div ref={registerDashboardHost} className="yolo58-dashboard-slot" aria-label="Spotify playlist player"/>
          {playback.error && <p role="alert" className="db-error">{playback.error}</p>}
          <div className="yolo58-dashboard-status">
            <div className={`yolo57-manager-disc ${playback.playing ? "is-spinning" : ""}`} aria-hidden="true"><Disc3 size={26}/></div>
            <div><strong>{active.title}</strong><small>{playback.playing ? "Now playing" : playback.buffering ? "Buffering…" : "Use Spotify's player above to listen"}</small></div>
            <button type="button" className="db-btn db-btn-outline" disabled={!playback.ready} onClick={togglePlayback}>{playback.playing ? "Pause" : "Play"}</button>
          </div>
          <p className="db-help">The complete Spotify playlist is displayed here. When music is playing and you open another YOLO tab, your vinyl player follows you automatically.</p>
        </div>
      </> : <div className="db-v56-empty"><Music2 size={26}/><strong>Start your soundtrack</strong><span>Add a Spotify playlist to display the player here. The floating vinyl appears when you start listening.</span></div>}
      <div className="db-v56-spotify-actions"><button type="button" className="db-btn db-btn-outline" onClick={() => { setAdding(v => !v); setError(""); }}>{adding ? <X size={16}/> : <Plus size={16}/>} {adding ? "Cancel" : "Add playlist"}</button>
        {playlists.length > 0 && <button type="button" className="db-v56-manage-button" onClick={() => { setManaging(v => !v); setError(""); }}><Pencil size={15}/>{managing ? "Done managing" : "Manage playlists"}</button>}
      </div>
      {adding && <form className="db-v56-add-form" onSubmit={onSave}><label htmlFor="yolo57-name">Playlist name</label><input id="yolo57-name" required maxLength={60} className="db-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Study Mode"/><label htmlFor="yolo57-url">Spotify playlist link</label><input id="yolo57-url" required className="db-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://open.spotify.com/playlist/…"/><button className="db-btn db-btn-primary" type="submit"><Check size={16}/> Save playlist</button></form>}
      {managing && <div className="db-v56-saved-list">{playlists.map(p=><div className="db-v56-saved-item" key={p.key}>{editKey===p.key?<><input aria-label={`Rename ${p.title}`} className="db-input" value={editTitle} maxLength={60} onChange={e=>setEditTitle(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveRename(p.key);if(e.key==="Escape")setEditKey(null);}}/><button type="button" onClick={()=>saveRename(p.key)} aria-label="Save name"><Check size={16}/></button><button type="button" onClick={()=>setEditKey(null)} aria-label="Cancel"><X size={16}/></button></>:<><span>{p.title}</span><button type="button" onClick={()=>{setEditKey(p.key);setEditTitle(p.title);}} aria-label={`Rename ${p.title}`}><Pencil size={16}/></button><button type="button" onClick={()=>removeSaved(p.key)} aria-label={`Remove ${p.title}`}><Trash2 size={16}/></button></>}</div>)}</div>}
      {error && <p className="db-error" role="alert">{error}</p>}
      <p className="db-v56-footnote">YOLO uses Spotify&apos;s official embedded player. Actual audio and playback controls depend on Spotify account, region, and browser permissions. Playlist names are saved locally in this browser.</p>
    </>}
  </section>;
}

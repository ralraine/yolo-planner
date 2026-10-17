"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { ArrowUpRight, ChevronDown, Disc3, Expand, Pause, Play, Radio, X } from "lucide-react";

export type SavedPlaylist = { key: string; spotifyId: string; title: string };
type SavedState = { playlists: SavedPlaylist[]; activeKey: string | null };
type PlaybackState = { playing: boolean; buffering: boolean; ready: boolean; expanded: boolean; error: string };
type SpotifyContextValue = {
  playlists: SavedPlaylist[]; active: SavedPlaylist | null; hydrated: boolean;
  playback: PlaybackState; setActive: (key: string) => void;
  add: (title: string, spotifyId: string) => void; remove: (key: string) => void;
  rename: (key: string, name: string) => void;
  setExpanded: (expanded: boolean) => void; togglePlayback: () => void;
  registerDashboardHost: (node: HTMLDivElement | null) => void;
  leavePlayer: () => void;
};
const SpotifyContext = createContext<SpotifyContextValue | null>(null);
const PREFIX = "yolo:spotify:v1:";
const ID_PATTERN = /^[a-zA-Z0-9]{22}$/;
const MAX_PLAYLISTS = 20;

export function parseSpotifyPlaylistId(input: string): string | null {
  const value = input.trim();
  const match = /^spotify:playlist:([a-zA-Z0-9]{22})$/i.exec(value);
  if (match) return match[1];
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "open.spotify.com" || url.port || url.username || url.password) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    if (/^intl-[a-z-]+$/i.test(segments[0] ?? "")) segments.shift();
    if (segments[0] === "embed") segments.shift();
    return segments[0] === "playlist" && segments.length === 2 && ID_PATTERN.test(segments[1]) ? segments[1] : null;
  } catch { return null; }
}
function readSaved(key: string): SavedState {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(key) || "null");
    if (!data || typeof data !== "object") throw Error("Invalid storage");
    const object = data as { playlists?: unknown; activeKey?: unknown };
    if (!Array.isArray(object.playlists)) throw Error("Invalid playlists");
    const seen = new Set<string>();
    const playlists: SavedPlaylist[] = [];
    for (const p of object.playlists) {
      if (!p || typeof p !== "object") continue;
      const entry = p as Record<string, unknown>;
      if (typeof entry.spotifyId !== "string" || !ID_PATTERN.test(entry.spotifyId) || seen.has(entry.spotifyId)) continue;
      const title = typeof entry.title === "string" ? entry.title.trim().slice(0, 60) : "";
      const key = typeof entry.key === "string" && entry.key.length <= 90 ? entry.key : entry.spotifyId;
      playlists.push({ key, spotifyId: entry.spotifyId, title: title || "Untitled playlist" });
      seen.add(entry.spotifyId);
      if (playlists.length >= MAX_PLAYLISTS) break;
    }
    const activeKey = typeof object.activeKey === "string" && playlists.some(p => p.key === object.activeKey)
      ? object.activeKey : (playlists[0]?.key ?? null);
    return { playlists, activeKey };
  } catch { return { playlists: [], activeKey: null }; }
}

type SpotifyEvent = { data: { isPaused: boolean; isBuffering: boolean; playingURI?: string } };
type SpotifyController = {
  addListener: (event: string, callback: (event: SpotifyEvent) => void) => void;
  loadEntity: (uri: string) => void;
  togglePlay: () => void;
  destroy: () => void;
};
type SpotifyApi = {
  createController: (mount: HTMLElement, options: { uri: string; width: number; height: number }, callback: (controller: SpotifyController) => void) => void;
};
type SpotifyWindow = Window & {
  onSpotifyIframeApiReady?: (api: SpotifyApi) => void;
  SpotifyIFrameAPI?: SpotifyApi;
};
let apiPromise: Promise<SpotifyApi> | null = null;
function loadSpotifyApi(): Promise<SpotifyApi> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<SpotifyApi>((resolve, reject) => {
    const w = window as SpotifyWindow;
    if (w.SpotifyIFrameAPI) { resolve(w.SpotifyIFrameAPI); return; }
    w.onSpotifyIframeApiReady = api => { w.SpotifyIFrameAPI = api; resolve(api); };
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.onerror = () => { apiPromise = null; reject(Error("Spotify's player script could not load.")); };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function useSpotifyPlayer(): SpotifyContextValue {
  const context = useContext(SpotifyContext);
  if (!context) throw Error("Spotify components must be inside SpotifyProvider");
  return context;
}

export function SpotifyProvider({ username, children }: { username: string; children: ReactNode }) {
  const [state, setState] = useState<SavedState>({ playlists: [], activeKey: null });
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // The mini-player only becomes visible after Spotify reports real playback.
  // It remains available on Pause so the listener can resume, until dismissed.
  const [hasListened, setHasListened] = useState(false);
  const [onDashboard, setOnDashboard] = useState(false);
  const [error, setError] = useState("");
  // ONE stable iframe host: never reparent the iframe, which can reload it
  // in Chromium and interrupt the Spotify playback session.
  const mountRef = useRef<HTMLDivElement | null>(null);
  const dashboardSlotRef = useRef<HTMLDivElement | null>(null);
  const [frameRect, setFrameRect] = useState<{ top: number; left: number; width: number; height: number; visible: boolean }>({top:-9000,left:-9000,width:330,height:352,visible:false});
  const dockSlotRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<SpotifyController | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const active = state.playlists.find(p => p.key === state.activeKey) ?? state.playlists[0] ?? null;
  const activeId = active?.spotifyId ?? null;
  activeIdRef.current = activeId;
  const hydrated = hydratedFor === username;

  useEffect(() => {
    setState(readSaved(`${PREFIX}${username}`));
    setHydratedFor(username);
    setPlayerReady(false);
    setPlaying(false);
    setBuffering(false);
    setExpanded(false);
    setHasListened(false);
    setError("");
  }, [username]);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem(`${PREFIX}${username}`, JSON.stringify(state)); } catch { /* works in memory if storage is disabled */ }
  }, [username, hydrated, state]);

  const registerDashboardHost = useCallback((node: HTMLDivElement | null) => {
    dashboardSlotRef.current = node;
    setOnDashboard(Boolean(node));
  }, []);

  // Position the one persistent player over the Dashboard slot or the expanded
  // dock slot without changing its place in the DOM. Keep the iframe alive.
  useEffect(() => {
    let raf = 0;
    function update() {
      const target = dashboardSlotRef.current ?? (expanded ? dockSlotRef.current : null);
      if (!target) {
        setFrameRect(old => old.visible ? {top:-9000,left:-9000,width:330,height:352,visible:false} : old);
        return;
      }
      const r = target.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const next = { top:r.top, left:r.left, width:r.width, height:r.height, visible:true };
      setFrameRect(old => Math.abs(old.top-next.top)<.5 && Math.abs(old.left-next.left)<.5 && Math.abs(old.width-next.width)<.5 && Math.abs(old.height-next.height)<.5 && old.visible ? old : next);
    }
    function scheduleUpdate() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    }
    const observer = new ResizeObserver(scheduleUpdate);
    if (dashboardSlotRef.current) observer.observe(dashboardSlotRef.current);
    if (dockSlotRef.current) observer.observe(dockSlotRef.current);
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    scheduleUpdate();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [expanded, onDashboard, activeId, hasListened]);

  const leavePlayer = useCallback(() => {
    // Explicitly stop listening. Paused sessions stay accessible otherwise.
    if (playing) controllerRef.current?.togglePlay();
    setHasListened(false);
    setExpanded(false);
  }, [playing]);

  // Create ONE Spotify controller in an always-mounted iframe host. Navigation
  // repositions the overlay, not the iframe itself.
  useEffect(() => {
    if (!hydrated || !activeId || !mountRef.current) return;
    let cancelled = false;
    const container = mountRef.current;
    loadSpotifyApi().then(api => {
      if (cancelled) return;
      api.createController(container, { uri: `spotify:playlist:${activeIdRef.current}`, width: 330, height: 352 }, controller => {
        if (cancelled) { controller.destroy(); return; }
        controllerRef.current = controller;
        loadedIdRef.current = activeIdRef.current;
        controller.addListener("ready", () => { if (!cancelled) setPlayerReady(true); });
        controller.addListener("playback_update", (event) => {
          if (cancelled) return;
          const isPlaying = !event.data.isPaused && !event.data.isBuffering;
          setPlaying(isPlaying);
          setBuffering(!!event.data.isBuffering);
          if (isPlaying) setHasListened(true);
        });
      });
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Spotify unavailable"); });
    return () => {
      cancelled = true;
      controllerRef.current?.destroy();
      controllerRef.current = null;
      loadedIdRef.current = null;
    };
  // We only recreate when going from zero saved playlists to some playlists.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, !!activeId, username]);

  useEffect(() => {
    if (!playerReady || !activeId || !controllerRef.current || loadedIdRef.current === activeId) return;
    loadedIdRef.current = activeId;
    setPlaying(false);
    setHasListened(false);
    controllerRef.current.loadEntity(`spotify:playlist:${activeId}`);
  }, [activeId, playerReady]);

  const contextValue = useMemo<SpotifyContextValue>(() => ({
    playlists: state.playlists, active, hydrated,
    playback: { playing, buffering, ready: playerReady, expanded, error },
    setActive: (key: string) => setState(s => ({ ...s, activeKey: key })),
    add: (title: string, spotifyId: string) => setState(s => {
      if (s.playlists.length >= MAX_PLAYLISTS || s.playlists.some(p => p.spotifyId === spotifyId)) return s;
      const item = { key: spotifyId, spotifyId, title };
      return { playlists: [...s.playlists, item], activeKey: item.key };
    }),
    remove: (key: string) => setState(s => {
      const playlists = s.playlists.filter(p => p.key !== key);
      return { playlists, activeKey: s.activeKey === key ? (playlists[0]?.key ?? null) : s.activeKey };
    }),
    rename: (key: string, title: string) => setState(s => ({ ...s, playlists: s.playlists.map(p => p.key === key ? { ...p, title } : p) })),
    setExpanded, registerDashboardHost, leavePlayer,
    togglePlayback: () => {
      if (!controllerRef.current || !playerReady) { setExpanded(true); return; }
      // Play/Pause is issued to Spotify. The record animates only after Spotify
      // actually sends a playback_update (no fake optimistic playing state).
      controllerRef.current.togglePlay();
    },
  }), [state.playlists, active, hydrated, playing, buffering, playerReady, expanded, error, registerDashboardHost, leavePlayer]);

  const floatVisible = Boolean(hydrated && active && hasListened && !onDashboard);
  return <SpotifyContext.Provider value={contextValue}>
    {children}
    <aside
      className={`yolo57-music-dock ${expanded ? "yolo57-dock-expanded" : ""} ${floatVisible ? "" : "yolo58-dock-hidden"}`}
      aria-label="Spotify music player"
      aria-hidden={!floatVisible}
      inert={!floatVisible}
    >
      {active && <div className="yolo57-music-top">
        <div className="yolo57-turntable" aria-hidden="true">
          <div className={`yolo57-disc ${playing ? "is-spinning" : ""}`}><div className="yolo57-label"><Disc3 size={20}/></div></div>
          <div className={`yolo57-tonearm ${playing ? "is-on-record" : ""}`}><i/></div>
        </div>
        <div className="yolo57-song-info"><strong title={active.title}>{active.title}</strong><span><Radio size={12}/> {buffering ? "Loading…" : playing ? "Playing on Spotify" : "Paused · tap Play to resume"}</span></div>
        <button type="button" className="yolo57-music-play" disabled={!playerReady} onClick={() => contextValue.togglePlayback()} title={playing ? "Pause Spotify" : "Play Spotify"} aria-label={playing ? "Pause Spotify" : "Play Spotify"}>{playing ? <Pause size={19}/> : <Play size={19}/>}</button>
        <button type="button" className="yolo57-music-expand" onClick={() => setExpanded(v => !v)} title={expanded ? "Minimize player" : "Expand player"} aria-label={expanded ? "Minimize Spotify player" : "Expand Spotify player"}>{expanded ? <ChevronDown size={19}/> : <Expand size={18}/>}</button>
        <button type="button" className="yolo58-dismiss" onClick={leavePlayer} aria-label="Stop listening and hide music player" title="Stop & hide"><X size={17}/></button>
      </div>}
      <div className={`yolo57-spotify-embed ${expanded ? "is-expanded" : ""}`}>
        <div ref={dockSlotRef} className="yolo58-dock-slot"/>
        {error && <p role="alert" className="yolo57-spotify-error">{error}</p>}
        {active && <a href={`https://open.spotify.com/playlist/${active.spotifyId}`} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={15}/> Open playlist in Spotify</a>}
      </div>
    </aside>
    {/* Permanently mounted: the actual Spotify iframe never reinitializes on tab changes. */}
    <div className="yolo58-player-overlay"
      aria-hidden={!frameRect.visible}
      inert={!frameRect.visible}
      style={{top:frameRect.top,left:frameRect.left,width:frameRect.width,height:frameRect.height,opacity:frameRect.visible?1:0,zIndex:onDashboard?48:66,pointerEvents:frameRect.visible?"auto":"none"}}>
      <div ref={mountRef} className="yolo57-spotify-mount"/>
    </div>
  </SpotifyContext.Provider>;
}

import { useEffect, useRef, useState } from "react";
import { Flame, QrCode, StickyNote, ExternalLink, LogOut, RefreshCw, FlaskConical, ArrowUp, Wifi } from "lucide-react";
import { adminAction, adminSession, listSubmissions, type Submission, type SubmissionCursor, type WallState } from "@/lib/api";

const modeLabels = { qr: "QR code", wall: "Filling wall", scroll: "Scrolling notes", burn: "Burned away" };

export default function Admin() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [state, setState] = useState<WallState | null>(null);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Submission[]>([]);
  const cursorRef = useRef<SubmissionCursor | null>(null);
  const sessionRef = useRef("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const resetFeed = (nextState: WallState) => {
    setState(nextState);
    setCount(0);
    setItems([]);
    cursorRef.current = null;
    sessionRef.current = "";
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const session = await adminSession();
        if (!active) return;
        if (session.authenticated) {
          const nextState = await adminAction("openAdmin");
          if (!active) return;
          resetFeed(nextState);
        }
        setAuthenticated(session.authenticated);
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setChecking(false);
      }
    };
    void initialize();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authenticated || checking) return;
    let active = true;
    const load = async () => {
      try {
        const submissions = await listSubmissions(true, sessionRef.current, cursorRef.current);
        if (active) {
          setState(submissions.state);
          if (submissions.reset) {
            setCount(submissions.total);
            setItems(submissions.items.slice(-100));
          } else if (submissions.items.length) {
            setCount(previous => previous + submissions.items.length);
            setItems(previous => [...previous, ...submissions.items].slice(-100));
          }
          sessionRef.current = submissions.state.session;
          cursorRef.current = submissions.cursor;
          setError("");
        }
      } catch (err) { if (active) setError((err as Error).message); }
    };
    void load();
    const timer = window.setInterval(load, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [authenticated, checking]);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await adminAction("login", { password });
      setPassword("");
      setAuthenticated(true);
      setChecking(true);
      resetFeed(await adminAction("openAdmin"));
    }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); setChecking(false); }
  };

  const changeMode = async (mode: WallState["mode"]) => {
    if (state?.testMode && mode === "qr") return;
    if (mode === "burn" && !window.confirm(state?.testMode
      ? "Burn the demo sticky notes on the display? You can return to Fill wall or Scroll notes during this test."
      : "Burn the sticky notes on the display and close submissions?")) return;
    setBusy(true); setError("");
    try { setState(await adminAction("mode", { mode })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const startSession = async () => {
    if (state?.testMode) return;
    if (count > 0 && !window.confirm("Start a new session? Existing notes will leave the active wall and the old QR code will expire. The new code stays hidden until you press Show QR code.")) return;
    setBusy(true); setError("");
    try {
      resetFeed(await adminAction("newSession"));
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const toggleTest = async () => {
    if (!state) return;
    setBusy(true); setError("");
    try {
      const nextState = state.testMode
        ? await adminAction("endTest", { session: state.session })
        : await adminAction("startTest");
      setState(nextState);
      const submissions = await listSubmissions(true);
      setCount(submissions.total);
      setItems(submissions.items.slice(-100));
      sessionRef.current = submissions.state.session;
      cursorRef.current = submissions.cursor;
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  const toggleWifi = async () => {
    if (!state || state.testMode) return;
    setBusy(true); setError("");
    try { setState(await adminAction("wifi", { visible: !state.wifiVisible })); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  if (checking) return <div className="min-h-screen texture-bg" />;

  if (!authenticated) return (
    <div className="min-h-screen texture-bg flex items-center justify-center p-4">
      <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-amber-100 bg-white/90 p-8 text-center shadow-xl">
        <img src="/dusshera-sabha-mythic-archer-duel.png" alt="Dusshera Sabha" className="mx-auto mb-5 h-32 w-auto object-contain" />
        <h1 className="font-serif text-2xl text-amber-950">Wall controls</h1>
        <p className="mt-2 text-sm text-amber-800/70">Enter the admin password to run the display.</p>
        <input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoFocus placeholder="Admin password"
          className="mt-6 w-full rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 outline-none focus:border-amber-500" />
        <button disabled={busy} className="mt-4 w-full rounded-lg bg-amber-700 px-4 py-3 font-semibold text-white hover:bg-amber-800 disabled:opacity-60">Sign in</button>
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );

  return (
    <div className="min-h-screen texture-bg p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="font-serif text-3xl text-amber-950">Dusshera Sabha · Wall controls</h1><p className="mt-1 text-amber-900/65">Opening this dashboard starts a new session with the QR code hidden.</p></div>
          <div className="flex gap-3">
            <a href="/display" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white/90 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-white"><ExternalLink size={16} /> Open display</a>
            <button onClick={async () => { await adminAction("logout"); setAuthenticated(false); }} className="rounded-lg border border-amber-300 bg-white/90 p-2 text-amber-900" aria-label="Sign out"><LogOut size={18} /></button>
          </div>
        </header>
        {state?.testMode && <div role="status" className="mb-5 rounded-xl border-2 border-violet-500 bg-violet-100 px-5 py-4 font-semibold text-violet-950">
          <div className="flex items-center gap-2 text-lg"><FlaskConical size={22} /> TEST MODE</div>
          <p className="mt-1 text-sm font-normal">The projector is showing demo notes. Switch between Fill wall, Scroll notes, and Burn away to rehearse. Guest submissions are paused. End the test to restore your previous wall and QR code.</p>
        </div>}
        <div className="mb-5 flex flex-wrap gap-3">
          <button disabled={busy || state?.testMode} onClick={startSession} className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"><RefreshCw size={16} /> Start new session</button>
          <p className="self-center text-sm text-amber-900/70">Reloading this dashboard also creates a new QR code and empty wall. The code stays hidden until you select Show QR code.</p>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <button disabled={busy || state?.testMode} onClick={() => changeMode("qr")} className={`admin-mode ${state?.mode === "qr" ? "admin-mode-active" : ""}`}><QrCode size={30} /><span className="font-semibold">Show QR code</span><small>Reveal the current session code</small></button>
          <button disabled={busy} onClick={() => changeMode("wall")} className={`admin-mode ${state?.mode === "wall" ? "admin-mode-active" : ""}`}><StickyNote size={30} /><span className="font-semibold">Fill wall</span><small>Add or replace one note every 2 seconds</small></button>
          <button disabled={busy} onClick={() => changeMode("scroll")} className={`admin-mode ${state?.mode === "scroll" ? "admin-mode-active" : ""}`}><ArrowUp size={30} /><span className="font-semibold">Scroll notes</span><small>Loop the latest 100 notes upward</small></button>
          <button disabled={busy || state?.mode === "burn"} onClick={() => changeMode("burn")} className={`admin-mode ${state?.mode === "burn" ? "admin-mode-active" : ""}`}><Flame size={30} /><span className="font-semibold">Burn away</span><small>Animate the notes into smoke</small></button>
        </div>
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-white/90 p-4 shadow-lg">
          <button disabled={busy || !state || state.testMode} onClick={toggleWifi} aria-pressed={Boolean(state?.wifiVisible)} className={`inline-flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white disabled:opacity-50 ${state?.wifiVisible ? "bg-amber-800 hover:bg-amber-900" : "bg-amber-700 hover:bg-amber-800"}`}>
            <Wifi size={20} /> {state?.wifiVisible ? "Hide Wi-Fi network" : "Show Wi-Fi network"}
          </button>
          <p className="text-sm text-amber-900/75">{state?.wifiVisible ? "Wi-Fi square is on and appears below the logo when the QR screen is shown." : "Wi-Fi square is hidden. Show it when guests need network access."}</p>
        </div>
        <div className="mb-5 flex flex-wrap gap-3">
          <button disabled={busy || !state} onClick={toggleTest} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${state?.testMode ? "bg-violet-800 hover:bg-violet-900" : "bg-violet-600 hover:bg-violet-700"}`}><FlaskConical size={16} /> {state?.testMode ? "End test and restore wall" : "Start 100-note test"}</button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
        <div className="mb-3 flex justify-between text-sm text-amber-900/75"><span>Display: <strong>{state ? modeLabels[state.mode] : "Loading…"}</strong></span><span>{count} sticky {count === 1 ? "note" : "notes"}</span></div>
        <section className="mb-5 rounded-2xl border border-amber-200 bg-white/90 p-4 shadow-lg" aria-label="Incoming notes">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-serif text-xl text-amber-950">Incoming notes</h2><p className="text-sm text-amber-800/70">Notes appear automatically in the selected display mode. Showing the latest {Math.min(items.length, 100)} here.</p></div>
          </div>
          {items.length === 0 ? <p className="text-sm text-amber-800/60">New notes will appear here as they arrive.</p> :
            <div className="flex max-h-64 flex-wrap content-start gap-2 overflow-y-auto">
              {items.slice().reverse().map(item => <span key={item.id} title={item.message} className="max-w-full rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-950 shadow-sm"><span className="block max-w-72 truncate">{item.message}</span></span>)}
            </div>}
        </section>
        <div className="aspect-video overflow-hidden rounded-2xl border-4 border-amber-200 bg-amber-950 shadow-2xl"><iframe src="/display" title="Live display preview" className="h-full w-full border-0" /></div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { createSubmission, getState, type Submission } from "@/lib/api";
import { buildNoteStyle } from "@/lib/sticky-note";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const COLORS = [
  { id: "golden",      name: "Golden Saffron", bg: "#fef08a", border: "#d97706" },
  { id: "rose",        name: "Deep Rose",       bg: "#ffe4e6", border: "#be185d" },
  { id: "deepBlue",    name: "Midnight Blue",   bg: "#dbeafe", border: "#1d4ed8" },
  { id: "forestGreen", name: "Sacred Forest",   bg: "#dcfce7", border: "#15803d" },
];

const TEXTURES = [
  { id: "plain",  name: "Plain"  },
  { id: "ruled",  name: "Ruled"  },
  { id: "dotted", name: "Dotted" },
];

const FONT_COLORS = [
  { id: "warm",    name: "Warm Brown",   hex: "#5c2a0a" },
  { id: "crimson", name: "Crimson",      hex: "#9b1b1b" },
  { id: "indigo",  name: "Indigo",       hex: "#312075" },
  { id: "forest",  name: "Forest Green", hex: "#1a4731" },
  { id: "ink",     name: "Classic Ink",  hex: "#1a1a2e" },
];

const SYMBOLS = [
  { id: "none",    label: "None",  emoji: "" },
  { id: "namaste", label: "Pray",  emoji: "🙏" },
  { id: "heart",   label: "Heart", emoji: "❤️" },
  { id: "hug",     label: "Hug",   emoji: "🤗" },
];

const PANEL_CLASS =
  "bg-white/85 backdrop-blur-sm rounded-2xl shadow-xl border border-amber-100";

function BrandMark({ className = "" }: { className?: string }) {
  return (
    <img
      src="/diwali-sabha-artwork.png"
      alt="Diwali Sabha artwork with festive diyas"
      className={`w-full max-w-80 aspect-[32/27] object-cover object-center ${className}`}
    />
  );
}

function FormBranding() {
  return (
    <div className="flex justify-center mb-6">
      <BrandMark />
    </div>
  );
}

function NotePreview({
  noteStyle,
  selectedFontColor,
  displayMessage,
  isEmpty,
  symbolEmoji,
}: {
  noteStyle: React.CSSProperties;
  selectedFontColor: { hex: string };
  displayMessage: string;
  isEmpty: boolean;
  symbolEmoji: string;
}) {
  return (
    <div className="flex flex-col items-center py-1">
      <p className="text-center text-amber-600/60 text-xs uppercase tracking-widest font-bold mb-3">Preview</p>
      <div className="relative" style={{ perspective: "800px" }}>
        <div className="absolute -inset-6 bg-amber-400/10 blur-2xl rounded-full pointer-events-none" />
        <div
          className="relative w-64 h-64 sm:w-72 sm:h-72 shadow-2xl flex flex-col paper-texture"
          style={noteStyle}
          data-testid="preview-card"
        >
          <div className="sticky-tape" />
          <div className="flex-grow flex flex-col justify-center items-center text-center px-6 pt-6 pb-4">
            <div
              className="w-full text-center font-sans font-medium mb-2 leading-snug"
              style={{
                color: selectedFontColor.hex,
                fontSize: "0.66rem",
                opacity: 0.72,
                letterSpacing: "0.04em",
              }}
            >
              Light a diya of gratitude...
            </div>
            <div
              className={`font-caveat leading-snug break-words w-full${isEmpty ? " italic opacity-35" : ""}`}
              style={{ color: selectedFontColor.hex, fontSize: "1.85rem" }}
            >
              {displayMessage}
            </div>
          </div>
          {symbolEmoji && (
            <div
              className="absolute bottom-3 right-4 leading-none select-none"
              style={{ fontSize: "2.25rem", opacity: 0.88, transform: "rotate(-9deg)" }}
            >
              {symbolEmoji}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Soft-block: remember (per browser tab) that this person already shared, so the
// form is replaced by their bead. It's intentionally easy to bypass (new tab /
// clear storage) — just enough to discourage accidental double submissions.
const SUBMITTED_KEY = "tribute_submitted";

function readSubmitted(storageKey: string): Submission | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Submission) : null;
  } catch {
    return null;
  }
}

export default function Home() {
  const qrSession = new URLSearchParams(window.location.search).get("session") ?? undefined;
  const submittedKey = `${SUBMITTED_KEY}:${qrSession ?? "direct"}`;
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submittedSubmission, setSubmittedSubmission] = useState<Submission | null>(() => readSubmitted(submittedKey));
  const submitted = submittedSubmission !== null;
  // The form always renders without first fetching settings — that avoids a
  // /api/settings call (and a loading flash) on every page open, which matters
  // when the whole audience loads this page at once. If submissions happen to be
  // closed, the submit request fails with a 400 and we show the closed screen.
  const [submissionsClosed, setSubmissionsClosed] = useState(false);
  const [testPaused, setTestPaused] = useState(false);

  useEffect(() => {
    let active = true;
    getState().then(state => { if (active) setTestPaused(state.testMode); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const [message,     setMessage]     = useState("");
  const [colorId,     setColorId]     = useState("golden");
  const [textureId,   setTextureId]   = useState("plain");
  const [fontColorId, setFontColorId] = useState("warm");
  const [symbolId,    setSymbolId]    = useState("none");

  const selectedColor     = COLORS.find(c => c.id === colorId)       || COLORS[0];
  const selectedFontColor = FONT_COLORS.find(f => f.id === fontColorId) || FONT_COLORS[0];
  const selectedSymbol    = SYMBOLS.find(s => s.id === symbolId)      || SYMBOLS[0];
  const isEmpty         = message.trim() === "";
  const displayMessage  = isEmpty ? "thankfulness, joy, blessings, love..." : message;
  const noteStyle         = buildNoteStyle(selectedColor.bg, textureId);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setIsPending(true);
    setErrorMessage("");
    try {
      const submission = await createSubmission({
          message:     message.trim(),
          colorStyle:  colorId as Submission["colorStyle"],
          texture:     textureId as Submission["texture"],
          fontColor:   fontColorId as Submission["fontColor"],
          symbol:      symbolId as Submission["symbol"],
          session:     qrSession,
      });
          try {
            sessionStorage.setItem(submittedKey, JSON.stringify(submission));
          } catch {
            // sessionStorage unavailable (private mode / disabled) — the in-memory
            // state below still shows the success screen for this session.
          }
          setSubmittedSubmission(submission);
    } catch (err) {
          // The server returns 400 with this message when submissions are
          // closed; show the closed screen instead of the generic error.
          const status = (err as { status?: number })?.status;
          const serverMessage = (err as { data?: { error?: string } })?.data?.error ?? "";
          if (status === 423) {
            setTestPaused(true);
          } else if (status === 400 && /closed/i.test(serverMessage)) {
            setSubmissionsClosed(true);
          } else {
            setErrorMessage(serverMessage || "Something went wrong. Please try again.");
          }
    } finally {
      setIsPending(false);
    }
  };

  if (testPaused) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 texture-bg">
        <div className="w-full max-w-md rounded-2xl border border-violet-200 bg-white/90 p-8 text-center shadow-xl">
          <FormBranding />
          <h1 className="text-xl font-serif text-amber-900" data-testid="test-paused-heading">Wall testing in progress</h1>
          <p className="mt-3 text-amber-700/70">Guest submissions are temporarily paused. Your QR code will work again when testing ends.</p>
          <button onClick={() => { void getState().then(state => setTestPaused(state.testMode)).catch(() => setErrorMessage("Could not check the wall. Please try again.")); }}
            className="mt-5 rounded-lg bg-amber-700 px-5 py-3 font-semibold text-white hover:bg-amber-800">Check again</button>
          {errorMessage && <p role="alert" className="mt-3 text-sm text-red-600">{errorMessage}</p>}
        </div>
      </div>
    );
  }

  if (submissionsClosed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 texture-bg">
        <div className="w-full max-w-md flex flex-col items-center">
          <div className={`text-center p-10 w-full ${PANEL_CLASS}`}>
          <FormBranding />
          <h1 className="text-xl font-serif text-amber-900 mb-3" data-testid="closed-heading">
            Thank you's are closed for now
          </h1>
          <p className="text-amber-700/70" data-testid="closed-message">
            We appreciate your love — check back soon.
          </p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted && submittedSubmission) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 texture-bg">
        <div className="w-full max-w-md flex flex-col items-center">
          <div className={`text-center p-10 w-full ${PANEL_CLASS}`}>
          <NotePreview
            noteStyle={buildNoteStyle(COLORS.find(c => c.id === submittedSubmission.colorStyle)?.bg ?? COLORS[0].bg, submittedSubmission.texture)}
            selectedFontColor={{ hex: FONT_COLORS.find(f => f.id === submittedSubmission.fontColor)?.hex ?? FONT_COLORS[0].hex }}
            displayMessage={submittedSubmission.message}
            isEmpty={false}
            symbolEmoji={SYMBOLS.find(s => s.id === submittedSubmission.symbol)?.emoji ?? ""}
          />
          <h1 className="text-xl font-serif text-amber-900 mb-3" data-testid="success-heading">
            Your sticky note was sent
          </h1>
          <p className="text-amber-700/70" data-testid="success-message">
            It will appear automatically when the wall is shown.
          </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen texture-bg p-4 sm:p-6 font-sans">

      <div className="max-w-md mx-auto flex flex-col items-center">
        <div className={`w-full p-6 sm:p-7 ${PANEL_CLASS}`}>
        <FormBranding />

        <div className="space-y-5">

          {/* Message */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">
              Light a diya of gratitude...
            </div>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value.slice(0, 120))}
              className="min-h-[90px] bg-amber-50/60 border-amber-200 focus-visible:ring-amber-400 resize-none text-base text-amber-900 placeholder:text-amber-600/30 placeholder:italic"
              placeholder="thankfulness, joy, blessings, love..."
              data-testid="input-message"
            />
            <div className="text-right text-xs text-amber-400 mt-1">{message.length} / 120</div>
          </div>

          <NotePreview
            noteStyle={noteStyle}
            selectedFontColor={selectedFontColor}
            displayMessage={displayMessage}
            isEmpty={isEmpty}
            symbolEmoji={selectedSymbol.emoji}
          />

          {/* Paper Color */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">
              Paper Color
            </label>
            <div className="flex gap-3" data-testid="select-color">
              {COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setColorId(c.id)}
                  title={c.name}
                  className={`w-11 h-11 rounded-lg shadow-sm transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] hover:scale-110 ${
                    colorId === c.id ? "ring-2 ring-offset-2 ring-amber-500 scale-110" : ""
                  }`}
                  style={{ backgroundColor: c.bg, border: `2px solid ${c.border}50` }}
                />
              ))}
            </div>
          </div>

          {/* Paper Texture */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">
              Paper Texture
            </label>
            <div className="flex gap-2">
              {TEXTURES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTextureId(t.id)}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors duration-150 active:scale-[0.98] ${
                    textureId === t.id
                      ? "border-amber-500 bg-amber-50 text-amber-900 font-semibold"
                      : "border-amber-100 hover:border-amber-300 text-amber-700"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Ink Color */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">
              Ink Color
            </label>
            <div className="flex gap-3">
              {FONT_COLORS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFontColorId(f.id)}
                  title={f.name}
                  className={`w-8 h-8 rounded-full shadow-sm transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] hover:scale-110 ${
                    fontColorId === f.id ? "ring-2 ring-offset-2 ring-amber-500 scale-110" : ""
                  }`}
                  style={{ backgroundColor: f.hex }}
                />
              ))}
            </div>
          </div>

          {/* Symbol */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">
              Add a Symbol
            </label>
            <div className="flex gap-2 flex-wrap">
              {SYMBOLS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSymbolId(s.id)}
                  title={s.label}
                  aria-label={s.label}
                  className={`w-11 h-11 rounded-lg border transition-colors duration-150 active:scale-[0.97] flex items-center justify-center ${
                    symbolId === s.id
                      ? "border-amber-500 bg-amber-50 shadow-sm"
                      : "border-amber-100 hover:border-amber-300"
                  }`}
                >
                  {s.emoji
                    ? <span className="text-2xl leading-none">{s.emoji}</span>
                    : <span className="text-amber-400 text-lg leading-none">—</span>
                  }
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!message.trim() || isPending}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white shadow-md h-11 text-base mt-1 disabled:opacity-50 transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
            data-testid="button-submit"
          >
            {isPending ? "Submitting…" : "Submit"}
          </Button>

          {errorMessage && (
            <p role="alert" className="text-center text-sm text-red-500">{errorMessage}</p>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

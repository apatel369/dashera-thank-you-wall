import React, { useEffect, useState } from "react";
import { createSubmission, getState, type Submission } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CrackerArt } from "@/components/cracker-art";
import { CrackerCard } from "@/components/cracker-card";
import {
  CRACKER_TYPES,
  CRACKER_LABELS,
  type CrackerType,
  type CrackerColor,
  crackerForId,
} from "@/lib/crackers";
import {
  PROMPT,
  PLACEHOLDER,
  MESSAGE_MAX,
  FORM_BADGE,
  SUCCESS_HEADING,
  SUCCESS_BODY,
  CLOSED_HEADING,
  CLOSED_BODY,
  CENTER_ART,
} from "@/lib/theme";

const COLORS: { id: CrackerColor; name: string; bg: string; border: string }[] = [
  { id: "golden",      name: "Golden Saffron", bg: "#fef08a", border: "#d97706" },
  { id: "rose",        name: "Deep Rose",       bg: "#ffe4e6", border: "#be185d" },
  { id: "deepBlue",    name: "Midnight Blue",   bg: "#dbeafe", border: "#1d4ed8" },
  { id: "forestGreen", name: "Sacred Forest",   bg: "#dcfce7", border: "#15803d" },
];

const PANEL_CLASS =
  "bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-amber-100";

function FormBranding() {
  return (
    <div className="flex flex-col items-center mb-6">
      <img
        src={CENTER_ART}
        alt="Diwali Diya"
        className="w-28 h-24 object-contain drop-shadow-sm mb-2"
      />
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/90 text-amber-900 border border-amber-200 shadow-xs">
        {FORM_BADGE}
      </span>
    </div>
  );
}

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

  const [submissionsClosed, setSubmissionsClosed] = useState(false);
  const [testPaused, setTestPaused] = useState(false);

  useEffect(() => {
    let active = true;
    getState().then(state => { if (active) setTestPaused(state.testMode); }).catch(() => {});
    return () => { active = false; };
  }, []);

  const [message, setMessage] = useState("");
  const [crackerType, setCrackerType] = useState<CrackerType>("anar");
  const [colorId, setColorId] = useState<CrackerColor>("golden");

  const isEmpty = message.trim() === "";
  const displayMessage = isEmpty ? PLACEHOLDER : message;

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setIsPending(true);
    setErrorMessage("");
    try {
      const submission = await createSubmission({
        message: message.trim(),
        colorStyle: colorId,
        cracker: crackerType,
        session: qrSession,
      });
      try {
        sessionStorage.setItem(submittedKey, JSON.stringify(submission));
      } catch {
        // sessionStorage unavailable in private mode
      }
      setSubmittedSubmission(submission);
    } catch (err) {
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
          <button
            onClick={() => {
              void getState().then(state => setTestPaused(state.testMode)).catch(() => setErrorMessage("Could not check the wall. Please try again."));
            }}
            className="mt-5 rounded-lg bg-amber-700 px-5 py-3 font-semibold text-white hover:bg-amber-800"
          >
            Check again
          </button>
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
              {CLOSED_HEADING}
            </h1>
            <p className="text-amber-700/70" data-testid="closed-message">
              {CLOSED_BODY}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted && submittedSubmission) {
    const finalType = submittedSubmission.cracker ?? crackerForId(submittedSubmission.id);
    const finalColor = submittedSubmission.colorStyle ?? "golden";
    return (
      <div className="min-h-screen flex items-center justify-center p-4 texture-bg">
        <div className="w-full max-w-md flex flex-col items-center">
          <div className={`text-center p-8 w-full ${PANEL_CLASS}`}>
            <div className="w-60 h-64 mx-auto mb-6 flex items-center justify-center">
              <CrackerCard
                message={submittedSubmission.message}
                color={finalColor}
                type={finalType}
                id={submittedSubmission.id}
                lit={false}
              />
            </div>
            <h1 className="text-xl font-serif text-amber-900 mb-2" data-testid="success-heading">
              {SUCCESS_HEADING}
            </h1>
            <p className="text-amber-700/70 text-sm leading-relaxed" data-testid="success-message">
              {SUCCESS_BODY}
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

          <div className="space-y-6">
            {/* Prompt & Message Textarea */}
            <div>
              <label
                htmlFor="message-input"
                className="block text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1.5"
              >
                {PROMPT}
              </label>
              <Textarea
                id="message-input"
                value={message}
                onChange={e => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
                className="min-h-[85px] bg-amber-50/60 border-amber-200 focus-visible:ring-amber-400 resize-none text-base text-amber-900 placeholder:text-amber-600/30 placeholder:italic"
                placeholder={PLACEHOLDER}
                data-testid="input-message"
              />
              <div className="text-right text-xs text-amber-600/60 mt-1">
                {message.length} / {MESSAGE_MAX}
              </div>
            </div>

            {/* Choose Your Cracker */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">
                Choose your cracker
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" data-testid="select-cracker">
                {CRACKER_TYPES.map(t => {
                  const isSelected = crackerType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCrackerType(t)}
                      className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all duration-150 active:scale-95 ${
                        isSelected
                          ? "border-amber-500 bg-amber-50/90 ring-2 ring-amber-400 shadow-sm"
                          : "border-amber-100 bg-white/70 hover:border-amber-300 text-amber-800"
                      }`}
                    >
                      <div className="w-10 h-14 flex items-center justify-center mb-1">
                        <CrackerArt type={t} color={colorId} lit={isSelected} className="max-h-full max-w-full" />
                      </div>
                      <span className="text-xs font-medium text-amber-900">
                        {CRACKER_LABELS[t]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Choose a Color */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-amber-600 mb-2">
                Choose a color
              </label>
              <div className="flex gap-3" data-testid="select-color">
                {COLORS.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColorId(c.id)}
                    title={c.name}
                    aria-label={c.name}
                    className={`w-11 h-11 rounded-lg shadow-xs transition-transform duration-150 active:scale-95 hover:scale-105 ${
                      colorId === c.id ? "ring-2 ring-offset-2 ring-amber-500 scale-105" : ""
                    }`}
                    style={{ backgroundColor: c.bg, border: `2px solid ${c.border}60` }}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="flex flex-col items-center pt-2">
              <p className="text-center text-amber-600/70 text-xs uppercase tracking-widest font-semibold mb-2.5">
                Preview
              </p>
              <div className="w-60 h-64 shadow-xl rounded-2xl p-2 bg-amber-50/40 border border-amber-100 flex items-center justify-center">
                <CrackerCard
                  message={displayMessage}
                  color={colorId}
                  type={crackerType}
                  lit={true}
                />
              </div>
            </div>

            {/* Error & Submit Button */}
            {errorMessage && (
              <p role="alert" className="text-sm text-red-600 text-center">
                {errorMessage}
              </p>
            )}

            <Button
              type="button"
              disabled={isPending || isEmpty}
              onClick={handleSubmit}
              className="w-full py-6 text-base font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-xl shadow-md transition-all active:scale-[0.99] disabled:opacity-50"
              data-testid="button-submit"
            >
              {isPending ? "Adding your cracker..." : "Light it up!"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

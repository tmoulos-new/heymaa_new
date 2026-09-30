import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API } from "../lib/authApi";

type Thread = {
  id: string;
  subject: string;
  category: string;
  status: string;
  last_message_at?: string;
  created_at?: string;
};

type Msg = {
  id: string;
  sender_role: string;
  body: string;
  created_at?: string;
};

const CATEGORIES = [
  { value: "general", el: "Γενικά", en: "General" },
  { value: "billing", el: "Συνδρομή / πληρωμές", en: "Billing / subscription" },
  { value: "technical", el: "Τεχνικό πρόβλημα", en: "Technical issue" },
  { value: "privacy", el: "Απόρρητο / δεδομένα", en: "Privacy / data" },
  { value: "other", el: "Άλλο", en: "Other" },
] as const;

function statusLabel(status: string, lang: string) {
  const el = lang === "el";
  if (status === "open" || status === "pending_admin") return el ? "Σε αναμονή" : "Awaiting reply";
  if (status === "pending_user") return el ? "Νέα απάντηση" : "New reply";
  if (status === "closed") return el ? "Κλειστό" : "Closed";
  return status;
}

export function SupportContactPanel({
  token,
  lang,
  defaultName,
  defaultEmail,
}: {
  token: string;
  lang: string;
  defaultName?: string;
  defaultEmail?: string;
}) {
  const el = lang === "el";
  const [view, setView] = useState<"form" | "list" | "thread">("form");
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState(defaultEmail || "");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activeSubject, setActiveSubject] = useState("");
  const [activeStatus, setActiveStatus] = useState("");
  const [reply, setReply] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    if (defaultEmail) setEmail(defaultEmail);
  }, [defaultEmail]);

  const headers = { "Content-Type": "application/json", "x-token": token };

  const loadThreads = useCallback(async () => {
    setLoadingList(true);
    setErr("");
    try {
      const res = await axios.get(`${API}/support/threads`, { headers: { "x-token": token }, timeout: 20000 });
      setThreads((res.data?.threads as Thread[]) || []);
    } catch (e: unknown) {
      const detail =
        axios.isAxiosError(e) ? (e.response?.data as { detail?: string })?.detail : undefined;
      setErr(typeof detail === "string" ? detail : el ? "Αποτυχία φόρτωσης" : "Could not load messages");
    } finally {
      setLoadingList(false);
    }
  }, [token, el]);

  const openThread = async (id: string) => {
    setErr("");
    setOk("");
    try {
      const res = await axios.get(`${API}/support/threads/${id}`, {
        headers: { "x-token": token },
        timeout: 20000,
      });
      setActiveId(id);
      setActiveSubject(res.data?.thread?.subject || "");
      setActiveStatus(res.data?.thread?.status || "");
      setMessages((res.data?.messages as Msg[]) || []);
      setView("thread");
      setReply("");
    } catch (e: unknown) {
      const detail =
        axios.isAxiosError(e) ? (e.response?.data as { detail?: string })?.detail : undefined;
      setErr(typeof detail === "string" ? detail : el ? "Αποτυχία ανοίγματος" : "Could not open thread");
    }
  };

  const submit = async () => {
    setErr("");
    setOk("");
    setSending(true);
    try {
      await axios.post(
        `${API}/support/contact`,
        {
          subject,
          body,
          category,
          email: email.trim() || undefined,
          name: defaultName || undefined,
          locale: lang,
        },
        { headers, timeout: 30000 },
      );
      setOk(
        el
          ? "Το μήνυμα στάλθηκε. Θα απαντήσουμε με email και εδώ στην εφαρμογή."
          : "Message sent. We’ll reply by email and here in the app.",
      );
      setSubject("");
      setBody("");
      void loadThreads();
    } catch (e: unknown) {
      const detail =
        axios.isAxiosError(e) ? (e.response?.data as { detail?: string })?.detail : undefined;
      setErr(typeof detail === "string" ? detail : el ? "Αποτυχία αποστολής" : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const sendReply = async () => {
    if (!activeId || !reply.trim()) return;
    setErr("");
    setSending(true);
    try {
      const res = await axios.post(
        `${API}/support/threads/${activeId}/messages`,
        { body: reply },
        { headers, timeout: 30000 },
      );
      setMessages((prev) => [...prev, res.data.message as Msg]);
      setActiveStatus(res.data?.thread?.status || activeStatus);
      setReply("");
      setOk(el ? "Η απάντησή σου στάλθηκε." : "Your reply was sent.");
    } catch (e: unknown) {
      const detail =
        axios.isAxiosError(e) ? (e.response?.data as { detail?: string })?.detail : undefined;
      setErr(typeof detail === "string" ? detail : el ? "Αποτυχία απάντησης" : "Reply failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="hm-support-panel">
      <div className="hm-support-tabs" role="tablist">
        <button
          type="button"
          className={`hm-support-tab${view === "form" ? " is-active" : ""}`}
          onClick={() => {
            setView("form");
            setErr("");
            setOk("");
          }}
        >
          {el ? "Νέο μήνυμα" : "New message"}
        </button>
        <button
          type="button"
          className={`hm-support-tab${view !== "form" ? " is-active" : ""}`}
          onClick={() => {
            setView("list");
            setErr("");
            setOk("");
            void loadThreads();
          }}
        >
          {el ? "Τα μηνύματά μου" : "My messages"}
        </button>
      </div>

      <p className="hm-support-policy">
        {el
          ? "Για λογαριασμό, πληρωμές και την εφαρμογή — όχι για επείγοντα ιατρικά. Απαντάμε στο email σου και εδώ."
          : "For account, billing, and the app — not medical emergencies. We reply by email and here."}
      </p>

      {err ? <div className="hm-support-flash hm-support-flash--err">{err}</div> : null}
      {ok ? <div className="hm-support-flash hm-support-flash--ok">{ok}</div> : null}

      {view === "form" ? (
        <div className="hm-support-form">
          <label className="hm-support-label">
            {el ? "Κατηγορία" : "Category"}
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {el ? c.el : c.en}
                </option>
              ))}
            </select>
          </label>
          {!defaultEmail ? (
            <label className="hm-support-label">
              Email *
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                autoComplete="email"
              />
            </label>
          ) : (
            <p className="hm-support-meta">
              {el ? "Απάντηση στο" : "We’ll reply to"} <strong>{defaultEmail || email}</strong>
            </p>
          )}
          <label className="hm-support-label">
            {el ? "Θέμα" : "Subject"}
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={120}
              placeholder={el ? "π.χ. Πρόβλημα με τη συνδρομή" : "e.g. Issue with my plan"}
            />
          </label>
          <label className="hm-support-label">
            {el ? "Μήνυμα" : "Message"}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder={
                el
                  ? "Περίγραψε τι χρειάζεσαι — χωρίς ευαίσθητα ιατρικά στοιχεία αν δεν είναι απαραίτητα."
                  : "Describe what you need — avoid sensitive medical details unless necessary."
              }
            />
          </label>
          <button
            type="button"
            className="hm-btn hm-btn--primary hm-btn--block"
            disabled={sending || subject.trim().length < 3 || body.trim().length < 10}
            onClick={() => void submit()}
          >
            {sending ? (el ? "Αποστολή…" : "Sending…") : el ? "Αποστολή μηνύματος" : "Send message"}
          </button>
        </div>
      ) : null}

      {view === "list" ? (
        <div className="hm-support-list">
          {loadingList ? <p className="hm-support-meta">{el ? "Φόρτωση…" : "Loading…"}</p> : null}
          {!loadingList && threads.length === 0 ? (
            <p className="hm-support-meta">
              {el ? "Δεν έχεις στείλει ακόμα μήνυμα." : "You haven’t sent a message yet."}
            </p>
          ) : null}
          {threads.map((t) => (
            <button
              key={t.id}
              type="button"
              className="hm-support-thread-row"
              onClick={() => void openThread(t.id)}
            >
              <span className="hm-support-thread-title">{t.subject}</span>
              <span className="hm-support-thread-meta">{statusLabel(t.status, lang)}</span>
            </button>
          ))}
        </div>
      ) : null}

      {view === "thread" ? (
        <div className="hm-support-thread">
          <button
            type="button"
            className="hm-support-back"
            onClick={() => {
              setView("list");
              void loadThreads();
            }}
          >
            ← {el ? "Πίσω" : "Back"}
          </button>
          <h3 className="hm-support-thread-h">{activeSubject}</h3>
          <p className="hm-support-meta">{statusLabel(activeStatus, lang)}</p>
          <div className="hm-support-msgs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`hm-support-bubble hm-support-bubble--${m.sender_role === "admin" ? "admin" : "user"}`}
              >
                <div className="hm-support-bubble-role">
                  {m.sender_role === "admin" ? "HeyMaa" : el ? "Εσύ" : "You"}
                </div>
                <div className="hm-support-bubble-body">{m.body}</div>
              </div>
            ))}
          </div>
          {activeStatus !== "closed" ? (
            <>
              <label className="hm-support-label">
                {el ? "Απάντηση" : "Reply"}
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={4000} />
              </label>
              <button
                type="button"
                className="hm-btn hm-btn--primary hm-btn--block"
                disabled={sending || reply.trim().length < 10}
                onClick={() => void sendReply()}
              >
                {sending ? (el ? "Αποστολή…" : "Sending…") : el ? "Αποστολή απάντησης" : "Send reply"}
              </button>
            </>
          ) : (
            <p className="hm-support-meta">
              {el
                ? "Η συνομιλία έκλεισε. Άνοιξε «Νέο μήνυμα» αν χρειάζεσαι κάτι άλλο."
                : "This conversation is closed. Use New message if you need more help."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

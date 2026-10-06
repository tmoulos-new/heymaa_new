import { useEffect, useState } from "react";

/**
 * Three-dot "typing" cue. Driven by a timer (not only CSS) so the bounce
 * keeps running for the full /chat wait — CSS-only infinite animations can
 * freeze on some mobile browsers when ancestors transform/scroll.
 */
export default function ChatTypingIndicator() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase((p) => (p + 1) % 3);
    }, 380);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="hm-chat-typing" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={phase === i ? "is-active" : undefined}
        />
      ))}
    </span>
  );
}

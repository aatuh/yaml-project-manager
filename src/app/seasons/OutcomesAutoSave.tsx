"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function OutcomesAutoSave(props: {
  names: [string, string, string];
  defaults: [string, string, string];
}) {
  const { names, defaults } = props;
  const [v1, setV1] = useState(defaults[0] || "");
  const [v2, setV2] = useState(defaults[1] || "");
  const [v3, setV3] = useState(defaults[2] || "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const r1 = useRef<HTMLInputElement | null>(null);
  const r2 = useRef<HTMLInputElement | null>(null);
  const r3 = useRef<HTMLInputElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const savedRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      if (savedRef.current) window.clearTimeout(savedRef.current);
    };
  }, []);

  function scheduleSubmit(form: HTMLFormElement | null) {
    if (!form) return;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      form.requestSubmit();
    }, 800);
  }

  const inputs = useMemo(() => {
    return [
      { name: names[0], value: v1, set: setV1, ref: r1 },
      { name: names[1], value: v2, set: setV2, ref: r2 },
      { name: names[2], value: v3, set: setV3, ref: r3 },
    ];
  }, [names, v1, v2, v3]);

  return (
    <>
      {inputs.map((it, idx) => (
        <input
          key={it.name}
          ref={it.ref as any}
          name={it.name}
          value={it.value}
          onChange={(e) => {
            const form = (e.target as HTMLInputElement).form;
            it.set(e.target.value);
            setStatus("saving");
            scheduleSubmit(form);
            if (savedRef.current) window.clearTimeout(savedRef.current);
            savedRef.current = window.setTimeout(() => {
              setStatus("saved");
              savedRef.current = window.setTimeout(() => {
                setStatus("idle");
              }, 1500) as unknown as number;
            }, 1000) as unknown as number;
          }}
          placeholder={`Outcome ${idx + 1}`}
          className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
        />
      ))}
      <div className="text-xs text-neutral-500">
        {status === "saving" && <span>Saving…</span>}
        {status === "saved" && <span>Saved</span>}
      </div>
    </>
  );
}

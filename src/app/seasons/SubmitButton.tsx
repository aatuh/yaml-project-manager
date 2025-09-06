"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton(props: {
  children: string;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const { children, pendingText = "Saving…", className } = props;
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={className}
    >
      {pending ? pendingText : children}
    </button>
  );
}

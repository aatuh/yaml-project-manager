"use client";

export default function DeleteSeasonButton({
  confirmMessage = "Delete this season permanently?",
}: {
  confirmMessage?: string;
}) {
  return (
    <button
      type="submit"
      className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
      onClick={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      Delete Season
    </button>
  );
}

"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/daily-notes" })}
      className="rounded border px-3 py-2 text-sm"
    >
      Sign out
    </button>
  );
}
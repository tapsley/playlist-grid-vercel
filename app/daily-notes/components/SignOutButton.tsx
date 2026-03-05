"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      style={{ width: "100px", margin: 10,padding: 8, borderRadius: 8, border: "none", background: "#ff2dd1", color: "white", fontWeight: 600, cursor: "pointer" }}
    >
      Sign out
    </button>
  );
}
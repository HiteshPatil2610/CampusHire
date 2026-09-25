import { Schibsted_Grotesk } from "next/font/google";

import { AuthShell } from "@/components/auth/auth-shell";

const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-auth",
});

// The shell renders both Clerk forms itself and stays mounted across
// /sign-in ↔ /sign-up so the switch can animate; the pages only set metadata.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={schibsted.variable}>
      <AuthShell />
      {children}
    </div>
  );
}

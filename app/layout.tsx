import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// Oxford design language typeface (ui-context.md §3).
const schibsted = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-sans",
});

// Wording for the sign-in / sign-up design (see ui-context.md §4.3).
const clerkLocalization = {
  dividerText: "or with email",
  formFieldInputPlaceholder__emailAddress: "Email address",
  formFieldInputPlaceholder__password: "Password",
  formFieldAction__forgotPassword: "Forgotten password?",
};

export const metadata: Metadata = {
  title: "CampusHire",
  description: "Campus placement management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={clerkLocalization}>
      <html lang="en">
        <body className={`${schibsted.variable} antialiased`}>
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}

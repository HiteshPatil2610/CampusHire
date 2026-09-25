import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
        <body className={`${inter.variable} antialiased`}>
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}

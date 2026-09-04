import { SignIn } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignInCatchAllPage() {
  return (
    <SignIn 
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "shadow-none"
        }
      }}
    />
  );
}

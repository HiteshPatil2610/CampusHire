import { SignUp } from "@clerk/nextjs";

export const dynamic = "force-dynamic";

export default function SignUpCatchAllPage() {
  return (
    <SignUp 
      appearance={{
        elements: {
          rootBox: "mx-auto",
          card: "shadow-none"
        }
      }}
    />
  );
}

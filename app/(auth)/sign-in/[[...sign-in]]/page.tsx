import { SignIn } from '@clerk/nextjs';
import { AuthSplitShell } from '@/components/auth/auth-split-shell';
import { getAuthOxfordAppearance } from '@/components/auth/clerk-appearance';

export const dynamic = 'force-dynamic';

export default function SignInCatchAllPage() {
  return (
    <AuthSplitShell
      mode="sign-in"
      eyebrow="Welcome Back"
      title="Sign In"
      subtitle="Continue with your university account or email."
      tileHeading="New to CampusHire? Your Place Begins Here."
      tileBody="Create an account to track applications, save programmes and join events."
      tileCtaLabel="Create Account"
      tileCtaHref="/sign-up"
    >
      <SignIn appearance={getAuthOxfordAppearance()} />
    </AuthSplitShell>
  );
}

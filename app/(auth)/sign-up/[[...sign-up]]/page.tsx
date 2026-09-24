import { SignUp } from '@clerk/nextjs';
import { AuthSplitShell } from '@/components/auth/auth-split-shell';
import { getAuthOxfordAppearance } from '@/components/auth/clerk-appearance';

export const dynamic = 'force-dynamic';

export default function SignUpCatchAllPage() {
  return (
    <AuthSplitShell
      mode="sign-up"
      eyebrow="New Here"
      title="Create Account"
      subtitle="Register with Google or your email address."
      tileHeading="Welcome Back to a Legacy of Excellence."
      tileBody="Already have an account? Sign in with your email and password."
      tileCtaLabel="Sign In"
      tileCtaHref="/sign-in"
    >
      <SignUp appearance={getAuthOxfordAppearance()} />
    </AuthSplitShell>
  );
}

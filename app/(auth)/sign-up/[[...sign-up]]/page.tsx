import { SignUp } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function SignUpCatchAllPage() {
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="brand-mark" style={{ marginBottom: 24 }}>
          <span className="brand-dot" />
          <span>CampusHire</span>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none border-0 p-0',
            },
          }}
        />
      </div>
    </div>
  );
}

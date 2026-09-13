import { SignIn } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function SignInCatchAllPage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'var(--surface-0)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <SignIn
        appearance={{
          layout: {
            socialButtonsPlacement: 'top',
            socialButtonsVariant: 'blockButton',
          },
          variables: {
            borderRadius: '8px',
            colorPrimary: '#D2622A',
            colorBackground: '#FFFFFF',
          },
          elements: {
            card: {
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '0.5px solid var(--border)',
            },
            headerTitle: {
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            },
            headerSubtitle: {
              fontSize: '13px',
              color: 'var(--text-secondary)',
            },
            socialButtonsBlockButton: {
              backgroundColor: 'white',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontWeight: 500,
              fontSize: '14px',
            },
            dividerLine: {
              backgroundColor: 'var(--border)',
            },
            dividerText: {
              color: 'var(--text-tertiary)',
              fontSize: '12px',
            },
            formFieldLabel: {
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-primary)',
            },
            formFieldInput: {
              backgroundColor: 'var(--surface-0)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '14px',
              color: 'var(--text-primary)',
            },
            formButtonPrimary: {
              backgroundColor: 'var(--primary)',
              color: 'white',
              fontWeight: 500,
              borderRadius: '8px',
              fontSize: '14px',
            },
            footerActionLink: {
              color: 'var(--primary)',
              fontWeight: 500,
              fontSize: '13px',
            },
            footerActionText: {
              color: 'var(--text-secondary)',
              fontSize: '13px',
            },
          },
        }}
      />
    </div>
  );
}

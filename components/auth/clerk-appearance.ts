import type { Appearance } from '@clerk/types';

/**
 * Restyles Clerk's own <SignIn>/<SignUp> chrome to sit inside the Oxford
 * auth shell (components/auth/auth-split-shell.tsx). Clerk stays the only
 * thing that ever touches credentials/sessions — this only changes pixels.
 * Header and footer are hidden because the shell supplies its own heading
 * and the tile panel supplies the cross-link between sign-in and sign-up.
 */
export function getAuthOxfordAppearance(): Appearance {
  return {
    layout: {
      socialButtonsPlacement: 'top',
      socialButtonsVariant: 'blockButton',
    },
    variables: {
      colorPrimary: '#002147',
      colorBackground: 'transparent',
      colorText: '#000000',
      colorTextSecondary: '#8c8c8c',
      colorInputBackground: '#ffffff',
      colorInputText: '#000000',
      colorDanger: '#a32d2d',
      borderRadius: '8px',
      fontFamily: 'var(--font-sans)',
    },
    elements: {
      rootBox: { width: '100%' },
      cardBox: { width: '100%', background: 'transparent', boxShadow: 'none', border: 'none' },
      card: { width: '100%', background: 'transparent', boxShadow: 'none', border: 'none', padding: 0, gap: '14px' },
      header: { display: 'none' },
      footer: { display: 'none' },
      socialButtonsBlockButton: {
        height: '52px',
        borderRadius: '999px',
        border: '1px solid rgba(195,154,103,.5)',
        backgroundColor: '#0f0f0f',
        color: '#ffffff',
        fontSize: '15px',
        fontWeight: 500,
        '&:hover': {
          borderColor: '#c39a67',
          backgroundColor: '#141414',
        },
      },
      socialButtonsBlockButtonText: { color: '#ffffff', fontWeight: 500 },
      dividerRow: { gap: '12px' },
      dividerLine: { backgroundColor: '#e6e6e6' },
      dividerText: { color: '#a6a6a6', fontSize: '11px', fontStyle: 'italic' },
      formFieldLabelRow: { marginBottom: '4px' },
      formFieldLabel: { fontSize: '12px', fontWeight: 500, color: '#000000' },
      formFieldInput: {
        height: '44px',
        borderRadius: '8px',
        border: '1px solid #e2e2e2',
        fontSize: '14px',
        '&:focus': {
          borderColor: '#002147',
          boxShadow: '0 0 0 3px rgba(0,33,71,.12)',
        },
      },
      formButtonPrimary: {
        height: '52px',
        borderRadius: '999px',
        backgroundColor: '#002147',
        fontSize: '15px',
        fontWeight: 500,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.12), 0 6px 18px rgba(0,0,0,.18)',
        '&:hover': { backgroundColor: '#012c5e' },
        '&:focus': { boxShadow: '0 0 0 3px rgba(0,33,71,.22)' },
      },
      formFieldAction: { color: '#4a4a4a', fontSize: '13px' },
      identityPreviewEditButton: { color: '#002147' },
      footerAction: { display: 'none' },
      footerActionLink: { color: '#002147', fontWeight: 500 },
    },
  } as unknown as Appearance;
}

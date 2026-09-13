'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

type SaveHandler = () => void | Promise<void>;

interface ProfileSaveContextValue {
  /** Called by the active tab to publish its save handler. */
  register: (handler: SaveHandler | null, isSaving: boolean) => void;
  /** Runs the active tab's save handler. */
  save: () => void;
  /** True while the active tab is saving. */
  isSaving: boolean;
  /** True once a tab has registered a handler. */
  canSave: boolean;
}

const ProfileSaveContext = createContext<ProfileSaveContextValue | null>(null);

export function ProfileSaveProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const handlerRef = useRef<SaveHandler | null>(null);
  const [state, setState] = useState({ isSaving: false, canSave: false });

  const register = useCallback(
    (handler: SaveHandler | null, isSaving: boolean) => {
      handlerRef.current = handler;
      setState((previous) =>
        previous.isSaving === isSaving && previous.canSave === Boolean(handler)
          ? previous
          : { isSaving, canSave: Boolean(handler) }
      );
    },
    []
  );

  const save = useCallback(() => {
    void handlerRef.current?.();
  }, []);

  return (
    <ProfileSaveContext.Provider
      value={{ register, save, isSaving: state.isSaving, canSave: state.canSave }}
    >
      {children}
    </ProfileSaveContext.Provider>
  );
}

export function useProfileSave(): ProfileSaveContextValue {
  const value = useContext(ProfileSaveContext);
  if (!value) {
    throw new Error('useProfileSave must be used inside ProfileSaveProvider');
  }
  return value;
}

/**
 * Publishes a tab's save handler so the header "Save changes" button can run
 * it. The handler is re-registered whenever it or the pending flag changes,
 * and cleared on unmount so a stale tab's save can never fire.
 */
export function useRegisterProfileSave(
  handler: SaveHandler,
  isSaving: boolean
): void {
  const { register } = useProfileSave();

  // Keep the latest closure without re-registering on every render.
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => {
    register(() => latest.current(), isSaving);
    return () => register(null, false);
  }, [register, isSaving]);
}

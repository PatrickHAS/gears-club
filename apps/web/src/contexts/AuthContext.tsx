import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AuthUser, LoginResponse } from "../services/auth.service";

import { refreshSession, logoutSession } from "../services/auth.service";

interface AuthContextData {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (session: LoginResponse) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const signIn = useCallback((session: LoginResponse) => {
    setUser(session.user);
    setAccessToken(session.accessToken);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await logoutSession();
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const session = await refreshSession();

        if (!cancelled) {
          signIn(session);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [signIn]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      isAuthenticated: user !== null && accessToken !== null,
      isLoading,
      signIn,
      signOut,
    }),
    [user, accessToken, isLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de AuthProvider.");
  }

  return context;
}

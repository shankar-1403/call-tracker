import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'expo-router';
import { ReactNode, useEffect } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
}

const PUBLIC_ROUTES = new Set(['/', '/index']);

/**
 * Always keep the navigator mounted (required on native).
 * Only redirect after auth is ready — never replace the whole tree with a blank/splash view.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user && !isPublicRoute) {
      router.replace('/');
      return;
    }

    if (user && isPublicRoute) {
      router.replace('/dashboard');
    }
  }, [loading, user, isPublicRoute, pathname, router]);

  return <>{children}</>;
}

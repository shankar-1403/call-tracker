import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "expo-router";
import { ReactNode, useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

interface ProtectedRouteProps {
  children: ReactNode;
}

const PUBLIC_ROUTES = new Set(["/", "/index"]);

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicRoute = PUBLIC_ROUTES.has(pathname);

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublicRoute) {
      router.replace("/");
      return;
    }

    if (user && isPublicRoute) {
      router.replace("/dashboard");
    }
  }, [loading, user, isPublicRoute, pathname, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#000",
        }}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={{ color: "#fff", marginTop: 12 }}>Loading...</Text>
      </View>
    );
  }

  // Keep the navigator mounted so redirects can complete on native.
  return <>{children}</>;
}

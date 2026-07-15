import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "expo-router";
import { ReactNode, useEffect } from "react";
import { Text, View } from "react-native";

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({
  children,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [loading, user, pathname, router]);

  if (loading) {
    return (
       <View
            style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
            }}
            >
            <Text>Loading...</Text>
        </View>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
import ProtectedRoute from '@/components/protectedRoute';
import { AuthProvider } from '@/context/AuthContext';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ProtectedRoute>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="dashboard" />
          </Stack>
        </ThemeProvider>
      </ProtectedRoute>
    </AuthProvider>
  );
}

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { width, height } = useWindowDimensions();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user]);

  async function handleSubmit() {
    setError('');
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    }
  }

  const horizontalPadding = width < 380 ? Spacing.three : Spacing.four;
  const formMaxWidth = Math.min(420, width - horizontalPadding * 2);
  const isCompact = height < 700 || width < 380;
  const titleSize = isCompact ? 24 : 28;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#208AEF" />
        <Text style={{ marginTop: 12, color: '#666' }}>Restoring session…</Text>
      </View>
    );
  }

  if (user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#208AEF" />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: horizontalPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}>
            <ThemedView style={[styles.heroSection, { maxWidth: formMaxWidth }]}>
              <AnimatedIcon compact={isCompact} />
              <ThemedView style={[styles.form, isCompact && styles.formCompact]}>
                <Text style={[styles.formTitle, { fontSize: titleSize }]}>Welcome Back</Text>
                <Text style={styles.subtitle}>Sign in to continue</Text>

                <Text style={styles.label}>Email ID</Text>
                <TextInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    style={styles.passwordInput}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword((visible) => !visible)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <MaterialIcons
                      name={showPassword ? 'visibility-off' : 'visibility'}
                      size={22}
                      color="#667085"
                    />
                  </TouchableOpacity>
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity style={styles.button} onPress={handleSubmit} activeOpacity={0.85}>
                  <Text style={styles.buttonText}>Login</Text>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
            <Text style={styles.version}>Version 1.0.1</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
    width: '100%',
  },
  safeArea: {
    flex: 1,
    width: '100%',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  label: {
    fontSize:16,
    fontWeight:"bold",
    marginTop:10,
    color: '#074C70',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.five,
    width: '100%',
  },
  heroSection: {
    width: '100%',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.four,
  },
  form: {
    width: '100%',
    padding: Spacing.four,
    backgroundColor: '#fff',
    borderRadius: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  formCompact: {
    padding: Spacing.three,
  },
  formTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#074C70',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
  },
  input: {
    height: 50,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    color: '#000',
  },
  passwordWrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    marginBottom: 16,
    height: 50,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#000',
  },
  eyeButton: {
    paddingHorizontal: 14,
    height: '100%',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: '#074C70',
    height: 50,
    width: '100%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  errorText: {
    color: '#B00020',
    marginBottom: 12,
    textAlign: 'center',
  },
  version: {
    fontSize:14,
    color:"#ffffff",
    position:'absolute',
    bottom:0,
  }
});

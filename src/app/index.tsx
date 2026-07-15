import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const {login} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({email:"",password:""});
  const { width, height } = useWindowDimensions();
  const handleChange = (e:any) => {
    const {value,name} = e.target;
    setFormData((prevFormData)=>({
      ...prevFormData,
      [name]:value
    }))
  }

  async function handleSubmit() {
    setError('')
    try {
      await login(email.trim(), password);
      router.replace('/dashboard');
    } catch (err:any) {
      setError(err.message ?? 'Sign in failed')
    } finally {
      console.log("Complete")
    }
  }

  const horizontalPadding = width < 380 ? Spacing.three : Spacing.four;
  const formMaxWidth = Math.min(420, width - horizontalPadding * 2);
  const isCompact = height < 700 || width < 380;
  const titleSize = isCompact ? 24 : 28;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

                <TextInput
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  onChange={handleChange}
                  style={styles.input}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TextInput
                  placeholder="Password"
                  value={password}
                  onChange={handleChange}
                  onChangeText={setPassword}
                  style={styles.input}
                  secureTextEntry
                />

                <TouchableOpacity style={styles.button} onPress={handleSubmit} activeOpacity={0.85}>
                  <Text style={styles.buttonText}>Login</Text>
                </TouchableOpacity>
              </ThemedView>
            </ThemedView>
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
    color: '#000',
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
  button: {
    backgroundColor: '#208AEF',
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
});

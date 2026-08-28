import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { login, register } from './api';
import { C } from './theme';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const p = mode === 'login' ? login(email.trim(), password) : register(email.trim(), password, name.trim());
    p.catch((e) => {
      setError(String(e.message ?? e));
      setBusy(false);
    });
    // on success the token flips and App swaps this screen out
  };

  return (
    <KeyboardAvoidingView style={s.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <View style={s.brandRow}>
          <View style={s.dot} />
          <Text style={s.brand}>Life OS</Text>
        </View>
        <Text style={s.tagline}>It reads what you have. It remembers what you'd forget.</Text>

        <View style={s.toggle}>
          <Pressable style={[s.toggleBtn, mode === 'login' && s.toggleActive]} onPress={() => setMode('login')}>
            <Text style={[s.toggleText, mode === 'login' && s.toggleTextActive]}>Sign in</Text>
          </Pressable>
          <Pressable style={[s.toggleBtn, mode === 'register' && s.toggleActive]} onPress={() => setMode('register')}>
            <Text style={[s.toggleText, mode === 'register' && s.toggleTextActive]}>Create account</Text>
          </Pressable>
        </View>

        {mode === 'register' && (
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={C.faint}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={s.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={C.faint}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={s.input}
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'register' ? 'At least 8 characters' : 'Password'}
          placeholderTextColor={C.faint}
          secureTextEntry
        />

        {!!error && <Text style={s.error}>{error}</Text>}

        <Pressable style={({ pressed }) => [s.submit, pressed && s.pressed]} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={C.onAccent} />
          ) : (
            <Text style={s.submitText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg, justifyContent: 'center', padding: 22 },
  card: { backgroundColor: C.panel, borderRadius: 24, padding: 24, gap: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.accent },
  brand: { color: C.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
  tagline: { color: C.muted, fontSize: 14.5, letterSpacing: -0.2, marginTop: -4, marginBottom: 4, lineHeight: 20 },
  toggle: { flexDirection: 'row', backgroundColor: C.fill, borderRadius: 12, padding: 3, gap: 3, marginBottom: 4 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  toggleActive: { backgroundColor: C.panel2 },
  toggleText: { color: C.muted, fontSize: 14.5, fontWeight: '600' },
  toggleTextActive: { color: C.text },
  input: {
    backgroundColor: C.bg,
    borderRadius: 13,
    paddingHorizontal: 15,
    paddingVertical: 14,
    color: C.text,
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
  },
  error: { color: C.danger, fontSize: 14, fontWeight: '500' },
  submit: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  submitText: { color: C.onAccent, fontSize: 17, fontWeight: '600', letterSpacing: -0.2 },
});

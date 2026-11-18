import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Pill, ArrowRight } from 'lucide-react-native';
import { saveUserProfile } from '@/services/userService';
import { setupNotifications } from '@/services/notificationService';
import { formatBirthDateMask } from '@/utils/dateUtils';

export default function OnboardingScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [healthNotes, setHealthNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert('Atenção', 'Informe seu nome para continuar.');
      return;
    }

    try {
      setSaving(true);
      await saveUserProfile({
        name,
        birthDate,
        healthNotes,
      });
      await setupNotifications();
      router.replace('/(tabs)');
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Falha ao salvar cadastro.';
      Alert.alert('Erro', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          className="px-6 py-8"
        >
          <View className="items-center mb-8">
            <View className="w-16 h-16 rounded-2xl bg-blue-600 items-center justify-center mb-4">
              <Pill size={34} color="#FFFFFF" />
            </View>
            <Text className="text-2xl font-bold text-slate-900 text-center">
              Controle de Medicamentos
            </Text>
            <Text className="text-sm text-slate-600 text-center mt-1">
              100% offline. Faça seu cadastro rápido para organizar seus
              horários e lembretes.
            </Text>
          </View>

          <View className="bg-white rounded-2xl p-5 border border-slate-200 mb-6">
            <Text className="text-xs font-semibold uppercase text-slate-600 mb-1.5">
              Seu Nome *
            </Text>
            <TextInput
              testID="onboarding-input-name"
              value={name}
              onChangeText={setName}
              placeholder="Ex: Maria Silva"
              className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 mb-4"
            />

            <Text className="text-xs font-semibold uppercase text-slate-600 mb-1.5">
              Data de Nascimento (Opcional)
            </Text>
            <TextInput
              testID="onboarding-input-birth-date"
              value={birthDate}
              onChangeText={(v) => setBirthDate(formatBirthDateMask(v))}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="DD/MM/AAAA"
              className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 mb-4"
            />

            <Text className="text-xs font-semibold uppercase text-slate-600 mb-1.5">
              Alergias ou Observações (Opcional)
            </Text>
            <TextInput
              testID="onboarding-input-health-notes"
              value={healthNotes}
              onChangeText={setHealthNotes}
              placeholder="Ex: Alergia a dipirona, hipertensão..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-900 min-h-[80px]"
            />
          </View>

          <TouchableOpacity
            testID="onboarding-btn-continue"
            disabled={saving}
            onPress={handleContinue}
            className={`flex-row items-center justify-center py-4 rounded-xl ${
              saving ? 'bg-blue-400' : 'bg-blue-600'
            }`}
          >
            <Text className="text-base font-bold text-white mr-2">
              {saving ? 'Salvando...' : 'Começar a Usar'}
            </Text>
            <ArrowRight size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

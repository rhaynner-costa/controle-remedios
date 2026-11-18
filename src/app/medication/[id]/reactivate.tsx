import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import {
  getMedicationDetail,
  MedicationWithCycle,
  reactivateMedicationWithNewCycle,
} from '@/services/medicationService';
import {
  CycleFormFields,
  CycleFormState,
} from '@/components/CycleFormFields';

export default function ReactivateMedicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const medicationId = Number(id);

  const [detail, setDetail] = useState<MedicationWithCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [cycleForm, setCycleForm] = useState<CycleFormState>({
    doseAmount: '',
    scheduledTimes: [],
    targetOccurrences: '',
  });

  useEffect(() => {
    async function load() {
      try {
        const data = await getMedicationDetail(medicationId);
        if (data) {
          setDetail(data);
        }
      } catch (error) {
        console.error('[ReactivateScreen] Erro ao carregar:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [medicationId]);

  const handleReactivate = async () => {
    if (!cycleForm.doseAmount.trim()) {
      Alert.alert('Atenção', 'Informe a dosagem por tomada.');
      return;
    }

    if (cycleForm.scheduledTimes.length === 0) {
      Alert.alert(
        'Horários',
        'Adicione pelo menos 1 horário fixo para o medicamento.'
      );
      return;
    }

    const occurrencesNum = parseInt(cycleForm.targetOccurrences || '0', 10) || 0;
    if (occurrencesNum <= 0) {
      Alert.alert(
        'Ocorrências',
        'Informe um número válido de ocorrências (pelo menos 1 dose).'
      );
      return;
    }

    try {
      setSaving(true);
      await reactivateMedicationWithNewCycle(medicationId, {
        doseAmount: cycleForm.doseAmount,
        recurrenceType: 'fixed_times',
        scheduledTimes: cycleForm.scheduledTimes,
        isContinuous: false,
        targetOccurrences: occurrencesNum,
      });

      router.back();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível reativar o medicamento.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !detail) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 40 }}
      className="flex-1 bg-slate-50 px-4 pt-4"
    >
      <View className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
        <Text className="text-sm font-bold text-blue-900">
          Reativando: {detail.commercialName} ({detail.concentration})
        </Text>
        <Text className="text-xs text-blue-800 mt-1">
          Um novo ciclo será criado com data inicial de hoje. Todos os ciclos e
          registros de tomadas anteriores permanecem salvos no histórico.
        </Text>
      </View>

      <CycleFormFields value={cycleForm} onChange={setCycleForm} />

      <TouchableOpacity
        testID="med-reactivate-btn-confirm"
        disabled={saving}
        onPress={handleReactivate}
        className={`flex-row items-center justify-center py-4 rounded-2xl ${
          saving ? 'bg-blue-400' : 'bg-blue-600'
        }`}
      >
        <RotateCcw size={18} color="#FFFFFF" />
        <Text className="text-base font-bold text-white ml-2">
          {saving ? 'Ativando...' : 'Confirmar Reativação e Agendar'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

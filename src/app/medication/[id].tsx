import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Archive,
  RotateCcw,
  Camera,
  Calendar,
  Clock,
} from 'lucide-react-native';
import {
  archiveMedication,
  getMedicationDetail,
  MedicationWithCycle,
  updateMedicationBoxPhoto,
} from '@/services/medicationService';
import { pickBoxPhotoFromCamera } from '@/services/imageService';
import { formatDateDisplay, WEEKDAY_LABELS } from '@/utils/dateUtils';
import { PillIcon } from '@/components/PillIcon';
import { SHOW_BOX_PHOTO } from '@/utils/featureFlags';

export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const medicationId = Number(id);

  const [detail, setDetail] = useState<MedicationWithCycle | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(medicationId)) return;
    try {
      setLoading(true);
      const data = await getMedicationDetail(medicationId);
      setDetail(data);
    } catch (error) {
      console.error('[MedicationDetailScreen] Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  }, [medicationId]);

  useFocusEffect(
    useCallback(() => {
      loadDetail();
    }, [loadDetail])
  );

  const handleArchive = () => {
    Alert.alert(
      'Arquivar Tratamento',
      'O medicamento será marcado como Arquivado com a data fim de hoje e os lembretes serão encerrados. Nenhum histórico será excluído.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          style: 'destructive',
          onPress: async () => {
            try {
              await archiveMedication(medicationId);
              await loadDetail();
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível arquivar.');
            }
          },
        },
      ]
    );
  };

  const handleUpdatePhoto = async () => {
    try {
      const base64 = await pickBoxPhotoFromCamera();
      if (base64) {
        await updateMedicationBoxPhoto(medicationId, base64);
        await loadDetail();
      }
    } catch (error) {
      Alert.alert('Câmera', 'Não foi possível atualizar a foto.');
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
      contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}
      className="flex-1 bg-slate-50 px-4 pt-4"
    >
      {/* Card Principal */}
      <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
        <View className="flex-row items-center">
          <View className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200 items-center justify-center mr-3.5">
            <PillIcon
              shape={detail.pillShape}
              primaryColor={detail.pillColorPrimary}
              secondaryColor={detail.pillColorSecondary}
              size={46}
            />
          </View>
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-slate-900 flex-1 mr-2">
                {detail.commercialName}
              </Text>
              <View
                className={`px-2.5 py-1 rounded-full ${
                  detail.status === 'ativo'
                    ? 'bg-emerald-100'
                    : detail.status === 'inativo'
                    ? 'bg-amber-100'
                    : 'bg-slate-200'
                }`}
              >
                <Text
                  testID="med-detail-status-badge"
                  className={`text-xs font-bold uppercase ${
                    detail.status === 'ativo'
                      ? 'text-emerald-800'
                      : detail.status === 'inativo'
                      ? 'text-amber-800'
                      : 'text-slate-700'
                  }`}
                >
                  {detail.status}
                </Text>
              </View>
            </View>
            <Text className="text-sm text-slate-700 mt-0.5">
              {detail.activeIngredient} • {detail.concentration}
            </Text>
            <Text className="text-xs text-slate-500 capitalize mt-0.5">
              Tipo: {detail.type}
            </Text>
          </View>
        </View>

        {/* Foto da Caixa */}
        {SHOW_BOX_PHOTO && (detail.boxPhotoBase64 ? (
          <View className="mt-4">
            <Image
              source={{ uri: detail.boxPhotoBase64 }}
              className="w-full h-48 rounded-xl border border-slate-200"
              resizeMode="cover"
            />
            <TouchableOpacity
              testID="med-detail-btn-photo"
              onPress={handleUpdatePhoto}
              className="mt-2 self-end flex-row items-center bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              <Camera size={13} color="#334155" />
              <Text className="text-xs font-semibold text-slate-700 ml-1.5">
                Trocar Foto da Caixa
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            testID="med-detail-btn-photo"
            onPress={handleUpdatePhoto}
            className="mt-4 flex-row items-center justify-center bg-slate-50 border border-dashed border-slate-300 py-3 rounded-xl"
          >
            <Camera size={16} color="#475569" />
            <Text className="text-xs font-semibold text-slate-700 ml-2">
              Adicionar Foto da Caixa
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Ações de Controle de Status (Sem exclusão física) */}
      <View className="bg-white border border-slate-200 rounded-2xl p-4 mb-4">
        <Text className="text-sm font-bold text-slate-900 mb-1">
          Controle de Status
        </Text>
        <Text className="text-xs text-slate-500 mb-3">
          Nenhum registro é excluído. Você pode encerrar/arquivar o tratamento
          atual ou reativar o medicamento quando precisar voltar a tomar.
        </Text>

        <View className="flex-row flex-wrap gap-2.5">
          {detail.status === 'ativo' ? (
            <TouchableOpacity
              testID="med-detail-btn-archive"
              onPress={handleArchive}
              className="flex-1 flex-row items-center justify-center bg-slate-100 border border-slate-300 py-3.5 px-4 rounded-xl"
            >
              <Archive size={16} color="#334155" />
              <Text className="text-sm font-bold text-slate-800 ml-2">
                Encerrar / Arquivar Tratamento
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              testID="med-detail-btn-reactivate"
              onPress={() => router.push(`/medication/${detail.id}/reactivate`)}
              className="flex-1 flex-row items-center justify-center bg-blue-600 py-3.5 px-4 rounded-xl"
            >
              <RotateCcw size={16} color="#FFFFFF" />
              <Text className="text-sm font-bold text-white ml-2">
                Voltar a Tomar (Reativar Medicamento)
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Histórico de Ciclos de Tratamento (Data Inicial e Data Fim) */}
      <View className="bg-white border border-slate-200 rounded-2xl p-4">
        <Text className="text-base font-bold text-slate-900 mb-3">
          Histórico de Ciclos (Data Início e Data Fim)
        </Text>

        {detail.allCycles.map((cycle, index) => {
          const times: string[] = JSON.parse(cycle.scheduledTimes || '[]');
          const days: number[] = JSON.parse(cycle.daysOfWeek || '[]');
          const dayNames =
            days.length === 7
              ? 'Todos os dias'
              : WEEKDAY_LABELS.filter((w) => days.includes(w.day))
                  .map((w) => w.short)
                  .join(', ');

          return (
            <View
              key={cycle.id}
              testID={`med-detail-cycle-card-${cycle.id}`}
              className={`p-3.5 rounded-xl border mb-2.5 ${
                cycle.isActive
                  ? 'bg-blue-50/50 border-blue-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-xs font-bold text-slate-800">
                  Ciclo #{detail.allCycles.length - index} • Dose:{' '}
                  {cycle.doseAmount}
                </Text>
                <Text
                  className={`text-[11px] font-bold ${
                    cycle.isActive ? 'text-blue-700' : 'text-slate-500'
                  }`}
                >
                  {cycle.isActive ? 'Vigente' : 'Encerrado'}
                </Text>
              </View>

              <View className="flex-row items-center mb-1">
                <Clock size={12} color="#475569" />
                <Text className="text-xs text-slate-700 ml-1.5">
                  Horários: {times.join(' • ')} ({dayNames})
                </Text>
              </View>

              <View className="flex-row items-center mb-1">
                <Calendar size={12} color="#475569" />
                <Text className="text-xs text-slate-700 ml-1.5">
                  Data Início: {formatDateDisplay(cycle.startDate)} • Data Fim:{' '}
                  {cycle.endDate ? formatDateDisplay(cycle.endDate) : 'Em aberto'}
                </Text>
              </View>

              <Text className="text-xs text-slate-600 mt-0.5">
                Ocorrências:{' '}
                {cycle.isContinuous
                  ? `${cycle.takenCount} doses tomadas (Uso contínuo)`
                  : `${cycle.takenCount} de ${cycle.targetOccurrences} doses tomadas`}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

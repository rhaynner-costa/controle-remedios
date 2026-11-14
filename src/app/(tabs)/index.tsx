import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CheckCircle2,
  Calendar,
  Clock,
  RotateCcw,
  X,
} from 'lucide-react-native';
import {
  DailyDoseItem,
  getDosesForDate,
  markDoseAsSkipped,
  markDoseAsTaken,
  revertDoseToPending,
  snoozeDose15Minutes,
} from '@/services/scheduleService';
import { getUserProfile } from '@/services/userService';
import {
  buildScheduledIso,
  formatDateDisplay,
  formatTimeDisplay,
  getLocalDateString,
  parseBrDateToIso,
} from '@/utils/dateUtils';
import { DoseCard } from '@/components/DoseCard';

function shiftDateString(dateStr: string, offsetDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offsetDays);
  return getLocalDateString(dt);
}

export default function TodayScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(
    getLocalDateString()
  );
  const [userName, setUserName] = useState<string>('');
  const [doses, setDoses] = useState<DailyDoseItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Estado do Modal de Registro de Tomada
  const [activeItem, setActiveItem] = useState<DailyDoseItem | null>(null);
  const [modalDay, setModalDay] = useState('');
  const [modalMonth, setModalMonth] = useState('');
  const [modalYear, setModalYear] = useState('');
  const [modalHour, setModalHour] = useState('');
  const [modalMinute, setModalMinute] = useState('');

  const loadData = useCallback(async (targetDate: string) => {
    try {
      const [profile, dailyItems] = await Promise.all([
        getUserProfile(),
        getDosesForDate(targetDate),
      ]);
      if (profile) {
        setUserName(profile.name);
      }
      setDoses(dailyItems);
    } catch (error) {
      console.error('[TodayScreen] Erro ao carregar agenda:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(selectedDate);
    }, [loadData, selectedDate])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(selectedDate);
    setRefreshing(false);
  };

  const handleOpenDoseModal = (item: DailyDoseItem) => {
    setActiveItem(item);
    if (item.doseLog.status === 'tomado' && item.doseLog.takenAt) {
      const brDate = formatDateDisplay(item.doseLog.takenAt);
      const [d = '01', m = '01', y = '2026'] = brDate.split('/');
      setModalDay(d);
      setModalMonth(m);
      setModalYear(y);
      const [hr = '08', min = '00'] = formatTimeDisplay(
        item.doseLog.takenAt
      ).split(':');
      setModalHour(hr);
      setModalMinute(min);
    } else {
      const now = new Date();
      setModalDay(String(now.getDate()).padStart(2, '0'));
      setModalMonth(String(now.getMonth() + 1).padStart(2, '0'));
      setModalYear(String(now.getFullYear()));
      setModalHour(String(now.getHours()).padStart(2, '0'));
      setModalMinute(String(now.getMinutes()).padStart(2, '0'));
    }
  };

  const handleCloseModal = () => {
    setActiveItem(null);
  };

  const handleConfirmTakeFromModal = async () => {
    if (!activeItem) return;

    const dFormatted = String(parseInt(modalDay || '0', 10) || 0).padStart(
      2,
      '0'
    );
    const mFormatted = String(parseInt(modalMonth || '0', 10) || 0).padStart(
      2,
      '0'
    );
    const yFormatted = modalYear.trim();
    const parsedDateIso = parseBrDateToIso(
      `${dFormatted}/${mFormatted}/${yFormatted}`
    );

    if (!parsedDateIso) {
      Alert.alert(
        'Data Inválida',
        'Informe um Dia, Mês e Ano válidos (ex: 14 / 11 / 2026).'
      );
      return;
    }

    const hNum = parseInt(modalHour || '0', 10);
    const mNum = parseInt(modalMinute || '0', 10);
    if (
      !Number.isFinite(hNum) ||
      hNum < 0 ||
      hNum > 23 ||
      !Number.isFinite(mNum) ||
      mNum < 0 ||
      mNum > 59
    ) {
      Alert.alert(
        'Horário Inválido',
        'Informe uma hora entre 00 e 23 e minutos entre 00 e 59.'
      );
      return;
    }

    const timeFormatted = `${String(hNum).padStart(2, '0')}:${String(mNum).padStart(2, '0')}`;
    const customTakenIso = buildScheduledIso(parsedDateIso, timeFormatted);

    try {
      const doseLogId = activeItem.doseLog.id;
      handleCloseModal();
      const result = await markDoseAsTaken(doseLogId, customTakenIso);
      await loadData(selectedDate);

      if (result.autoArchived) {
        Alert.alert(
          'Tratamento Concluído!',
          `Você completou todas as ${result.targetOccurrences} doses previstas. O medicamento foi arquivado automaticamente com a data fim registrada.`
        );
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível registrar a dose tomada.');
    }
  };

  const handleRevertFromModal = async () => {
    if (!activeItem) return;
    try {
      const doseLogId = activeItem.doseLog.id;
      handleCloseModal();
      await revertDoseToPending(doseLogId);
      await loadData(selectedDate);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível desfazer.');
    }
  };

  const handleSkipDose = async (doseLogId: number) => {
    try {
      await markDoseAsSkipped(doseLogId);
      await loadData(selectedDate);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível pular a dose.');
    }
  };

  const handleSnoozeDose = async (doseLogId: number) => {
    try {
      await snoozeDose15Minutes(doseLogId);
      await loadData(selectedDate);
      Alert.alert(
        'Lembrete Adiado',
        'Você será lembrado novamente em 15 minutos.'
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível adiar o lembrete.');
    }
  };

  const isToday = selectedDate === getLocalDateString();
  const totalDoses = doses.length;
  const takenDoses = doses.filter((d) => d.doseLog.status === 'tomado').length;

  return (
    <View className="flex-1 bg-slate-50 px-4 pt-4">
      {/* Cabeçalho e Saudação */}
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text className="text-xs font-medium text-slate-500">
            Olá, {userName || 'Usuário'}
          </Text>
          <Text className="text-xl font-bold text-slate-900">
            Agenda de Medicamentos
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/medication/new')}
          className="flex-row items-center bg-blue-600 px-3.5 py-2.5 rounded-xl"
        >
          <Plus size={16} color="#FFFFFF" />
          <Text className="text-xs font-bold text-white ml-1">
            Novo Remédio
          </Text>
        </TouchableOpacity>
      </View>

      {/* Navegador de Data */}
      <View className="flex-row items-center justify-between bg-white border border-slate-200 rounded-2xl p-3 mb-4">
        <TouchableOpacity
          onPress={() => setSelectedDate((d) => shiftDateString(d, -1))}
          className="p-2 rounded-lg bg-slate-100"
        >
          <ChevronLeft size={18} color="#334155" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedDate(getLocalDateString())}
          className="items-center"
        >
          <View className="flex-row items-center">
            <Calendar size={14} color="#2563EB" />
            <Text className="text-sm font-bold text-slate-900 ml-1.5">
              {isToday ? 'Hoje' : formatDateDisplay(selectedDate)}
            </Text>
          </View>
          {isToday && (
            <Text className="text-xs text-slate-500">
              {formatDateDisplay(selectedDate)}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setSelectedDate((d) => shiftDateString(d, 1))}
          className="p-2 rounded-lg bg-slate-100"
        >
          <ChevronRight size={18} color="#334155" />
        </TouchableOpacity>
      </View>

      {/* Resumo de Progresso do Dia */}
      {totalDoses > 0 && (
        <View className="bg-blue-600 rounded-2xl p-4 mb-4 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-medium text-blue-100">
              Progresso do dia
            </Text>
            <Text className="text-lg font-bold text-white mt-0.5">
              {takenDoses} de {totalDoses} doses tomadas
            </Text>
          </View>
          <View className="w-11 h-11 rounded-full bg-blue-500 items-center justify-center">
            <CheckCircle2 size={24} color="#FFFFFF" />
          </View>
        </View>
      )}

      {/* Lista de Doses */}
      <FlatList
        data={doses}
        keyExtractor={(item) => String(item.doseLog.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <DoseCard
            item={item}
            onPress={handleOpenDoseModal}
            onSkip={handleSkipDose}
            onSnooze={handleSnoozeDose}
          />
        )}
        ListEmptyComponent={
          <View className="bg-white border border-slate-200 rounded-2xl p-8 items-center justify-center mt-4">
            <Text className="text-base font-bold text-slate-800 text-center">
              Nenhuma dose agendada para esta data
            </Text>
            <Text className="text-xs text-slate-500 text-center mt-1 mb-4">
              Cadastre um medicamento ativo para receber lembretes e acompanhar
              suas tomadas diárias.
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/medication/new')}
              className="bg-blue-600 px-4 py-2.5 rounded-xl"
            >
              <Text className="text-xs font-bold text-white">
                Cadastrar Medicamento
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Modal de Registro de Tomada (Data e Hora Atual ou Retroativa) */}
      <Modal
        visible={Boolean(activeItem)}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 bg-black/50 items-center justify-center px-5"
        >
          <View className="w-full bg-white rounded-2xl p-5 border border-slate-200">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-bold text-slate-900">
                Registrar Tomada
              </Text>
              <TouchableOpacity
                onPress={handleCloseModal}
                className="p-1.5 rounded-lg bg-slate-100"
              >
                <X size={16} color="#475569" />
              </TouchableOpacity>
            </View>

            {activeItem && (
              <>
                <View className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
                  <Text className="text-sm font-bold text-slate-900">
                    {activeItem.medication.commercialName} (
                    {activeItem.medication.concentration})
                  </Text>
                  <Text className="text-xs text-slate-600 mt-0.5">
                    Dose: {activeItem.cycle.doseAmount} • Previsto para{' '}
                    {formatTimeDisplay(activeItem.doseLog.scheduledAt)}
                  </Text>
                </View>

                <Text className="text-xs font-semibold uppercase text-slate-600 mb-1.5">
                  Data da Tomada (Dia / Mês / Ano)
                </Text>
                <View className="flex-row items-center gap-2 mb-3.5">
                  <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
                    <Calendar size={16} color="#475569" />
                    <TextInput
                      value={modalDay}
                      onChangeText={(t) =>
                        setModalDay(t.replace(/\D/g, '').slice(0, 2))
                      }
                      onBlur={() => {
                        const d = Math.min(
                          31,
                          Math.max(1, parseInt(modalDay || '1', 10) || 1)
                        );
                        setModalDay(String(d).padStart(2, '0'));
                      }}
                      selectTextOnFocus
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="DD"
                      className="w-12 text-center font-bold text-slate-900 ml-1"
                    />
                  </View>
                  <Text className="text-lg font-bold text-slate-700">/</Text>
                  <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
                    <TextInput
                      value={modalMonth}
                      onChangeText={(t) =>
                        setModalMonth(t.replace(/\D/g, '').slice(0, 2))
                      }
                      onBlur={() => {
                        const m = Math.min(
                          12,
                          Math.max(1, parseInt(modalMonth || '1', 10) || 1)
                        );
                        setModalMonth(String(m).padStart(2, '0'));
                      }}
                      selectTextOnFocus
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="MM"
                      className="w-12 text-center font-bold text-slate-900"
                    />
                  </View>
                  <Text className="text-lg font-bold text-slate-700">/</Text>
                  <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
                    <TextInput
                      value={modalYear}
                      onChangeText={(t) =>
                        setModalYear(t.replace(/\D/g, '').slice(0, 4))
                      }
                      selectTextOnFocus
                      keyboardType="number-pad"
                      maxLength={4}
                      placeholder="AAAA"
                      className="w-16 text-center font-bold text-slate-900"
                    />
                  </View>
                </View>

                <Text className="text-xs font-semibold uppercase text-slate-600 mb-1.5">
                  Horário da Tomada (Hora : Minuto)
                </Text>
                <View className="flex-row items-center gap-2 mb-5">
                  <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
                    <Clock size={16} color="#475569" />
                    <TextInput
                      value={modalHour}
                      onChangeText={(t) =>
                        setModalHour(t.replace(/\D/g, '').slice(0, 2))
                      }
                      onBlur={() => {
                        const h = Math.min(
                          23,
                          Math.max(0, parseInt(modalHour || '0', 10) || 0)
                        );
                        setModalHour(String(h).padStart(2, '0'));
                      }}
                      selectTextOnFocus
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="HH"
                      className="w-12 text-center font-bold text-slate-900 ml-1"
                    />
                  </View>
                  <Text className="text-lg font-bold text-slate-700">:</Text>
                  <View className="flex-row items-center bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
                    <TextInput
                      value={modalMinute}
                      onChangeText={(t) =>
                        setModalMinute(t.replace(/\D/g, '').slice(0, 2))
                      }
                      onBlur={() => {
                        const m = Math.min(
                          59,
                          Math.max(0, parseInt(modalMinute || '0', 10) || 0)
                        );
                        setModalMinute(String(m).padStart(2, '0'));
                      }}
                      selectTextOnFocus
                      keyboardType="number-pad"
                      maxLength={2}
                      placeholder="MM"
                      className="w-12 text-center font-bold text-slate-900"
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleConfirmTakeFromModal}
                  className="flex-row items-center justify-center bg-emerald-600 py-3.5 rounded-xl mb-2"
                >
                  <CheckCircle2 size={18} color="#FFFFFF" />
                  <Text className="text-sm font-bold text-white ml-2">
                    {activeItem.doseLog.status === 'tomado'
                      ? 'Salvar Nova Data/Hora'
                      : 'Confirmar como Tomado'}
                  </Text>
                </TouchableOpacity>

                {activeItem.doseLog.status !== 'pendente' && (
                  <TouchableOpacity
                    onPress={handleRevertFromModal}
                    className="flex-row items-center justify-center bg-slate-100 border border-slate-300 py-3 rounded-xl mt-1"
                  >
                    <RotateCcw size={15} color="#475569" />
                    <Text className="text-xs font-bold text-slate-700 ml-1.5">
                      Desfazer (Voltar para Pendente)
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

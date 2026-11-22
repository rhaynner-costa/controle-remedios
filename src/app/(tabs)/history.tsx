import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { DailyDoseItem, getDoseHistory } from '@/services/scheduleService';
import {
  extractIsoDatePart,
  formatDateDisplay,
  formatDateTimeDisplay,
  formatTimeDisplay,
  getLocalDateString,
} from '@/utils/dateUtils';
import { PillIcon } from '@/components/PillIcon';
import {
  DoseStatusBadge,
  getDoseCardClass,
  getDoseVisualStatus,
} from '@/components/DoseStatusBadge';

interface HistorySection {
  dateKey: string;
  title: string;
  data: DailyDoseItem[];
}

export default function HistoryScreen() {
  const [history, setHistory] = useState<DailyDoseItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const items = await getDoseHistory(200);
      setHistory(items);
    } catch (error) {
      console.error('[HistoryScreen] Erro ao carregar histórico:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const sections = useMemo<HistorySection[]>(() => {
    const groups = new Map<string, DailyDoseItem[]>();
    const todayStr = getLocalDateString();

    for (const item of history) {
      const referenceIso = item.doseLog.takenAt || item.doseLog.scheduledAt;
      const dateKey = extractIsoDatePart(referenceIso);
      const list = groups.get(dateKey) ?? [];
      list.push(item);
      groups.set(dateKey, list);
    }

    const sortedKeys = Array.from(groups.keys()).sort((a, b) =>
      b.localeCompare(a)
    );

    return sortedKeys.map((dateKey) => {
      const formatted = formatDateDisplay(dateKey);
      const title =
        dateKey === todayStr ? `Hoje — ${formatted}` : formatted;
      return {
        dateKey,
        title,
        data: groups.get(dateKey) ?? [],
      };
    });
  }, [history]);

  return (
    <View className="flex-1 bg-slate-50 px-4 pt-4">
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.doseLog.id)}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        renderSectionHeader={({ section }) => (
          <View className="flex-row items-center justify-between bg-slate-200/70 px-3.5 py-2 rounded-xl mt-2 mb-2">
            <View className="flex-row items-center">
              <Calendar size={14} color="#2563EB" />
              <Text className="text-xs font-bold text-slate-800 ml-1.5">
                {section.title}
              </Text>
            </View>
            <Text className="text-[11px] font-semibold text-slate-600">
              {section.data.length}{' '}
              {section.data.length === 1 ? 'registro' : 'registros'}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const visualStatus = getDoseVisualStatus(item.doseLog);
          return (
            <View
              testID={`history-item-${item.doseLog.id}`}
              className={`border rounded-2xl p-4 mb-2.5 flex-row items-center ${getDoseCardClass(
                visualStatus
              )}`}
            >
              <View className="mr-3">
                <PillIcon
                  shape={item.medication.pillShape}
                  primaryColor={item.medication.pillColorPrimary}
                  secondaryColor={item.medication.pillColorSecondary}
                  size={34}
                />
              </View>
              <View className="flex-1">
                <View className="flex-row items-start justify-between">
                  <Text className="text-sm font-bold text-slate-900 flex-1 mr-2">
                    {item.medication.commercialName} (
                    {item.medication.concentration})
                  </Text>
                  <DoseStatusBadge
                    status={visualStatus}
                    testID={`history-item-status-${item.doseLog.id}`}
                  />
                </View>
                <Text className="text-xs text-slate-600">
                  Dose: {item.cycle.doseAmount} • Agendado:{' '}
                  {formatDateTimeDisplay(item.doseLog.scheduledAt)}
                </Text>
                {visualStatus === 'tomado' && item.doseLog.takenAt && (
                  <Text className="text-xs font-semibold text-emerald-800 mt-1">
                    {formatDateDisplay(item.doseLog.takenAt)} às{' '}
                    {formatTimeDisplay(item.doseLog.takenAt)}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="bg-white border border-slate-200 rounded-2xl p-8 items-center justify-center mt-4">
            <Text className="text-base font-bold text-slate-800 text-center">
              Nenhum registro no histórico ainda
            </Text>
            <Text className="text-xs text-slate-500 text-center mt-1">
              Assim que você cadastrar medicamentos, as doses aparecerão aqui
              agrupadas por data, com o status de cada uma.
            </Text>
          </View>
        }
      />
    </View>
  );
}

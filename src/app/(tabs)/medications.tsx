import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { MedicationStatus } from '@/db/schema';
import {
  listMedicationsByStatus,
  MedicationWithCycle,
} from '@/services/medicationService';
import { MedicationCard } from '@/components/MedicationCard';

type FilterTab = 'ativo' | 'arquivado' | 'todos';

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'ativo', label: 'Ativos' },
  { id: 'arquivado', label: 'Arquivados' },
  { id: 'todos', label: 'Todos' },
];

export default function MedicationsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>('ativo');
  const [items, setItems] = useState<MedicationWithCycle[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadMedications = useCallback(async (currentFilter: FilterTab) => {
    try {
      const statusArg: MedicationStatus | undefined =
        currentFilter === 'todos' ? undefined : currentFilter;
      const list = await listMedicationsByStatus(statusArg);
      setItems(list);
    } catch (error) {
      console.error('[MedicationsScreen] Erro ao listar medicamentos:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMedications(filter);
    }, [loadMedications, filter])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMedications(filter);
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-slate-50 px-4 pt-4">
      {/* Abas de Filtro por Status */}
      <View className="flex-row bg-white border border-slate-200 rounded-xl p-1 mb-4">
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              testID={`medications-filter-${tab.id}`}
              onPress={() => setFilter(tab.id)}
              className={`flex-1 py-2 rounded-lg items-center ${
                active ? 'bg-blue-600' : 'bg-transparent'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  active ? 'text-white' : 'text-slate-600'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => (
          <MedicationCard
            medication={item}
            onPress={(id) => router.push(`/medication/${id}`)}
          />
        )}
        ListEmptyComponent={
          <View className="bg-white border border-slate-200 rounded-2xl p-8 items-center justify-center mt-4">
            <Text className="text-base font-bold text-slate-800 text-center">
              Nenhum medicamento encontrado neste filtro
            </Text>
            <Text className="text-xs text-slate-500 text-center mt-1">
              Os cadastros nunca são excluídos fisicamente — você pode alternar
              entre Ativos e Arquivados a qualquer momento.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        testID="medications-fab-new"
        onPress={() => router.push('/medication/new')}
        className="absolute bottom-5 right-5 flex-row items-center bg-blue-600 px-4 py-3.5 rounded-full shadow"
      >
        <Plus size={18} color="#FFFFFF" />
        <Text className="text-xs font-bold text-white ml-1.5">
          Cadastrar Medicamento
        </Text>
      </TouchableOpacity>
    </View>
  );
}

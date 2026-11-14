import '../../global.css';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { initializeDatabase } from '@/db/client';
import { getUserProfile } from '@/services/userService';
import {
  ACTION_SNOOZE_15M,
  ACTION_TAKE_DOSE,
  setupNotifications,
} from '@/services/notificationService';
import {
  getDosesForDate,
  markDoseAsTaken,
  snoozeDose15Minutes,
} from '@/services/scheduleService';
import { getLocalDateString } from '@/utils/dateUtils';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function bootstrap() {
      try {
        initializeDatabase();
        await setupNotifications();
        const profile = await getUserProfile();
        setHasUser(Boolean(profile));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erro ao iniciar banco de dados';
        setInitError(message);
      } finally {
        setIsReady(true);
      }
    }

    bootstrap();
  }, []);

  // Listener de ações rápidas direto na notificação (Tomar / Adiar 15m)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        try {
          const actionId = response.actionIdentifier;
          const data = response.notification.request.content.data as {
            medicationId?: number;
            cycleId?: number;
            doseLogId?: number;
            scheduledTime?: string;
          };

          let targetDoseLogId = data?.doseLogId;
          if (!targetDoseLogId && data?.cycleId && data?.scheduledTime) {
            const todayDoses = await getDosesForDate(getLocalDateString());
            const matched = todayDoses.find(
              (d) =>
                d.cycle.id === data.cycleId &&
                d.doseLog.scheduledAt.includes(`T${data.scheduledTime}`)
            );
            targetDoseLogId = matched?.doseLog.id;
          }

          if (!targetDoseLogId) return;

          if (actionId === ACTION_TAKE_DOSE) {
            await markDoseAsTaken(targetDoseLogId);
          } else if (actionId === ACTION_SNOOZE_15M) {
            await snoozeDose15Minutes(targetDoseLogId);
          }
        } catch (error) {
          console.error('[RootLayout] Erro ao processar ação da notificação:', error);
        }
      }
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isReady || hasUser === null) return;

    let cancelled = false;
    async function verifyUserAndRedirect() {
      const inOnboarding = segments[0] === 'onboarding';
      let currentHasUser = hasUser;

      if (!currentHasUser) {
        const profile = await getUserProfile();
        currentHasUser = Boolean(profile);
        if (!cancelled && currentHasUser) {
          setHasUser(true);
        }
      }

      if (cancelled) return;

      if (!currentHasUser && !inOnboarding) {
        router.replace('/onboarding');
      } else if (currentHasUser && inOnboarding) {
        router.replace('/(tabs)');
      }
    }

    verifyUserAndRedirect();
    return () => {
      cancelled = true;
    };
  }, [isReady, hasUser, segments, router]);

  if (initError) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 p-6">
        <Text className="text-lg font-bold text-red-600 mb-2">
          Falha na inicialização
        </Text>
        <Text className="text-sm text-slate-700 text-center">{initError}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="medication/new"
          options={{
            headerShown: true,
            title: 'Novo Medicamento',
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="medication/[id]"
          options={{
            headerShown: true,
            title: 'Detalhes do Medicamento',
          }}
        />
        <Stack.Screen
          name="medication/[id]/reactivate"
          options={{
            headerShown: true,
            title: 'Reativar Medicamento',
          }}
        />
      </Stack>
    </>
  );
}

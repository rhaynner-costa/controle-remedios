import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { RecurrenceType } from '@/db/schema';

export const MEDICATION_CHANNEL_ID = 'medication-reminders';
export const NOTIFICATION_CATEGORY_DOSE = 'DOSE_REMINDER_CATEGORY';
export const ACTION_TAKE_DOSE = 'ACTION_TAKE_DOSE';
export const ACTION_SNOOZE_15M = 'ACTION_SNOOZE_15M';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(MEDICATION_CHANNEL_ID, {
        name: 'Lembretes de Medicamentos',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: true,
        sound: 'default',
      });
    }

    await Notifications.setNotificationCategoryAsync(
      NOTIFICATION_CATEGORY_DOSE,
      [
        {
          identifier: ACTION_TAKE_DOSE,
          buttonTitle: 'Marcar como Tomado',
          options: { opensAppToForeground: true },
        },
        {
          identifier: ACTION_SNOOZE_15M,
          buttonTitle: 'Adiar 15 min',
          options: { opensAppToForeground: false },
        },
      ]
    );

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.error(
      '[NotificationService] Erro ao configurar notificações:',
      error
    );
    return false;
  }
}

export interface ScheduleCycleNotificationsParams {
  medicationId: number;
  cycleId: number;
  commercialName: string;
  concentration: string;
  doseAmount: string;
  recurrenceType: RecurrenceType;
  scheduledTimes: string[]; // ["08:00", "16:00"]
  daysOfWeek: number[]; // 0 (Dom) a 6 (Sáb)
  occurrenceSlots?: string[]; // ["2026-11-14T08:00:00", ...]
}

export async function scheduleCycleNotifications(
  params: ScheduleCycleNotificationsParams
): Promise<string[]> {
  const scheduledIds: string[] = [];

  try {
    const hasPermission = await setupNotifications();
    if (!hasPermission) {
      return scheduledIds;
    }

    // 1. Se houver slots exatos de ocorrências, agenda gatilhos DATE exatos para cada um no futuro
    if (params.occurrenceSlots && params.occurrenceSlots.length > 0) {
      const nowMs = Date.now();
      for (const slotIso of params.occurrenceSlots) {
        const [datePart, timePart] = slotIso.split('T');
        if (!datePart || !timePart) continue;
        const [y, m, d] = datePart.split('-').map(Number);
        const [hour, minute] = timePart.split(':').map(Number);
        if (
          !Number.isFinite(y) ||
          !Number.isFinite(m) ||
          !Number.isFinite(d) ||
          !Number.isFinite(hour) ||
          !Number.isFinite(minute)
        ) {
          continue;
        }

        const triggerDate = new Date(y, m - 1, d, hour, minute, 0, 0);
        if (triggerDate.getTime() <= nowMs) {
          continue;
        }

        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `Hora do remédio: ${params.commercialName} (${params.concentration})`,
            body: `Tomar ${params.doseAmount} — Horário previsto: ${timeStr}`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            categoryIdentifier: NOTIFICATION_CATEGORY_DOSE,
            data: {
              medicationId: params.medicationId,
              cycleId: params.cycleId,
              scheduledTime: timeStr,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: MEDICATION_CHANNEL_ID,
          },
        });
        scheduledIds.push(id);
      }

      if (scheduledIds.length > 0) {
        return scheduledIds;
      }
    }

    // 2. Fallback / Recorrência diária vinculada ao canal de prioridade máxima
    for (const timeStr of params.scheduledTimes) {
      const [hour, minute] = timeStr.split(':').map(Number);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;

      if (
        params.recurrenceType === 'weekly_days' &&
        params.daysOfWeek.length < 7
      ) {
        for (const dayIndex of params.daysOfWeek) {
          const expoWeekday = dayIndex + 1;
          const id = await Notifications.scheduleNotificationAsync({
            content: {
              title: `Hora do remédio: ${params.commercialName} (${params.concentration})`,
              body: `Tomar ${params.doseAmount} — Horário previsto: ${timeStr}`,
              sound: 'default',
              priority: Notifications.AndroidNotificationPriority.MAX,
              categoryIdentifier: NOTIFICATION_CATEGORY_DOSE,
              data: {
                medicationId: params.medicationId,
                cycleId: params.cycleId,
                scheduledTime: timeStr,
              },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
              weekday: expoWeekday,
              hour,
              minute,
              channelId: MEDICATION_CHANNEL_ID,
            },
          });
          scheduledIds.push(id);
        }
      } else {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: `Hora do remédio: ${params.commercialName} (${params.concentration})`,
            body: `Tomar ${params.doseAmount} — Horário previsto: ${timeStr}`,
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.MAX,
            categoryIdentifier: NOTIFICATION_CATEGORY_DOSE,
            data: {
              medicationId: params.medicationId,
              cycleId: params.cycleId,
              scheduledTime: timeStr,
            },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            channelId: MEDICATION_CHANNEL_ID,
          },
        });
        scheduledIds.push(id);
      }
    }

    return scheduledIds;
  } catch (error) {
    console.error('[NotificationService] Erro ao agendar lembretes:', error);
    return scheduledIds;
  }
}

export async function scheduleSnoozeNotification(params: {
  medicationId: number;
  cycleId: number;
  doseLogId: number;
  commercialName: string;
  doseAmount: string;
  minutes?: number;
}): Promise<string | null> {
  try {
    const minutes = params.minutes ?? 15;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Lembrete adiado: ${params.commercialName}`,
        body: `Não esqueça de tomar ${params.doseAmount}`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: NOTIFICATION_CATEGORY_DOSE,
        data: {
          medicationId: params.medicationId,
          cycleId: params.cycleId,
          doseLogId: params.doseLogId,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: minutes * 60,
        repeats: false,
        channelId: MEDICATION_CHANNEL_ID,
      },
    });
    return id;
  } catch (error) {
    console.error('[NotificationService] Erro ao agendar soneca:', error);
    return null;
  }
}

export async function cancelNotificationIds(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.warn(
        '[NotificationService] Falha ao cancelar notificação:',
        id,
        error
      );
    }
  }
}

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { db } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

// Registers this device for push. Needs the additive `app_push_tokens` table (see app/sql). Fails quietly until it exists.
export async function registerPush(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Messages and viewings', importance: Notifications.AndroidImportance.HIGH });
    }
    const cur = await Notifications.getPermissionsAsync();
    const perm = cur.granted ? cur : await Notifications.requestPermissionsAsync();
    if (!perm.granted) return;
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await db.from('app_push_tokens').upsert({ user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: 'token' });
  } catch { /* push is optional; never block the app */ }
}

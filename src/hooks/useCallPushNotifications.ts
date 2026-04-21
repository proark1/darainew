import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Dynamic imports for Capacitor plugins
let PushNotifications: any = null;

const loadPushNotifications = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const module = await import('@capacitor/push-notifications');
      PushNotifications = module.PushNotifications;
      return true;
    } catch (e) {
      console.log('[CallPush] Plugin not available:', e);
      return false;
    }
  }
  return false;
};

interface UseCallPushNotificationsOptions {
  userId: string | null;
  onIncomingCall?: (callerId: string, callerName: string, sessionId: string) => void;
  enabled?: boolean;
}

export function useCallPushNotifications({ userId, onIncomingCall, enabled = true }: UseCallPushNotificationsOptions) {
  const { toast } = useToast();
  const tokenRef = useRef<string | null>(null);

  // Register push token with backend
  const registerToken = useCallback(async (token: string) => {
    if (!userId) return;

    console.log('[CallPush] Registering token for user:', userId);

    try {
      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,token',
        });

      if (error) {
        console.error('[CallPush] Error registering token:', error);
      } else {
        console.log('[CallPush] Token registered successfully');
        tokenRef.current = token;
      }
    } catch (e) {
      console.error('[CallPush] Failed to register token:', e);
    }
  }, [userId]);

  // Initialize push notifications
  const initializePushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[CallPush] Not on native platform, skipping');
      return;
    }

    const loaded = await loadPushNotifications();
    if (!loaded || !PushNotifications) {
      console.log('[CallPush] PushNotifications plugin not available');
      return;
    }

    try {
      // Request permission
      const permResult = await PushNotifications.requestPermissions();
      console.log('[CallPush] Permission result:', permResult);

      if (permResult.receive !== 'granted') {
        toast({
          title: 'Push Notifications Disabled',
          description: 'Enable notifications in settings to receive call alerts.',
          variant: 'destructive',
        });
        return;
      }

      // Register for push notifications
      await PushNotifications.register();

      // Listen for registration success
      PushNotifications.addListener('registration', (token: { value: string }) => {
        console.log('[CallPush] Registration token:', token.value);
        registerToken(token.value);
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('[CallPush] Registration error:', error);
      });

      // Listen for push notifications received
      PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
        console.log('[CallPush] Push notification received:', notification);

        const { data } = notification;
        if (data?.type === 'incoming_call' && onIncomingCall) {
          onIncomingCall(data.caller_id, data.caller_name, data.session_id);
        }
      });

      // Listen for push notification action performed
      PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
        console.log('[CallPush] Push notification action:', action);

        const { data } = action.notification;
        if (data?.type === 'incoming_call' && onIncomingCall) {
          onIncomingCall(data.caller_id, data.caller_name, data.session_id);
        }
      });

      console.log('[CallPush] Push notifications initialized');
    } catch (error) {
      console.error('[CallPush] Initialization error:', error);
    }
  }, [registerToken, toast, onIncomingCall]);

  // Cleanup on unmount
  const cleanup = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || !PushNotifications) return;

    try {
      await PushNotifications.removeAllListeners();
      console.log('[CallPush] Listeners removed');
    } catch (e) {
      console.error('[CallPush] Cleanup error:', e);
    }
  }, []);

  useEffect(() => {
    if (enabled && userId) {
      initializePushNotifications();
    }

    return () => {
      cleanup();
    };
  }, [userId, enabled, initializePushNotifications, cleanup]);

  return {
    token: tokenRef.current,
    reinitialize: initializePushNotifications,
  };
}

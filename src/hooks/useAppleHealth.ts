import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HealthMetric {
  id: string;
  user_id: string;
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
  source: string;
  notes: string | null;
  created_at: string;
}

export interface DailyHealthSummary {
  date: string;
  steps: number;
  calories: number;
  activeMinutes: number;
  sleepHours: number;
  heartRateAvg: number;
  weight?: number;
  waterIntake: number;
}

// HealthKit read permissions
const READ_PERMISSIONS = [
  'stepCount',
  'heartRate',
  'activeEnergyBurned',
  'basalEnergyBurned',
  'sleepAnalysis',
  'bodyMass',
  'height',
  'bodyMassIndex',
  'oxygenSaturation',
  'bloodPressureSystolic',
  'bloodPressureDiastolic',
];

const isNative = Capacitor.isNativePlatform();
const isIOS = isNative && Capacitor.getPlatform() === 'ios';

// Dynamic import for HealthKit plugin (only on iOS)
let CapacitorHealthkit: any = null;

const loadHealthKitPlugin = async () => {
  if (isIOS && !CapacitorHealthkit) {
    try {
      const module = await import('@perfood/capacitor-healthkit');
      CapacitorHealthkit = module.CapacitorHealthkit;
      return true;
    } catch (err) {
      console.warn('HealthKit plugin not available:', err);
      return false;
    }
  }
  return !!CapacitorHealthkit;
};

export function useAppleHealth() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [todaySummary, setTodaySummary] = useState<DailyHealthSummary | null>(null);
  const [weeklyData, setWeeklyData] = useState<DailyHealthSummary[]>([]);
  const [pluginLoaded, setPluginLoaded] = useState(false);

  const isAvailable = isIOS;

  // Load plugin on mount
  useEffect(() => {
    if (isAvailable) {
      loadHealthKitPlugin().then(setPluginLoaded);
    }
  }, [isAvailable]);

  // Check if already authorized on mount
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!isAvailable || !pluginLoaded || !user?.id) return;
      
      try {
        // Check if we have existing health data from Apple Health
        const { data } = await supabase
          .from('health_metrics')
          .select('id')
          .eq('user_id', user.id)
          .eq('source', 'apple_health')
          .limit(1);
        
        if (data && data.length > 0) {
          setIsConnected(true);
        }
      } catch (error) {
        console.log('Error checking authorization:', error);
      }
    };

    checkAuthorization();
  }, [isAvailable, pluginLoaded, user?.id]);

  const fetchHealthMetrics = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', user.id)
        .order('recorded_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      setHealthMetrics(data || []);
      
      // Calculate today's summary
      const today = new Date().toISOString().split('T')[0];
      const todayMetrics = (data || []).filter(m => 
        m.recorded_at.startsWith(today)
      );
      
      if (todayMetrics.length > 0) {
        setTodaySummary({
          date: today,
          steps: todayMetrics.find(m => m.metric_type === 'steps')?.value || 0,
          calories: todayMetrics.find(m => m.metric_type === 'calories')?.value || 0,
          activeMinutes: todayMetrics.find(m => m.metric_type === 'active_minutes')?.value || 0,
          sleepHours: todayMetrics.find(m => m.metric_type === 'sleep_hours')?.value || 0,
          heartRateAvg: todayMetrics.find(m => m.metric_type === 'heart_rate')?.value || 0,
          weight: todayMetrics.find(m => m.metric_type === 'weight')?.value,
          waterIntake: todayMetrics.find(m => m.metric_type === 'water_intake')?.value || 0,
        });
      }
      
      // Calculate weekly data
      const weekly: DailyHealthSummary[] = [];
      
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayMetrics = (data || []).filter(m => m.recorded_at.startsWith(dateStr));
        
        weekly.push({
          date: dateStr,
          steps: dayMetrics.find(m => m.metric_type === 'steps')?.value || 0,
          calories: dayMetrics.find(m => m.metric_type === 'calories')?.value || 0,
          activeMinutes: dayMetrics.find(m => m.metric_type === 'active_minutes')?.value || 0,
          sleepHours: dayMetrics.find(m => m.metric_type === 'sleep_hours')?.value || 0,
          heartRateAvg: dayMetrics.find(m => m.metric_type === 'heart_rate')?.value || 0,
          weight: dayMetrics.find(m => m.metric_type === 'weight')?.value,
          waterIntake: dayMetrics.find(m => m.metric_type === 'water_intake')?.value || 0,
        });
      }
      
      setWeeklyData(weekly.reverse());
    } catch (error) {
      console.error('Error fetching health metrics:', error);
    }
  }, [user?.id]);

  const requestAppleHealthPermission = useCallback(async () => {
    if (!isAvailable) {
      toast.error('Apple Health is only available on iPhone');
      return false;
    }

    const loaded = await loadHealthKitPlugin();
    if (!loaded || !CapacitorHealthkit) {
      toast.error('HealthKit plugin not available. Rebuild app with native code.');
      return false;
    }
    
    setIsLoading(true);
    try {
      // Request authorization for health data types
      await CapacitorHealthkit.requestAuthorization({
        all: [],
        read: READ_PERMISSIONS,
        write: [],
      });

      setIsConnected(true);
      toast.success('Connected to Apple Health');
      
      // Immediately sync data after connecting
      await syncAppleHealthInternal();
      
      return true;
    } catch (error: any) {
      console.error('Error connecting to Apple Health:', error);
      toast.error(error.message || 'Failed to connect to Apple Health');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable]);

  const syncAppleHealthInternal = async () => {
    if (!CapacitorHealthkit || !user?.id) return;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(startOfDay);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const metricsToInsert: Array<{
      user_id: string;
      metric_type: string;
      value: number;
      unit: string;
      recorded_at: string;
      source: string;
    }> = [];

    // Fetch steps
    try {
      const stepsData = await CapacitorHealthkit.queryHKitSampleType({
        sampleName: 'stepCount',
        startDate: weekAgo.toISOString(),
        endDate: now.toISOString(),
        limit: 0,
      });

      if (stepsData?.resultData) {
        // Aggregate by day
        const stepsByDay: Record<string, number> = {};
        for (const sample of stepsData.resultData) {
          const dayKey = sample.startDate.split('T')[0];
          stepsByDay[dayKey] = (stepsByDay[dayKey] || 0) + (sample.value || 0);
        }
        
        for (const [date, value] of Object.entries(stepsByDay)) {
          metricsToInsert.push({
            user_id: user.id,
            metric_type: 'steps',
            value: Math.round(value),
            unit: 'steps',
            recorded_at: `${date}T12:00:00.000Z`,
            source: 'apple_health',
          });
        }
      }
    } catch (e) {
      console.log('Steps data not available:', e);
    }

    // Fetch heart rate
    try {
      const heartRateData = await CapacitorHealthkit.queryHKitSampleType({
        sampleName: 'heartRate',
        startDate: weekAgo.toISOString(),
        endDate: now.toISOString(),
        limit: 0,
      });

      if (heartRateData?.resultData) {
        // Average by day
        const hrByDay: Record<string, { sum: number; count: number }> = {};
        for (const sample of heartRateData.resultData) {
          const dayKey = sample.startDate.split('T')[0];
          if (!hrByDay[dayKey]) hrByDay[dayKey] = { sum: 0, count: 0 };
          hrByDay[dayKey].sum += sample.value || 0;
          hrByDay[dayKey].count += 1;
        }
        
        for (const [date, { sum, count }] of Object.entries(hrByDay)) {
          metricsToInsert.push({
            user_id: user.id,
            metric_type: 'heart_rate',
            value: Math.round(sum / count),
            unit: 'bpm',
            recorded_at: `${date}T12:00:00.000Z`,
            source: 'apple_health',
          });
        }
      }
    } catch (e) {
      console.log('Heart rate data not available:', e);
    }

    // Fetch active energy burned (calories)
    try {
      const caloriesData = await CapacitorHealthkit.queryHKitSampleType({
        sampleName: 'activeEnergyBurned',
        startDate: weekAgo.toISOString(),
        endDate: now.toISOString(),
        limit: 0,
      });

      if (caloriesData?.resultData) {
        const caloriesByDay: Record<string, number> = {};
        for (const sample of caloriesData.resultData) {
          const dayKey = sample.startDate.split('T')[0];
          caloriesByDay[dayKey] = (caloriesByDay[dayKey] || 0) + (sample.value || 0);
        }
        
        for (const [date, value] of Object.entries(caloriesByDay)) {
          metricsToInsert.push({
            user_id: user.id,
            metric_type: 'calories',
            value: Math.round(value),
            unit: 'kcal',
            recorded_at: `${date}T12:00:00.000Z`,
            source: 'apple_health',
          });
        }
      }
    } catch (e) {
      console.log('Calories data not available:', e);
    }

    // Fetch sleep analysis
    try {
      const sleepData = await CapacitorHealthkit.queryHKitSampleType({
        sampleName: 'sleepAnalysis',
        startDate: weekAgo.toISOString(),
        endDate: now.toISOString(),
        limit: 0,
      });

      if (sleepData?.resultData) {
        const sleepByDay: Record<string, number> = {};
        
        for (const sample of sleepData.resultData) {
          // Only count asleep states
          if (sample.value >= 1 && sample.value <= 5) {
            const dayKey = sample.startDate.split('T')[0];
            const durationMs = new Date(sample.endDate).getTime() - new Date(sample.startDate).getTime();
            const durationHours = durationMs / (1000 * 60 * 60);
            sleepByDay[dayKey] = (sleepByDay[dayKey] || 0) + durationHours;
          }
        }

        for (const [date, hours] of Object.entries(sleepByDay)) {
          metricsToInsert.push({
            user_id: user.id,
            metric_type: 'sleep_hours',
            value: Math.round(hours * 10) / 10,
            unit: 'hours',
            recorded_at: `${date}T00:00:00.000Z`,
            source: 'apple_health',
          });
        }
      }
    } catch (e) {
      console.log('Sleep data not available:', e);
    }

    // Fetch weight
    try {
      const weightData = await CapacitorHealthkit.queryHKitSampleType({
        sampleName: 'bodyMass',
        startDate: weekAgo.toISOString(),
        endDate: now.toISOString(),
        limit: 0,
      });

      if (weightData?.resultData) {
        // Get latest weight per day
        const weightByDay: Record<string, number> = {};
        for (const sample of weightData.resultData) {
          const dayKey = sample.startDate.split('T')[0];
          weightByDay[dayKey] = sample.value || 0;
        }
        
        for (const [date, value] of Object.entries(weightByDay)) {
          metricsToInsert.push({
            user_id: user.id,
            metric_type: 'weight',
            value: Math.round(value * 10) / 10,
            unit: 'kg',
            recorded_at: `${date}T12:00:00.000Z`,
            source: 'apple_health',
          });
        }
      }
    } catch (e) {
      console.log('Weight data not available:', e);
    }

    // Delete existing Apple Health data for the sync period to avoid duplicates
    if (metricsToInsert.length > 0) {
      await supabase
        .from('health_metrics')
        .delete()
        .eq('user_id', user.id)
        .eq('source', 'apple_health')
        .gte('recorded_at', weekAgo.toISOString());

      // Insert new data
      const { error } = await supabase
        .from('health_metrics')
        .insert(metricsToInsert);

      if (error) throw error;

      toast.success(`Synced ${metricsToInsert.length} health records`);
    } else {
      toast.info('No health data found to sync');
    }

    await fetchHealthMetrics();
  };

  const syncAppleHealth = useCallback(async () => {
    if (!isAvailable) {
      toast.error('Apple Health sync is only available on iPhone');
      return;
    }

    const loaded = await loadHealthKitPlugin();
    if (!loaded || !CapacitorHealthkit || !user?.id) {
      toast.error('HealthKit not available');
      return;
    }
    
    setIsLoading(true);
    try {
      await syncAppleHealthInternal();
    } catch (error: any) {
      console.error('Error syncing Apple Health:', error);
      toast.error(error.message || 'Failed to sync health data');
    } finally {
      setIsLoading(false);
    }
  }, [isAvailable, user?.id, fetchHealthMetrics]);

  const addManualMetric = useCallback(async (
    metricType: string,
    value: number,
    unit: string,
    recordedAt?: Date
  ) => {
    if (!user?.id) return null;
    
    try {
      const { data, error } = await supabase
        .from('health_metrics')
        .insert({
          user_id: user.id,
          metric_type: metricType,
          value,
          unit,
          recorded_at: (recordedAt || new Date()).toISOString(),
          source: 'manual',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setHealthMetrics(prev => [data, ...prev]);
      toast.success('Health metric added');
      await fetchHealthMetrics();
      return data;
    } catch (error) {
      console.error('Error adding health metric:', error);
      toast.error('Failed to add health metric');
      return null;
    }
  }, [user?.id, fetchHealthMetrics]);

  const deleteMetric = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('health_metrics')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setHealthMetrics(prev => prev.filter(m => m.id !== id));
      toast.success('Health metric deleted');
    } catch (error) {
      console.error('Error deleting health metric:', error);
      toast.error('Failed to delete health metric');
    }
  }, []);

  useEffect(() => {
    fetchHealthMetrics();
  }, [fetchHealthMetrics]);

  return {
    isAvailable,
    isConnected,
    isLoading,
    healthMetrics,
    todaySummary,
    weeklyData,
    requestAppleHealthPermission,
    syncAppleHealth,
    addManualMetric,
    deleteMetric,
    refetch: fetchHealthMetrics,
  };
}

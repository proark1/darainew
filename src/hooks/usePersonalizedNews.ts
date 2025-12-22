import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface NewsItem {
  headline: string;
  summary: string;
  category: string;
  url?: string;
}

interface LocationData {
  latitude?: number;
  longitude?: number;
  city?: string;
  country?: string;
}

interface UsePersonalizedNewsOptions {
  interests?: string[];
  skills?: string[];
  businesses?: string[];
}

export function usePersonalizedNews(options: UsePersonalizedNewsOptions = {}) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationData | null>(null);

  // Get user's location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Try to reverse geocode to get city/country
          try {
            const geoResponse = await fetch(
              `https://geocoding-api.open-meteo.com/v1/search?latitude=${latitude}&longitude=${longitude}&count=1`
            );
            
            if (geoResponse.ok) {
              const geoData = await geoResponse.json();
              if (geoData.results?.[0]) {
                setLocation({
                  latitude,
                  longitude,
                  city: geoData.results[0].name,
                  country: geoData.results[0].country,
                });
                return;
              }
            }
          } catch (err) {
            console.error('Reverse geocoding error:', err);
          }
          
          // Fallback to just coordinates
          setLocation({ latitude, longitude });
        },
        (err) => {
          console.error('Geolocation error:', err);
          setLocation(null);
        },
        { timeout: 10000 }
      );
    }
  }, []);

  const fetchNews = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error: fnError } = await supabase.functions.invoke('morning-briefing', {
        body: {
          interests: options.interests || [],
          skills: options.skills || [],
          businesses: options.businesses || [],
          location: location || undefined,
        },
      });

      if (fnError) throw fnError;

      setNews(data?.news || []);
      setError(null);
    } catch (err) {
      console.error('News fetch error:', err);
      setError('Could not fetch news');
      setNews([]);
    } finally {
      setLoading(false);
    }
  }, [options.interests, options.skills, options.businesses, location]);

  useEffect(() => {
    // Only fetch news once location is determined (or after timeout)
    const timeoutId = setTimeout(() => {
      fetchNews();
    }, location === null ? 2000 : 0); // Wait 2s if no location yet to give geolocation time

    return () => clearTimeout(timeoutId);
  }, [fetchNews, location]);

  return { news, loading, error, refetch: fetchNews };
}

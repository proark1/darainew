import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Compass, BookOpen, Clock, RefreshCw, MapPin, Navigation, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PrayerTime {
  name: string;
  time: string;
  arabicName: string;
}

interface QiblaData {
  direction: number;
  latitude: number;
  longitude: number;
}

export function IslamPanel() {
  const [activeTab, setActiveTab] = useState('prayer');
  const [prayerTimes, setPrayerTimes] = useState<PrayerTime[]>([]);
  const [loading, setLoading] = useState(false);
  const [qiblaData, setQiblaData] = useState<QiblaData | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch prayer times based on location
  const fetchPrayerTimes = async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const date = new Date();
      const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
      const response = await fetch(
        `https://api.aladhan.com/v1/timings/${dateStr}?latitude=${lat}&longitude=${lng}&method=2`
      );
      const data = await response.json();
      
      if (data.code === 200) {
        const timings = data.data.timings;
        setPrayerTimes([
          { name: 'Fajr', arabicName: 'الفجر', time: timings.Fajr },
          { name: 'Sunrise', arabicName: 'الشروق', time: timings.Sunrise },
          { name: 'Dhuhr', arabicName: 'الظهر', time: timings.Dhuhr },
          { name: 'Asr', arabicName: 'العصر', time: timings.Asr },
          { name: 'Maghrib', arabicName: 'المغرب', time: timings.Maghrib },
          { name: 'Isha', arabicName: 'العشاء', time: timings.Isha },
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch prayer times:', error);
      toast.error('Failed to fetch prayer times');
    } finally {
      setLoading(false);
    }
  };

  // Calculate Qibla direction
  const calculateQibla = (lat: number, lng: number): number => {
    const meccaLat = 21.4225;
    const meccaLng = 39.8262;
    
    const phiK = (meccaLat * Math.PI) / 180;
    const lambdaK = (meccaLng * Math.PI) / 180;
    const phi = (lat * Math.PI) / 180;
    const lambda = (lng * Math.PI) / 180;
    
    const qibla = (180 / Math.PI) * Math.atan2(
      Math.sin(lambdaK - lambda),
      Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(lambdaK - lambda)
    );
    
    return (qibla + 360) % 360;
  };

  // Get user location
  const getLocation = () => {
    setLocationError(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetchPrayerTimes(latitude, longitude);
          const direction = calculateQibla(latitude, longitude);
          setQiblaData({ direction, latitude, longitude });
        },
        (error) => {
          console.error('Location error:', error);
          setLocationError('Unable to get location. Please enable location services.');
          // Use default location (Mecca nearby for demo)
          fetchPrayerTimes(21.4225, 39.8262);
        }
      );
    } else {
      setLocationError('Geolocation not supported by your browser');
    }
  };

  // Watch device orientation for compass
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setDeviceHeading(event.alpha);
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  useEffect(() => {
    getLocation();
  }, []);

  // Get next prayer
  const getNextPrayer = (): PrayerTime | null => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    for (const prayer of prayerTimes) {
      if (prayer.name === 'Sunrise') continue;
      const [hours, minutes] = prayer.time.split(':').map(Number);
      const prayerMinutes = hours * 60 + minutes;
      if (prayerMinutes > currentMinutes) {
        return prayer;
      }
    }
    return prayerTimes[0]; // Return Fajr for next day
  };

  const nextPrayer = getNextPrayer();

  // Calculate compass rotation for Qibla
  const getQiblaRotation = (): number => {
    if (!qiblaData) return 0;
    if (deviceHeading !== null) {
      return qiblaData.direction - deviceHeading;
    }
    return qiblaData.direction;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <span className="text-xl">☪️</span>
            Islam
          </h2>
          <Button variant="ghost" size="icon" onClick={getLocation}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-3">
          <TabsTrigger value="prayer" className="flex-1 gap-1">
            <Clock className="w-4 h-4" />
            Prayer
          </TabsTrigger>
          <TabsTrigger value="qibla" className="flex-1 gap-1">
            <Compass className="w-4 h-4" />
            Qibla
          </TabsTrigger>
          <TabsTrigger value="quran" className="flex-1 gap-1">
            <BookOpen className="w-4 h-4" />
            Quran
          </TabsTrigger>
        </TabsList>

        {/* Prayer Times Tab */}
        <TabsContent value="prayer" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Next Prayer Card */}
              {nextPrayer && (
                <Card className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">Next Prayer</p>
                    <h3 className="text-2xl font-bold text-primary">{nextPrayer.name}</h3>
                    <p className="text-3xl font-semibold mt-2">{nextPrayer.time}</p>
                    <p className="text-lg text-muted-foreground mt-1">{nextPrayer.arabicName}</p>
                  </div>
                </Card>
              )}

              {/* Prayer Times List */}
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {prayerTimes.map((prayer) => {
                    const isNext = nextPrayer?.name === prayer.name;
                    return (
                      <Card 
                        key={prayer.name}
                        className={cn(
                          "p-3 flex items-center justify-between",
                          isNext && "border-primary/50 bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Clock className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{prayer.name}</p>
                            <p className="text-sm text-muted-foreground">{prayer.arabicName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{prayer.time}</p>
                          {isNext && <Badge variant="secondary" className="text-xs">Next</Badge>}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {locationError && (
                <div className="text-center py-4">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{locationError}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={getLocation}>
                    Retry Location
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Qibla Tab */}
        <TabsContent value="qibla" className="flex-1 mt-0">
          <div className="p-4 flex flex-col items-center justify-center h-full">
            <Card className="p-8 w-full max-w-sm">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Qibla Direction</h3>
                {qiblaData && (
                  <p className="text-sm text-muted-foreground">
                    {Math.round(qiblaData.direction)}° from North
                  </p>
                )}
              </div>

              {/* Compass */}
              <div className="relative w-48 h-48 mx-auto">
                {/* Compass Ring */}
                <div className="absolute inset-0 rounded-full border-4 border-muted" />
                
                {/* Cardinal Directions */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-sm font-bold text-primary">N</div>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm font-medium text-muted-foreground">S</div>
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">W</div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">E</div>
                
                {/* Qibla Arrow */}
                <div 
                  className="absolute inset-4 flex items-center justify-center transition-transform duration-300"
                  style={{ transform: `rotate(${getQiblaRotation()}deg)` }}
                >
                  <div className="relative w-full h-full">
                    <Navigation 
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 text-primary fill-primary" 
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary" />
                  </div>
                </div>
              </div>

              <div className="text-center mt-6">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <span className="text-2xl">🕋</span>
                  <span className="text-sm">Direction to Kaaba, Mecca</span>
                </div>
                {deviceHeading === null && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Enable device orientation for live compass
                  </p>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Quran Tab */}
        <TabsContent value="quran" className="flex-1 mt-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {/* Daily Verse */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Verse of the Day
                  </h3>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Volume2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  <p className="text-right text-xl leading-loose font-arabic" dir="rtl">
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ۝ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    "In the name of Allah, the Most Gracious, the Most Merciful. Praise be to Allah, Lord of all the worlds."
                  </p>
                  <Badge variant="secondary">Al-Fatiha 1:1-2</Badge>
                </div>
              </Card>

              {/* Quick Surahs */}
              <div>
                <h3 className="font-semibold mb-3">Popular Surahs</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Al-Fatiha', arabicName: 'الفاتحة', verses: 7 },
                    { name: 'Al-Ikhlas', arabicName: 'الإخلاص', verses: 4 },
                    { name: 'Al-Falaq', arabicName: 'الفلق', verses: 5 },
                    { name: 'An-Nas', arabicName: 'الناس', verses: 6 },
                    { name: 'Ayat Al-Kursi', arabicName: 'آية الكرسي', verses: 1 },
                    { name: 'Ya-Sin', arabicName: 'يس', verses: 83 },
                  ].map((surah) => (
                    <Card 
                      key={surah.name}
                      className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <p className="font-medium text-sm">{surah.name}</p>
                      <p className="text-xs text-muted-foreground">{surah.arabicName}</p>
                      <p className="text-xs text-muted-foreground mt-1">{surah.verses} verses</p>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Dhikr Counter */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Daily Dhikr</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { text: 'سبحان الله', transliteration: 'SubhanAllah', count: 33 },
                    { text: 'الحمد لله', transliteration: 'Alhamdulillah', count: 33 },
                    { text: 'الله أكبر', transliteration: 'Allahu Akbar', count: 34 },
                  ].map((dhikr) => (
                    <Button
                      key={dhikr.transliteration}
                      variant="outline"
                      className="h-auto py-3 flex flex-col gap-1"
                    >
                      <span className="text-lg font-arabic">{dhikr.text}</span>
                      <span className="text-xs text-muted-foreground">{dhikr.transliteration}</span>
                      <span className="text-xs">×{dhikr.count}</span>
                    </Button>
                  ))}
                </div>
              </Card>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

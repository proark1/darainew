import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Search, BookOpen, Check, Clock, AlertCircle, Play, RotateCcw,
  ChevronDown, ChevronUp, Target, Trophy, Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

interface Surah {
  number: number;
  name: string;
  englishName: string;
  numberOfAyahs: number;
}

interface HifzProgress {
  id: string;
  surah_number: number;
  surah_name: string;
  surah_name_arabic: string;
  total_ayahs: number;
  memorized_ayahs: number;
  status: 'not_started' | 'in_progress' | 'memorized' | 'needs_revision';
  last_revised_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
}

// All 114 Surahs with their details
const SURAHS: Surah[] = [
  { number: 1, name: 'الفاتحة', englishName: 'Al-Fatiha', numberOfAyahs: 7 },
  { number: 2, name: 'البقرة', englishName: 'Al-Baqarah', numberOfAyahs: 286 },
  { number: 3, name: 'آل عمران', englishName: 'Ali \'Imran', numberOfAyahs: 200 },
  { number: 4, name: 'النساء', englishName: 'An-Nisa', numberOfAyahs: 176 },
  { number: 5, name: 'المائدة', englishName: 'Al-Ma\'idah', numberOfAyahs: 120 },
  { number: 6, name: 'الأنعام', englishName: 'Al-An\'am', numberOfAyahs: 165 },
  { number: 7, name: 'الأعراف', englishName: 'Al-A\'raf', numberOfAyahs: 206 },
  { number: 8, name: 'الأنفال', englishName: 'Al-Anfal', numberOfAyahs: 75 },
  { number: 9, name: 'التوبة', englishName: 'At-Tawbah', numberOfAyahs: 129 },
  { number: 10, name: 'يونس', englishName: 'Yunus', numberOfAyahs: 109 },
  { number: 11, name: 'هود', englishName: 'Hud', numberOfAyahs: 123 },
  { number: 12, name: 'يوسف', englishName: 'Yusuf', numberOfAyahs: 111 },
  { number: 13, name: 'الرعد', englishName: 'Ar-Ra\'d', numberOfAyahs: 43 },
  { number: 14, name: 'إبراهيم', englishName: 'Ibrahim', numberOfAyahs: 52 },
  { number: 15, name: 'الحجر', englishName: 'Al-Hijr', numberOfAyahs: 99 },
  { number: 16, name: 'النحل', englishName: 'An-Nahl', numberOfAyahs: 128 },
  { number: 17, name: 'الإسراء', englishName: 'Al-Isra', numberOfAyahs: 111 },
  { number: 18, name: 'الكهف', englishName: 'Al-Kahf', numberOfAyahs: 110 },
  { number: 19, name: 'مريم', englishName: 'Maryam', numberOfAyahs: 98 },
  { number: 20, name: 'طه', englishName: 'Ta-Ha', numberOfAyahs: 135 },
  { number: 21, name: 'الأنبياء', englishName: 'Al-Anbiya', numberOfAyahs: 112 },
  { number: 22, name: 'الحج', englishName: 'Al-Hajj', numberOfAyahs: 78 },
  { number: 23, name: 'المؤمنون', englishName: 'Al-Mu\'minun', numberOfAyahs: 118 },
  { number: 24, name: 'النور', englishName: 'An-Nur', numberOfAyahs: 64 },
  { number: 25, name: 'الفرقان', englishName: 'Al-Furqan', numberOfAyahs: 77 },
  { number: 26, name: 'الشعراء', englishName: 'Ash-Shu\'ara', numberOfAyahs: 227 },
  { number: 27, name: 'النمل', englishName: 'An-Naml', numberOfAyahs: 93 },
  { number: 28, name: 'القصص', englishName: 'Al-Qasas', numberOfAyahs: 88 },
  { number: 29, name: 'العنكبوت', englishName: 'Al-Ankabut', numberOfAyahs: 69 },
  { number: 30, name: 'الروم', englishName: 'Ar-Rum', numberOfAyahs: 60 },
  { number: 31, name: 'لقمان', englishName: 'Luqman', numberOfAyahs: 34 },
  { number: 32, name: 'السجدة', englishName: 'As-Sajdah', numberOfAyahs: 30 },
  { number: 33, name: 'الأحزاب', englishName: 'Al-Ahzab', numberOfAyahs: 73 },
  { number: 34, name: 'سبأ', englishName: 'Saba', numberOfAyahs: 54 },
  { number: 35, name: 'فاطر', englishName: 'Fatir', numberOfAyahs: 45 },
  { number: 36, name: 'يس', englishName: 'Ya-Sin', numberOfAyahs: 83 },
  { number: 37, name: 'الصافات', englishName: 'As-Saffat', numberOfAyahs: 182 },
  { number: 38, name: 'ص', englishName: 'Sad', numberOfAyahs: 88 },
  { number: 39, name: 'الزمر', englishName: 'Az-Zumar', numberOfAyahs: 75 },
  { number: 40, name: 'غافر', englishName: 'Ghafir', numberOfAyahs: 85 },
  { number: 41, name: 'فصلت', englishName: 'Fussilat', numberOfAyahs: 54 },
  { number: 42, name: 'الشورى', englishName: 'Ash-Shura', numberOfAyahs: 53 },
  { number: 43, name: 'الزخرف', englishName: 'Az-Zukhruf', numberOfAyahs: 89 },
  { number: 44, name: 'الدخان', englishName: 'Ad-Dukhan', numberOfAyahs: 59 },
  { number: 45, name: 'الجاثية', englishName: 'Al-Jathiyah', numberOfAyahs: 37 },
  { number: 46, name: 'الأحقاف', englishName: 'Al-Ahqaf', numberOfAyahs: 35 },
  { number: 47, name: 'محمد', englishName: 'Muhammad', numberOfAyahs: 38 },
  { number: 48, name: 'الفتح', englishName: 'Al-Fath', numberOfAyahs: 29 },
  { number: 49, name: 'الحجرات', englishName: 'Al-Hujurat', numberOfAyahs: 18 },
  { number: 50, name: 'ق', englishName: 'Qaf', numberOfAyahs: 45 },
  { number: 51, name: 'الذاريات', englishName: 'Adh-Dhariyat', numberOfAyahs: 60 },
  { number: 52, name: 'الطور', englishName: 'At-Tur', numberOfAyahs: 49 },
  { number: 53, name: 'النجم', englishName: 'An-Najm', numberOfAyahs: 62 },
  { number: 54, name: 'القمر', englishName: 'Al-Qamar', numberOfAyahs: 55 },
  { number: 55, name: 'الرحمن', englishName: 'Ar-Rahman', numberOfAyahs: 78 },
  { number: 56, name: 'الواقعة', englishName: 'Al-Waqi\'ah', numberOfAyahs: 96 },
  { number: 57, name: 'الحديد', englishName: 'Al-Hadid', numberOfAyahs: 29 },
  { number: 58, name: 'المجادلة', englishName: 'Al-Mujadila', numberOfAyahs: 22 },
  { number: 59, name: 'الحشر', englishName: 'Al-Hashr', numberOfAyahs: 24 },
  { number: 60, name: 'الممتحنة', englishName: 'Al-Mumtahanah', numberOfAyahs: 13 },
  { number: 61, name: 'الصف', englishName: 'As-Saf', numberOfAyahs: 14 },
  { number: 62, name: 'الجمعة', englishName: 'Al-Jumu\'ah', numberOfAyahs: 11 },
  { number: 63, name: 'المنافقون', englishName: 'Al-Munafiqun', numberOfAyahs: 11 },
  { number: 64, name: 'التغابن', englishName: 'At-Taghabun', numberOfAyahs: 18 },
  { number: 65, name: 'الطلاق', englishName: 'At-Talaq', numberOfAyahs: 12 },
  { number: 66, name: 'التحريم', englishName: 'At-Tahrim', numberOfAyahs: 12 },
  { number: 67, name: 'الملك', englishName: 'Al-Mulk', numberOfAyahs: 30 },
  { number: 68, name: 'القلم', englishName: 'Al-Qalam', numberOfAyahs: 52 },
  { number: 69, name: 'الحاقة', englishName: 'Al-Haqqah', numberOfAyahs: 52 },
  { number: 70, name: 'المعارج', englishName: 'Al-Ma\'arij', numberOfAyahs: 44 },
  { number: 71, name: 'نوح', englishName: 'Nuh', numberOfAyahs: 28 },
  { number: 72, name: 'الجن', englishName: 'Al-Jinn', numberOfAyahs: 28 },
  { number: 73, name: 'المزمل', englishName: 'Al-Muzzammil', numberOfAyahs: 20 },
  { number: 74, name: 'المدثر', englishName: 'Al-Muddaththir', numberOfAyahs: 56 },
  { number: 75, name: 'القيامة', englishName: 'Al-Qiyamah', numberOfAyahs: 40 },
  { number: 76, name: 'الإنسان', englishName: 'Al-Insan', numberOfAyahs: 31 },
  { number: 77, name: 'المرسلات', englishName: 'Al-Mursalat', numberOfAyahs: 50 },
  { number: 78, name: 'النبأ', englishName: 'An-Naba', numberOfAyahs: 40 },
  { number: 79, name: 'النازعات', englishName: 'An-Nazi\'at', numberOfAyahs: 46 },
  { number: 80, name: 'عبس', englishName: 'Abasa', numberOfAyahs: 42 },
  { number: 81, name: 'التكوير', englishName: 'At-Takwir', numberOfAyahs: 29 },
  { number: 82, name: 'الانفطار', englishName: 'Al-Infitar', numberOfAyahs: 19 },
  { number: 83, name: 'المطففين', englishName: 'Al-Mutaffifin', numberOfAyahs: 36 },
  { number: 84, name: 'الانشقاق', englishName: 'Al-Inshiqaq', numberOfAyahs: 25 },
  { number: 85, name: 'البروج', englishName: 'Al-Buruj', numberOfAyahs: 22 },
  { number: 86, name: 'الطارق', englishName: 'At-Tariq', numberOfAyahs: 17 },
  { number: 87, name: 'الأعلى', englishName: 'Al-A\'la', numberOfAyahs: 19 },
  { number: 88, name: 'الغاشية', englishName: 'Al-Ghashiyah', numberOfAyahs: 26 },
  { number: 89, name: 'الفجر', englishName: 'Al-Fajr', numberOfAyahs: 30 },
  { number: 90, name: 'البلد', englishName: 'Al-Balad', numberOfAyahs: 20 },
  { number: 91, name: 'الشمس', englishName: 'Ash-Shams', numberOfAyahs: 15 },
  { number: 92, name: 'الليل', englishName: 'Al-Layl', numberOfAyahs: 21 },
  { number: 93, name: 'الضحى', englishName: 'Ad-Duha', numberOfAyahs: 11 },
  { number: 94, name: 'الشرح', englishName: 'Ash-Sharh', numberOfAyahs: 8 },
  { number: 95, name: 'التين', englishName: 'At-Tin', numberOfAyahs: 8 },
  { number: 96, name: 'العلق', englishName: 'Al-Alaq', numberOfAyahs: 19 },
  { number: 97, name: 'القدر', englishName: 'Al-Qadr', numberOfAyahs: 5 },
  { number: 98, name: 'البينة', englishName: 'Al-Bayyinah', numberOfAyahs: 8 },
  { number: 99, name: 'الزلزلة', englishName: 'Az-Zalzalah', numberOfAyahs: 8 },
  { number: 100, name: 'العاديات', englishName: 'Al-Adiyat', numberOfAyahs: 11 },
  { number: 101, name: 'القارعة', englishName: 'Al-Qari\'ah', numberOfAyahs: 11 },
  { number: 102, name: 'التكاثر', englishName: 'At-Takathur', numberOfAyahs: 8 },
  { number: 103, name: 'العصر', englishName: 'Al-Asr', numberOfAyahs: 3 },
  { number: 104, name: 'الهمزة', englishName: 'Al-Humazah', numberOfAyahs: 9 },
  { number: 105, name: 'الفيل', englishName: 'Al-Fil', numberOfAyahs: 5 },
  { number: 106, name: 'قريش', englishName: 'Quraysh', numberOfAyahs: 4 },
  { number: 107, name: 'الماعون', englishName: 'Al-Ma\'un', numberOfAyahs: 7 },
  { number: 108, name: 'الكوثر', englishName: 'Al-Kawthar', numberOfAyahs: 3 },
  { number: 109, name: 'الكافرون', englishName: 'Al-Kafirun', numberOfAyahs: 6 },
  { number: 110, name: 'النصر', englishName: 'An-Nasr', numberOfAyahs: 3 },
  { number: 111, name: 'المسد', englishName: 'Al-Masad', numberOfAyahs: 5 },
  { number: 112, name: 'الإخلاص', englishName: 'Al-Ikhlas', numberOfAyahs: 4 },
  { number: 113, name: 'الفلق', englishName: 'Al-Falaq', numberOfAyahs: 5 },
  { number: 114, name: 'الناس', englishName: 'An-Nas', numberOfAyahs: 6 },
];

const TOTAL_AYAHS = SURAHS.reduce((sum, s) => sum + s.numberOfAyahs, 0); // 6236 total ayahs

type FilterStatus = 'all' | 'not_started' | 'in_progress' | 'memorized' | 'needs_revision';

export function HifzTrackerTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedSurah, setSelectedSurah] = useState<Surah | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ayahSlider, setAyahSlider] = useState(0);

  // Fetch progress data
  const { data: progressData = [], isLoading } = useQuery({
    queryKey: ['hifz-progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('quran_hifz_progress')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data as HifzProgress[];
    },
    enabled: !!user?.id,
  });

  // Upsert progress mutation
  const updateProgress = useMutation({
    mutationFn: async ({ surah, memorizedAyahs }: { surah: Surah; memorizedAyahs: number }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const status = memorizedAyahs === 0 ? 'not_started' 
        : memorizedAyahs >= surah.numberOfAyahs ? 'memorized' 
        : 'in_progress';
      
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('quran_hifz_progress')
        .upsert({
          user_id: user.id,
          surah_number: surah.number,
          surah_name: surah.englishName,
          surah_name_arabic: surah.name,
          total_ayahs: surah.numberOfAyahs,
          memorized_ayahs: memorizedAyahs,
          status,
          started_at: memorizedAyahs > 0 ? now : null,
          completed_at: status === 'memorized' ? now : null,
          last_revised_at: memorizedAyahs > 0 ? now : null,
        }, { onConflict: 'user_id,surah_number' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hifz-progress'] });
      toast.success('Progress updated');
      setDialogOpen(false);
    },
    onError: () => toast.error('Failed to update progress'),
  });

  // Mark as revised mutation
  const markRevised = useMutation({
    mutationFn: async (surahNumber: number) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('quran_hifz_progress')
        .update({ 
          last_revised_at: new Date().toISOString(),
          status: 'memorized'
        })
        .eq('user_id', user.id)
        .eq('surah_number', surahNumber);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hifz-progress'] });
      toast.success('Marked as revised');
    },
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const memorizedAyahs = progressData.reduce((sum, p) => sum + p.memorized_ayahs, 0);
    const memorizedSurahs = progressData.filter(p => p.status === 'memorized').length;
    const inProgress = progressData.filter(p => p.status === 'in_progress').length;
    const needsRevision = progressData.filter(p => {
      if (p.status !== 'memorized' || !p.last_revised_at) return false;
      const daysSinceRevision = (Date.now() - new Date(p.last_revised_at).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceRevision > 7; // Needs revision if more than 7 days
    }).length;
    
    return {
      memorizedAyahs,
      memorizedSurahs,
      inProgress,
      needsRevision,
      totalPercentage: ((memorizedAyahs / TOTAL_AYAHS) * 100).toFixed(1),
    };
  }, [progressData]);

  // Get progress for a surah
  const getProgress = (surahNumber: number): HifzProgress | undefined => {
    return progressData.find(p => p.surah_number === surahNumber);
  };

  // Filter and search surahs
  const filteredSurahs = useMemo(() => {
    return SURAHS.filter(surah => {
      const matchesSearch = searchQuery === '' ||
        surah.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        surah.name.includes(searchQuery) ||
        surah.number.toString() === searchQuery;
      
      if (filterStatus === 'all') return matchesSearch;
      
      const progress = getProgress(surah.number);
      if (filterStatus === 'not_started') return matchesSearch && !progress;
      if (filterStatus === 'needs_revision') {
        if (!progress || progress.status !== 'memorized' || !progress.last_revised_at) return false;
        const daysSinceRevision = (Date.now() - new Date(progress.last_revised_at).getTime()) / (1000 * 60 * 60 * 24);
        return matchesSearch && daysSinceRevision > 7;
      }
      return matchesSearch && progress?.status === filterStatus;
    });
  }, [searchQuery, filterStatus, progressData]);

  const getStatusBadge = (surah: Surah) => {
    const progress = getProgress(surah.number);
    if (!progress) return <Badge variant="outline" className="text-xs">Not Started</Badge>;
    
    if (progress.status === 'memorized') {
      const daysSinceRevision = progress.last_revised_at 
        ? (Date.now() - new Date(progress.last_revised_at).getTime()) / (1000 * 60 * 60 * 24)
        : 999;
      
      if (daysSinceRevision > 7) {
        return <Badge variant="destructive" className="text-xs gap-1"><AlertCircle className="w-3 h-3" />Revise</Badge>;
      }
      return <Badge className="text-xs bg-emerald-500 gap-1"><Check className="w-3 h-3" />Memorized</Badge>;
    }
    
    if (progress.status === 'in_progress') {
      return <Badge variant="secondary" className="text-xs gap-1"><Play className="w-3 h-3" />{progress.memorized_ayahs}/{progress.total_ayahs}</Badge>;
    }
    
    return <Badge variant="outline" className="text-xs">Not Started</Badge>;
  };

  const openSurahDialog = (surah: Surah) => {
    setSelectedSurah(surah);
    const progress = getProgress(surah.number);
    setAyahSlider(progress?.memorized_ayahs || 0);
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Statistics */}
      <div className="p-4 border-b border-border space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 text-center bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
            <Trophy className="w-6 h-6 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold text-emerald-600">{stats.memorizedSurahs}/114</p>
            <p className="text-xs text-muted-foreground">Surahs Memorized</p>
          </Card>
          <Card className="p-4 text-center bg-gradient-to-br from-primary/20 to-primary/10">
            <Target className="w-6 h-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-primary">{stats.totalPercentage}%</p>
            <p className="text-xs text-muted-foreground">{stats.memorizedAyahs.toLocaleString()} Ayahs</p>
          </Card>
        </div>

        <div className="flex gap-2">
          <Card className="flex-1 p-3 text-center">
            <p className="text-lg font-semibold text-amber-600">{stats.inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </Card>
          <Card className="flex-1 p-3 text-center">
            <p className="text-lg font-semibold text-rose-600">{stats.needsRevision}</p>
            <p className="text-xs text-muted-foreground">Need Revision</p>
          </Card>
        </div>

        <Progress value={parseFloat(stats.totalPercentage)} className="h-2" />
      </div>

      {/* Search and Filter */}
      <div className="p-4 space-y-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search surahs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'in_progress', 'memorized', 'needs_revision', 'not_started'] as FilterStatus[]).map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? "default" : "outline"}
              size="sm"
              className="whitespace-nowrap"
              onClick={() => setFilterStatus(status)}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </Button>
          ))}
        </div>
      </div>

      {/* Surah List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {filteredSurahs.map((surah) => {
            const progress = getProgress(surah.number);
            const percentage = progress ? (progress.memorized_ayahs / progress.total_ayahs) * 100 : 0;
            
            return (
              <Card
                key={surah.number}
                className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openSurahDialog(surah)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary">
                    {surah.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">{surah.englishName}</p>
                      {getStatusBadge(surah)}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-arabic text-muted-foreground">{surah.name}</p>
                      <p className="text-xs text-muted-foreground">{surah.numberOfAyahs} ayahs</p>
                    </div>
                    {percentage > 0 && percentage < 100 && (
                      <Progress value={percentage} className="h-1 mt-1" />
                    )}
                  </div>
                </div>
                {progress?.last_revised_at && progress.status === 'memorized' && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Last revised {formatDistanceToNow(new Date(progress.last_revised_at), { addSuffix: true })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                {selectedSurah?.number}
              </span>
              {selectedSurah?.englishName}
              <span className="font-arabic text-muted-foreground">{selectedSurah?.name}</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedSurah && (
            <div className="space-y-6 pt-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Ayahs Memorized</span>
                  <span className="text-sm font-bold">{ayahSlider} / {selectedSurah.numberOfAyahs}</span>
                </div>
                <Slider
                  value={[ayahSlider]}
                  onValueChange={([v]) => setAyahSlider(v)}
                  max={selectedSurah.numberOfAyahs}
                  step={1}
                  className="mb-2"
                />
                <Progress value={(ayahSlider / selectedSurah.numberOfAyahs) * 100} className="h-2" />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setAyahSlider(0)}
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reset
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setAyahSlider(selectedSurah.numberOfAyahs)}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Complete
                </Button>
              </div>

              <Button
                className="w-full"
                onClick={() => updateProgress.mutate({ surah: selectedSurah, memorizedAyahs: ayahSlider })}
                disabled={updateProgress.isPending}
              >
                Save Progress
              </Button>

              {getProgress(selectedSurah.number)?.status === 'memorized' && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    markRevised.mutate(selectedSurah.number);
                    setDialogOpen(false);
                  }}
                >
                  <Calendar className="w-4 h-4 mr-1" />
                  Mark as Revised Today
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

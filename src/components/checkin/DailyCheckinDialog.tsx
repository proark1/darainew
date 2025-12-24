import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useDailyCheckins } from '@/hooks/useDailyCheckins';
import { useGamification, XP_VALUES } from '@/hooks/useGamification';
import { Sun, Moon, Battery, BatteryLow, BatteryMedium, BatteryFull, Check } from 'lucide-react';

interface DailyCheckinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'morning' | 'evening';
}

const MOODS = [
  { emoji: '😊', label: 'Great' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😔', label: 'Low' },
  { emoji: '😤', label: 'Frustrated' },
  { emoji: '😰', label: 'Anxious' },
];

const SYMPTOMS = [
  'Headache',
  'Fatigue',
  'Anxiety',
  'Brain fog',
  'Restless',
  'None'
];

export function DailyCheckinDialog({ open, onOpenChange, type }: DailyCheckinDialogProps) {
  const { saveCheckin } = useDailyCheckins();
  const { addXP } = useGamification();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  
  // Morning states
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(3);
  const [energyLevel, setEnergyLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [mood, setMood] = useState('😊');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mainFocus, setMainFocus] = useState('');
  
  // Evening states
  const [dayRating, setDayRating] = useState(3);
  const [focusCompleted, setFocusCompleted] = useState<boolean | null>(null);
  const [wentWell, setWentWell] = useState('');
  const [challenges, setChallenges] = useState('');
  const [tomorrowPriority, setTomorrowPriority] = useState('');

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    const data = type === 'morning' 
      ? {
          sleep_hours: sleepHours,
          sleep_quality: sleepQuality,
          energy_level: energyLevel,
          mood,
          physical_symptoms: symptoms.filter(s => s !== 'None'),
          main_focus: mainFocus
        }
      : {
          day_rating: dayRating,
          focus_completed: focusCompleted,
          went_well: wentWell,
          challenges,
          tomorrow_priority: tomorrowPriority
        };

    const result = await saveCheckin(type, data);
    
    if (result) {
      await addXP(XP_VALUES.DAILY_CHECKIN, `${type} check-in`);
      setCompleted(true);
      setTimeout(() => {
        onOpenChange(false);
        setCompleted(false);
        setStep(1);
      }, 2000);
    }
    
    setIsSubmitting(false);
  };

  const toggleSymptom = (symptom: string) => {
    if (symptom === 'None') {
      setSymptoms(['None']);
    } else {
      setSymptoms(prev => {
        const filtered = prev.filter(s => s !== 'None');
        if (filtered.includes(symptom)) {
          return filtered.filter(s => s !== symptom);
        }
        return [...filtered, symptom];
      });
    }
  };

  const totalSteps = type === 'morning' ? 4 : 3;

  if (completed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-in zoom-in">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Check-in Complete!</h3>
            <p className="text-muted-foreground text-center">
              +{XP_VALUES.DAILY_CHECKIN} XP earned
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'morning' ? (
              <>
                <Sun className="w-5 h-5 text-amber-500" />
                Good Morning!
              </>
            ) : (
              <>
                <Moon className="w-5 h-5 text-indigo-400" />
                Evening Reflection
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Step {step} of {totalSteps}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {type === 'morning' && step === 1 && (
            <div className="space-y-4">
              <Label>How many hours did you sleep?</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[sleepHours]}
                  onValueChange={([v]) => setSleepHours(v)}
                  min={0}
                  max={12}
                  step={0.5}
                  className="flex-1"
                />
                <span className="text-2xl font-bold w-16 text-right">{sleepHours}h</span>
              </div>
              
              <Label className="mt-6 block">Sleep quality</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(q => (
                  <button
                    key={q}
                    onClick={() => setSleepQuality(q)}
                    className={cn(
                      "flex-1 py-3 rounded-lg border transition-all",
                      sleepQuality === q 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "hover:border-primary/50"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center">1 = Poor, 5 = Excellent</p>
            </div>
          )}

          {type === 'morning' && step === 2 && (
            <div className="space-y-4">
              <Label>How's your energy right now?</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { level: 'low' as const, icon: BatteryLow, label: 'Low', color: 'text-red-500' },
                  { level: 'medium' as const, icon: BatteryMedium, label: 'Medium', color: 'text-amber-500' },
                  { level: 'high' as const, icon: BatteryFull, label: 'High', color: 'text-green-500' },
                ].map(({ level, icon: Icon, label, color }) => (
                  <button
                    key={level}
                    onClick={() => setEnergyLevel(level)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 rounded-lg border transition-all",
                      energyLevel === level 
                        ? "bg-primary/10 border-primary" 
                        : "hover:border-primary/50"
                    )}
                  >
                    <Icon className={cn("w-8 h-8", color)} />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>

              <Label className="mt-6 block">How are you feeling?</Label>
              <div className="grid grid-cols-3 gap-2">
                {MOODS.map(({ emoji, label }) => (
                  <button
                    key={emoji}
                    onClick={() => setMood(emoji)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all",
                      mood === emoji 
                        ? "bg-primary/10 border-primary" 
                        : "hover:border-primary/50"
                    )}
                  >
                    <span className="text-2xl">{emoji}</span>
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === 'morning' && step === 3 && (
            <div className="space-y-4">
              <Label>Any physical symptoms?</Label>
              <div className="flex flex-wrap gap-2">
                {SYMPTOMS.map(symptom => (
                  <button
                    key={symptom}
                    onClick={() => toggleSymptom(symptom)}
                    className={cn(
                      "px-3 py-2 rounded-full border text-sm transition-all",
                      symptoms.includes(symptom)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:border-primary/50"
                    )}
                  >
                    {symptom}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === 'morning' && step === 4 && (
            <div className="space-y-4">
              <Label>What's your ONE main focus for today?</Label>
              <Textarea
                value={mainFocus}
                onChange={(e) => setMainFocus(e.target.value)}
                placeholder="The most important thing I want to accomplish..."
                className="resize-none"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Keep it simple. One clear goal is better than many vague ones.
              </p>
            </div>
          )}

          {type === 'evening' && step === 1 && (
            <div className="space-y-4">
              <Label>How would you rate your day?</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(r => (
                  <button
                    key={r}
                    onClick={() => setDayRating(r)}
                    className={cn(
                      "flex-1 py-4 rounded-lg border transition-all text-xl",
                      dayRating === r 
                        ? "bg-primary text-primary-foreground border-primary" 
                        : "hover:border-primary/50"
                    )}
                  >
                    {r === 1 ? '😔' : r === 2 ? '😕' : r === 3 ? '😐' : r === 4 ? '🙂' : '😊'}
                  </button>
                ))}
              </div>
              
              <Label className="mt-6 block">Did you complete your main focus?</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setFocusCompleted(true)}
                  className={cn(
                    "py-4 rounded-lg border transition-all",
                    focusCompleted === true 
                      ? "bg-green-500/20 border-green-500 text-green-600" 
                      : "hover:border-green-500/50"
                  )}
                >
                  ✓ Yes!
                </button>
                <button
                  onClick={() => setFocusCompleted(false)}
                  className={cn(
                    "py-4 rounded-lg border transition-all",
                    focusCompleted === false 
                      ? "bg-amber-500/20 border-amber-500 text-amber-600" 
                      : "hover:border-amber-500/50"
                  )}
                >
                  Not quite
                </button>
              </div>
            </div>
          )}

          {type === 'evening' && step === 2 && (
            <div className="space-y-4">
              <Label>What went well today?</Label>
              <Textarea
                value={wentWell}
                onChange={(e) => setWentWell(e.target.value)}
                placeholder="Small wins count too..."
                className="resize-none"
                rows={2}
              />
              
              <Label>What was challenging?</Label>
              <Textarea
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
                placeholder="No judgment, just reflection..."
                className="resize-none"
                rows={2}
              />
            </div>
          )}

          {type === 'evening' && step === 3 && (
            <div className="space-y-4">
              <Label>What's your priority for tomorrow?</Label>
              <Textarea
                value={tomorrowPriority}
                onChange={(e) => setTomorrowPriority(e.target.value)}
                placeholder="Set yourself up for success..."
                className="resize-none"
                rows={3}
              />
            </div>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-4">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i + 1 === step ? "bg-primary w-6" : i + 1 < step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              className="flex-1"
            >
              Back
            </Button>
          )}
          {step < totalSteps ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              className="flex-1"
            >
              Next
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? 'Saving...' : 'Complete'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

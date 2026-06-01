import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { Plus, X, Save, Wand2, Clock, Languages } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ALL_PLATFORMS, DEFAULT_CREATOR_PROFILE, IDEA_SOURCE_META, FORMAT_META, computeIdeaSplit, platformLabel,
  type CreatorProfile, type Platform, type IdeaSource, type DefaultFormat,
} from '@/lib/content';
import type { CreatorProfileDraft } from '@/hooks/useCreatorProfile';

const TONE_SUGGESTIONS = ['energetic', 'no-fluff', 'contrarian', 'friendly', 'expert', 'story-driven', 'motivational', 'calm'];
const CHANNELS = [{ key: 'push', label: 'Push' }, { key: 'telegram', label: 'Telegram' }];

function toTimeInput(value: string): string {
  return (value || '08:00').slice(0, 5);
}

function TagInput({
  label, placeholder, values, onChange, suggestions,
}: {
  label: string; placeholder: string; values: string[]; onChange: (next: string[]) => void; suggestions?: string[];
}) {
  const [input, setInput] = useState('');
  const add = (raw: string) => {
    const t = raw.trim();
    if (!t || values.includes(t)) { setInput(''); return; }
    onChange([...values, t]);
    setInput('');
  };
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {values.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pr-1">
            {t}
            <Button variant="ghost" size="icon" className="h-4 w-4 hover:bg-transparent" onClick={() => onChange(values.filter((x) => x !== t))}>
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
        {values.length === 0 && <span className="text-xs text-muted-foreground">None yet</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(input); } }}
        />
        <Button type="button" variant="outline" size="icon" onClick={() => add(input)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {suggestions && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.filter((s) => !values.includes(s)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="h-7 px-2.5 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  profile: CreatorProfile | null;
  saving: boolean;
  onSave: (values: CreatorProfileDraft) => void;
  onPrefill: () => Promise<CreatorProfileDraft>;
}

export function CreatorProfileForm({ profile, saving, onSave, onPrefill }: Props) {
  const [form, setForm] = useState<CreatorProfileDraft>(DEFAULT_CREATOR_PROFILE);

  // Seed the form from the saved profile (or defaults) whenever the underlying
  // profile identity changes.
  useEffect(() => {
    if (profile) {
      setForm({
        persona: profile.persona ?? '',
        tone: profile.tone ?? [],
        topics: profile.topics ?? [],
        audience: profile.audience ?? '',
        business_context: profile.business_context ?? '',
        default_cta: profile.default_cta ?? '',
        platforms: (profile.platforms ?? ['youtube', 'instagram', 'tiktok']) as Platform[],
        primary_language: profile.primary_language ?? 'en',
        ideas_per_day: profile.ideas_per_day ?? 10,
        trending_ratio: profile.trending_ratio ?? 0.5,
        idea_source: profile.idea_source ?? 'mixed',
        default_format: profile.default_format ?? 'both',
        short_seconds: profile.short_seconds ?? 30,
        long_minutes: profile.long_minutes ?? 6,
        enabled: profile.enabled ?? true,
        deliver_at: profile.deliver_at ?? '08:00',
        channels: profile.channels ?? ['push', 'telegram'],
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const set = <K extends keyof CreatorProfileDraft>(key: K, value: CreatorProfileDraft[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const togglePlatform = (p: Platform) =>
    set('platforms', form.platforms.includes(p) ? form.platforms.filter((x) => x !== p) : [...form.platforms, p]);

  const toggleChannel = (c: string) =>
    set('channels', form.channels.includes(c) ? form.channels.filter((x) => x !== c) : [...form.channels, c]);

  const handlePrefill = async () => {
    const draft = await onPrefill();
    setForm((f) => ({
      ...f,
      persona: f.persona || draft.persona,
      topics: f.topics.length ? f.topics : draft.topics,
      business_context: f.business_context || draft.business_context,
    }));
  };

  const split = computeIdeaSplit(form.ideas_per_day, form.trending_ratio);
  const { language } = useLanguage();
  const languageLabel = language === 'de' ? 'Deutsch' : 'English';

  return (
    <div className="space-y-5 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Your creator profile</CardTitle>
              <CardDescription>
                This is the brain behind your daily ideas. The more specific, the better the ideas.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={handlePrefill}>
              <Wand2 className="h-4 w-4" /> Prefill from my profile
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm">Your personality &amp; story</Label>
            <Textarea
              value={form.persona}
              onChange={(e) => set('persona', e.target.value)}
              placeholder="Who are you, what do you do, what's your angle and tone? e.g. 'I'm a bootstrapped founder who shares blunt, tactical lessons from building a SaaS to $20k MRR.'"
              className="min-h-[100px]"
            />
          </div>

          <TagInput label="Voice / tone" placeholder="Add a tone word" values={form.tone} onChange={(v) => set('tone', v)} suggestions={TONE_SUGGESTIONS} />
          <TagInput label="Topics I want to talk about" placeholder="e.g. startups, bootstrapping, marketing" values={form.topics} onChange={(v) => set('topics', v)} />

          <div className="space-y-2">
            <Label className="text-sm">Target audience</Label>
            <Input value={form.audience} onChange={(e) => set('audience', e.target.value)} placeholder="e.g. early-stage founders and indie hackers" />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">What your business does</Label>
            <Textarea value={form.business_context} onChange={(e) => set('business_context', e.target.value)} placeholder="What you sell / build, so ideas can tie back to it." className="min-h-[70px]" />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Default call-to-action</Label>
            <Input value={form.default_cta} onChange={(e) => set('default_cta', e.target.value)} placeholder="e.g. Follow for daily founder lessons" />
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <Label className="text-sm flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" /> Content language</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Ideas and scripts are written in <span className="font-medium text-foreground">{languageLabel}</span> — this follows your app language (change it in Settings → Language).
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Platforms</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlatform(p)}
                  className={cn(
                    'h-8 px-3 rounded-md border text-xs font-medium transition-colors',
                    form.platforms.includes(p) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {platformLabel(p)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily ideas</CardTitle>
          <CardDescription>How many ideas, the trending/evergreen mix, and when they arrive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Ideas per day</Label>
              <span className="text-sm font-medium">{form.ideas_per_day}</span>
            </div>
            <Slider value={[form.ideas_per_day]} min={1} max={20} step={1} onValueChange={([v]) => set('ideas_per_day', v)} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Where ideas come from</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['mixed', 'trending', 'knowledge'] as IdeaSource[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('idea_source', s)}
                  className={cn(
                    'rounded-md border px-2 py-2 text-xs font-medium transition-colors text-center',
                    form.idea_source === s ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {IDEA_SOURCE_META[s].emoji} {IDEA_SOURCE_META[s].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{IDEA_SOURCE_META[form.idea_source].description}</p>
          </div>

          {form.idea_source === 'mixed' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Trending vs evergreen</Label>
                <span className="text-sm font-medium">🔥 {split.current} · ♻️ {split.evergreen}</span>
              </div>
              <Slider value={[Math.round(form.trending_ratio * 100)]} min={0} max={100} step={10} onValueChange={([v]) => set('trending_ratio', v / 100)} />
              <p className="text-xs text-muted-foreground">
                {Math.round(form.trending_ratio * 100)}% tied to what's happening now, the rest evergreen.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm">Default scripts</Label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['short', 'long', 'both'] as DefaultFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set('default_format', f)}
                  className={cn(
                    'rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                    form.default_format === f ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  {FORMAT_META[f].label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Short length</Label>
                <span className="text-sm font-medium">{form.short_seconds}s</span>
              </div>
              <Slider value={[form.short_seconds]} min={15} max={90} step={5} onValueChange={([v]) => set('short_seconds', v)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Long length</Label>
                <span className="text-sm font-medium">{form.long_minutes} min</span>
              </div>
              <Slider value={[form.long_minutes]} min={3} max={20} step={1} onValueChange={([v]) => set('long_minutes', v)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Auto-generate every morning</Label>
              <p className="text-xs text-muted-foreground">We'll create your ideas and notify you.</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => set('enabled', v)} />
          </div>

          {form.enabled && (
            <>
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Delivery time (your local time)</Label>
                <Input type="time" step={900} value={toTimeInput(form.deliver_at)} onChange={(e) => set('deliver_at', e.target.value)} className="w-36" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Notify me via</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CHANNELS.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleChannel(key)}
                      className={cn(
                        'h-8 px-3 rounded-md border text-xs font-medium transition-colors',
                        form.channels.includes(key) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {form.channels.includes('telegram') && (
                  <p className="text-xs text-muted-foreground">Telegram delivery requires your account to be linked in Settings → Telegram.</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-3 pb-1">
        <Button className="w-full gap-2" onClick={() => onSave(form)} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </div>
  );
}

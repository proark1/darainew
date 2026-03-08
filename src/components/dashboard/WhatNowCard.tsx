import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play, RefreshCw, Clock, Zap, Lightbulb, ChevronDown, Target } from 'lucide-react';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SmartSuggestion, TaskSuggestion } from '@/hooks/useSmartTaskSuggestions';
import { cn } from '@/lib/utils';

interface WhatNowCardProps {
  suggestion: SmartSuggestion | null;
  loading: boolean;
  onRefresh: () => void;
  onStartTask: (taskId: string | null, title: string) => void;
}

const energyConfig = {
  low: { label: 'Low energy', className: 'bg-accent text-accent-foreground' },
  medium: { label: 'Medium energy', className: 'bg-secondary text-secondary-foreground' },
  high: { label: 'High energy', className: 'bg-primary/15 text-primary' },
};

function SuggestionSkeleton() {
  return (
    <div className="space-y-3 py-1">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}

function AlternativeItem({ alt, onStart }: { alt: TaskSuggestion; onStart: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onStart}
      className="w-full text-left p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors group"
    >
      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
        {alt.title}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{alt.reason}</p>
    </motion.button>
  );
}

export function WhatNowCard({ suggestion, loading, onRefresh, onStartTask }: WhatNowCardProps) {
  const [altOpen, setAltOpen] = useState(false);

  const rec = suggestion?.recommendation;
  const energy = rec ? energyConfig[rec.energy] : null;

  return (
    <GlassCard variant="gradient" className="overflow-hidden">
      <GlassCardContent className="p-4 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">What should I do now?</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Loading */}
        {loading && !rec && <SuggestionSkeleton />}

        {/* Empty */}
        {!loading && !rec && (
          <EmptyState
            icon={Target}
            title="All caught up!"
            description="No pending tasks right now. Enjoy the moment."
            className="py-6"
          />
        )}

        {/* Recommendation */}
        <AnimatePresence mode="wait">
          {rec && (
            <motion.div
              key={rec.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {/* Task title */}
              <p className="text-base font-semibold text-foreground leading-snug">
                🎯 {rec.title}
              </p>

              {/* Reason */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {rec.reason}
              </p>

              {/* Meta badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Clock className="w-3 h-3" />
                  ~{rec.estimatedMinutes} min
                </Badge>
                {energy && (
                  <Badge className={cn("gap-1 text-xs border-0", energy.className)}>
                    <Zap className="w-3 h-3" />
                    {energy.label}
                  </Badge>
                )}
              </div>

              {/* Start tip */}
              {rec.startTip && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-accent/50 border border-border/30">
                  <Lightbulb className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">{rec.startTip}</p>
                </div>
              )}

              {/* Start CTA */}
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => onStartTask(rec.taskId, rec.title)}
              >
                <Play className="w-3.5 h-3.5" />
                Start Now
              </Button>

              {/* Alternatives */}
              {suggestion.alternatives.length > 0 && (
                <Collapsible open={altOpen} onOpenChange={setAltOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1">
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", altOpen && "rotate-180")} />
                    Something else?
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 mt-2">
                      {suggestion.alternatives.map((alt, i) => (
                        <AlternativeItem
                          key={i}
                          alt={alt}
                          onStart={() => onStartTask(alt.taskId, alt.title)}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Encouragement */}
              {suggestion.encouragement && (
                <p className="text-xs text-muted-foreground pt-1">
                  💪 {suggestion.encouragement}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCardContent>
    </GlassCard>
  );
}

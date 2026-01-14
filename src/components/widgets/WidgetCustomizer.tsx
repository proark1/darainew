import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Widget } from '@/hooks/useWidgetLayout';
import { Settings2, GripVertical, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetCustomizerProps {
  widgets: Widget[];
  onToggle: (widgetId: string) => void;
  onReset: () => void;
}

const WIDGET_ICONS: Record<Widget['type'], string> = {
  weather: '🌤️',
  prayer_times: '🕌',
  tasks_today: '✅',
  streak: '🔥',
  quick_add: '➕',
  upcoming_events: '📅',
  focus_stats: '🎯',
  ai_suggestion: '✨',
  week_glance: '📊',
};

const WIDGET_DESCRIPTIONS: Record<Widget['type'], string> = {
  weather: 'Current weather conditions',
  prayer_times: 'Islamic prayer times',
  tasks_today: 'Tasks due today',
  streak: 'Your current streak',
  quick_add: 'Quickly add new items',
  upcoming_events: 'Next 24h events',
  focus_stats: 'Focus session stats',
  ai_suggestion: 'AI task recommendations',
  week_glance: 'Week overview',
};

export function WidgetCustomizer({ widgets, onToggle, onReset }: WidgetCustomizerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Settings2 className="w-4 h-4" />
          Customize
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Customize Widgets
            <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-4">
            {widgets.map(widget => (
              <div 
                key={widget.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                  widget.enabled ? "bg-muted/50" : "bg-transparent opacity-60"
                )}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                <span className="text-xl">{WIDGET_ICONS[widget.type]}</span>
                <div className="flex-1 min-w-0">
                  <Label htmlFor={widget.id} className="font-medium cursor-pointer">
                    {widget.title}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {WIDGET_DESCRIPTIONS[widget.type]}
                  </p>
                </div>
                <Switch 
                  id={widget.id}
                  checked={widget.enabled}
                  onCheckedChange={() => onToggle(widget.id)}
                />
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

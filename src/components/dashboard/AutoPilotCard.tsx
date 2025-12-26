import { useAutoPilot } from '@/hooks/useAutoPilot';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Zap, 
  Check, 
  X, 
  Calendar, 
  Split, 
  ShoppingCart, 
  MessageSquare,
  Coffee,
  RefreshCw,
  Sparkles,
  CheckCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTION_ICONS: Record<string, typeof Zap> = {
  reschedule_task: Calendar,
  suggest_breakdown: Split,
  create_shopping_list: ShoppingCart,
  create_followup: MessageSquare,
  suggest_break: Coffee,
};

const ACTION_LABELS: Record<string, string> = {
  reschedule_task: 'Reschedule',
  suggest_breakdown: 'Break Down',
  create_shopping_list: 'Shopping List',
  create_followup: 'Follow-up',
  suggest_break: 'Take Break',
};

export function AutoPilotCard() {
  const { 
    actions, 
    loading, 
    running, 
    runAutoPilot, 
    approveAction, 
    rejectAction,
    approveAll 
  } = useAutoPilot();

  if (loading) {
    return (
      <Card className="glass-panel-solid">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-primary" />
            Auto-Pilot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-panel-solid">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-primary" />
            Auto-Pilot
            {actions.length > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                {actions.length}
              </Badge>
            )}
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => runAutoPilot()}
            disabled={running}
          >
            <RefreshCw className={cn("w-4 h-4", running && "animate-spin")} />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          AI-suggested actions to optimize your day
        </p>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <div className="text-center py-4">
            <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-3">
              No pending actions
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => runAutoPilot()}
              disabled={running}
            >
              {running ? 'Scanning...' : 'Scan for Actions'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Approve All Button */}
            {actions.length > 1 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => approveAll()}
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Approve All ({actions.length})
              </Button>
            )}
            
            {actions.map((action) => {
              const Icon = ACTION_ICONS[action.actionType] || Zap;
              const label = ACTION_LABELS[action.actionType] || action.actionType;
              
              return (
                <div
                  key={action.id}
                  className="p-3 rounded-lg bg-muted/50 border border-border/50"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-primary/10 shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {label}
                        </Badge>
                      </div>
                      <p className="text-sm">{action.reason}</p>
                      
                      {/* Action-specific details */}
                      {action.actionType === 'reschedule_task' && action.actionData && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="line-through">{action.actionData.currentDueDate as string}</span>
                          {' → '}
                          <span className="text-primary font-medium">{action.actionData.suggestedDueDate as string}</span>
                        </div>
                      )}
                      
                      {action.actionType === 'create_shopping_list' && action.actionData && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          {(action.actionData.items as string[])?.slice(0, 3).join(', ')}
                          {(action.actionData.items as string[])?.length > 3 && '...'}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                        onClick={() => approveAction(action.id)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => rejectAction(action.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

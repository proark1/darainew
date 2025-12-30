import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useProactiveReminders } from '@/hooks/useProactiveReminders';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export function DoriNotificationIcon() {
  const { reminders, unreadCount, markAsRead, dismissReminder } = useProactiveReminders();
  const [open, setOpen] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && reminders.length > 0) {
      // Mark first few as read when opening
      reminders.slice(0, 3).forEach(r => {
        if (!r.read_at) markAsRead(r.id);
      });
    }
  };

  const handleDismiss = (e: React.MouseEvent, reminderId: string) => {
    e.stopPropagation();
    dismissReminder(reminderId);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
        >
          <motion.div
            animate={unreadCount > 0 ? {
              scale: [1, 1.15, 1],
            } : {}}
            transition={{
              repeat: unreadCount > 0 ? Infinity : 0,
              duration: 2,
              repeatDelay: 4,
            }}
          >
            <Sparkles className={cn(
              "w-5 h-5 transition-colors",
              unreadCount > 0 ? "text-primary" : "text-muted-foreground"
            )} />
          </motion.div>
          
          {/* Unread badge */}
          {unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.div>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Dori has something to say</span>
          </div>
        </div>
        
        <ScrollArea className="max-h-72">
          <CardContent className="p-2 space-y-2">
            {reminders.slice(0, 5).map((reminder) => (
              <motion.div
                key={reminder.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "p-3 rounded-lg transition-colors",
                  reminder.read_at ? "bg-muted/30" : "bg-primary/10 border border-primary/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{reminder.title}</span>
                      {reminder.priority === 'urgent' && (
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                          Urgent
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {reminder.message}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {format(new Date(reminder.scheduled_for), 'h:mm a')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => handleDismiss(e, reminder.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </motion.div>
            ))}
            {reminders.length === 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No messages from Dori
              </div>
            )}
          </CardContent>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

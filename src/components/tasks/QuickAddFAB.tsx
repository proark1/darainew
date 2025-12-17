import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Sparkles, Calendar, Flag } from 'lucide-react';
import { parseTaskInput } from '@/lib/taskParser';
import { Task } from '@/types/flux';
import { format } from 'date-fns';

interface QuickAddFABProps {
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
}

export function QuickAddFAB({ onAddTask }: QuickAddFABProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const parsedTask = input.trim() ? parseTaskInput(input) : null;

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard shortcut to open (Ctrl/Cmd + Shift + A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setInput('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedTask || !parsedTask.title) return;

    onAddTask({
      title: parsedTask.title,
      priority: parsedTask.priority,
      category: parsedTask.category,
      completed: false,
      dueDate: parsedTask.dueDate,
      sortOrder: 0,
    });

    setInput('');
    setIsOpen(false);
  };

  const priorityColors = {
    high: 'text-destructive',
    medium: 'text-warning',
    low: 'text-muted-foreground',
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40"
          onClick={() => {
            setIsOpen(false);
            setInput('');
          }}
        />
      )}

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-50">
        {isOpen ? (
          <div className="animate-scale-in w-80 glass-panel-solid p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="w-4 h-4 text-primary" />
                Quick Add
              </div>
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => {
                  setIsOpen(false);
                  setInput('');
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit}>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Try "Call mom tomorrow at 3pm"'
                className="mb-3"
              />

              {/* Preview parsed result */}
              {parsedTask && parsedTask.title && (
                <div className="text-xs space-y-1.5 mb-3 p-2 bg-muted/50 rounded-lg">
                  <div className="font-medium text-foreground truncate">
                    {parsedTask.title}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {parsedTask.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(parsedTask.dueDate, 'MMM d, h:mm a')}
                      </span>
                    )}
                    <span className={cn("flex items-center gap-1", priorityColors[parsedTask.priority])}>
                      <Flag className="w-3 h-3" />
                      {parsedTask.priority}
                    </span>
                    <span className="capitalize">{parsedTask.category}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  ⌘⇧A to open
                </span>
                <Button 
                  type="submit" 
                  size="sm"
                  disabled={!parsedTask?.title}
                >
                  Add Task
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg glow-primary hover:scale-110 transition-transform"
            onClick={() => setIsOpen(true)}
          >
            <Plus className="w-6 h-6" />
          </Button>
        )}
      </div>
    </>
  );
}

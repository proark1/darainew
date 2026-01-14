import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useQuickVoiceCapture } from '@/hooks/useQuickVoiceCapture';
import { Task } from '@/types/flux';
import { 
  Mic, 
  MicOff, 
  Loader2, 
  CheckCircle2, 
  Calendar, 
  StickyNote, 
  Bell,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickVoiceCaptureButtonProps {
  onCreateTask?: (task: Partial<Task>) => void;
  onCreateNote?: (content: string) => void;
  className?: string;
  variant?: 'fab' | 'inline';
}

export function QuickVoiceCaptureButton({ 
  onCreateTask, 
  onCreateNote,
  className,
  variant = 'fab'
}: QuickVoiceCaptureButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { 
    isRecording, 
    isProcessing, 
    transcript, 
    result, 
    startRecording, 
    stopRecording, 
    clearResult 
  } = useQuickVoiceCapture();

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setDialogOpen(true);
      startRecording();
    }
  };

  const handleConfirm = () => {
    if (!result) return;

    if (result.type === 'task' && onCreateTask) {
      onCreateTask({
        title: result.title,
        category: result.category,
        priority: result.priority,
        description: result.originalText,
      });
    } else if (result.type === 'note' && onCreateNote) {
      onCreateNote(result.originalText);
    }
    
    clearResult();
    setDialogOpen(false);
  };

  const handleCancel = () => {
    stopRecording();
    clearResult();
    setDialogOpen(false);
  };

  const typeIcons = {
    task: CheckCircle2,
    note: StickyNote,
    event: Calendar,
    reminder: Bell,
  };

  const TypeIcon = result ? typeIcons[result.type] : CheckCircle2;

  if (variant === 'fab') {
    return (
      <>
        <Button
          onClick={handleClick}
          size="lg"
          className={cn(
            "h-14 w-14 rounded-full shadow-lg fixed bottom-24 right-4 z-50",
            isRecording && "bg-destructive hover:bg-destructive/90 animate-pulse",
            className
          )}
        >
          {isRecording ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </Button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                Voice Capture
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Recording State */}
              {isRecording && (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/20 mb-4">
                    <div className="w-12 h-12 rounded-full bg-destructive animate-pulse flex items-center justify-center">
                      <MicOff className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">Listening...</p>
                  {transcript && (
                    <p className="mt-3 p-3 bg-muted rounded-lg text-sm">{transcript}</p>
                  )}
                  <Button 
                    variant="outline" 
                    onClick={stopRecording} 
                    className="mt-4"
                  >
                    Stop Recording
                  </Button>
                </div>
              )}

              {/* Processing State */}
              {isProcessing && !isRecording && (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Processing...</p>
                </div>
              )}

              {/* Result State */}
              {result && !isRecording && !isProcessing && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="w-5 h-5 text-primary" />
                      <Badge variant="outline" className="capitalize">{result.type}</Badge>
                      <Badge variant="secondary" className="capitalize">{result.category}</Badge>
                      <Badge 
                        className={cn(
                          result.priority === 'high' && 'bg-destructive',
                          result.priority === 'medium' && 'bg-warning',
                          result.priority === 'low' && 'bg-muted-foreground'
                        )}
                      >
                        {result.priority}
                      </Badge>
                    </div>
                    <p className="font-medium">{result.title}</p>
                    <p className="text-sm text-muted-foreground italic">"{result.originalText}"</p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleCancel} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={handleConfirm} className="flex-1">
                      <Plus className="w-4 h-4 mr-1" />
                      Create {result.type}
                    </Button>
                  </div>
                </div>
              )}

              {/* Initial State */}
              {!isRecording && !isProcessing && !result && (
                <div className="text-center py-8">
                  <Button onClick={startRecording} size="lg" className="h-16 w-16 rounded-full">
                    <Mic className="w-8 h-8" />
                  </Button>
                  <p className="text-sm text-muted-foreground mt-4">
                    Tap to start speaking
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Inline variant
  return (
    <Button
      onClick={handleClick}
      variant={isRecording ? "destructive" : "outline"}
      size="sm"
      className={cn(isRecording && "animate-pulse", className)}
    >
      {isRecording ? (
        <>
          <MicOff className="w-4 h-4 mr-1" />
          Stop
        </>
      ) : (
        <>
          <Mic className="w-4 h-4 mr-1" />
          Voice
        </>
      )}
    </Button>
  );
}

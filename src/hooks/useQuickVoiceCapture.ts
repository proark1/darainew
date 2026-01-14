import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VoiceCaptureResult {
  type: 'task' | 'note' | 'event' | 'reminder';
  title: string;
  category: 'personal' | 'business' | 'family';
  priority: 'low' | 'medium' | 'high';
  originalText: string;
}

export function useQuickVoiceCapture() {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<VoiceCaptureResult | null>(null);
  
  const recognitionRef = useRef<any>(null);

  const startRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error('Voice recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
      setTranscript('');
      setResult(null);
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const result = event.results[current];
      setTranscript(result[0].transcript);

      if (result.isFinal) {
        processTranscript(result[0].transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      if (event.error !== 'no-speech') {
        toast.error('Could not recognize speech');
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const processTranscript = useCallback(async (text: string) => {
    if (!user || !text.trim()) return;

    setIsProcessing(true);
    try {
      // First, save to brain dumps for backup
      await supabase.from('brain_dumps').insert({
        user_id: user.id,
        content: text,
        is_processed: false,
      });

      // Use AI to categorize
      const response = await supabase.functions.invoke('ai-assistant', {
        body: {
          type: 'categorize_dump',
          content: text,
        },
      });

      if (response.data) {
        setResult({
          type: response.data.suggested_type || 'task',
          title: response.data.ai_summary || text.slice(0, 50),
          category: response.data.suggested_category || 'personal',
          priority: response.data.suggested_priority || 'medium',
          originalText: text,
        });
        toast.success('Voice captured!', {
          description: response.data.ai_summary || text.slice(0, 30),
        });
      }
    } catch (error) {
      console.error('Failed to process transcript:', error);
      // Fallback to basic result
      setResult({
        type: 'task',
        title: text.slice(0, 50),
        category: 'personal',
        priority: 'medium',
        originalText: text,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [user]);

  const clearResult = useCallback(() => {
    setResult(null);
    setTranscript('');
  }, []);

  return {
    isRecording,
    isProcessing,
    transcript,
    result,
    startRecording,
    stopRecording,
    clearResult,
  };
}

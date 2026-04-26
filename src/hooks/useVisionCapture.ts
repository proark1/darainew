import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type VisionKind =
  | 'receipt' | 'business_card' | 'medication' | 'whiteboard'
  | 'label' | 'document' | 'contract' | 'inventory' | 'unknown';

export interface VisionExtractResult {
  capture_id: string;
  detected_kind: VisionKind;
  classification_confidence: number | null;
  extracted: Record<string, unknown>;
  ocr_text: string;
  source_language: string | null;
}

const MAX_BYTES = 10 * 1024 * 1024;

// One hook for the whole vision flow:
//   captureFromFile() — uploads to chat-attachments, calls vision-capture,
//                       returns extracted result for the UI to render.
//   commit()          — confirms (with optional edits) and creates the
//                       downstream entity.
//   discard()         — drops the row; image stays in storage for now.
export function useVisionCapture() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VisionExtractResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const reset = useCallback(() => {
    setResult(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }, [previewUrl]);

  const captureFromFile = useCallback(async (
    file: File,
    opts?: { hintKind?: VisionKind },
  ): Promise<VisionExtractResult | null> => {
    if (!user?.id) return null;
    if (file.size > MAX_BYTES) {
      toast.error('Image larger than 10 MB');
      return null;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('Only image files are supported');
      return null;
    }
    setBusy(true);
    setResult(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      // 1. Upload to chat-attachments under <user>/vision/
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `vision/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const filePath = `${user.id}/${fileName}`;
      const { error: upErr } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`);
        return null;
      }

      // 2. Trigger classification + extraction.
      const { data, error } = await supabase.functions.invoke('vision-capture', {
        body: {
          storage_path: filePath,
          mime_type: file.type,
          size_bytes: file.size,
          hint_kind: opts?.hintKind,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const r = data as VisionExtractResult;
      setResult(r);
      return r;
    } catch (e) {
      toast.error(`Vision failed: ${(e as Error).message}`);
      return null;
    } finally {
      setBusy(false);
    }
  }, [user?.id, previewUrl]);

  const commit = useCallback(async (
    opts?: { kind?: VisionKind; payload?: Record<string, unknown> },
  ): Promise<{ created_entity_kind: string | null; created_entity_id: string | null } | null> => {
    if (!result) return null;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('vision-commit', {
        body: {
          capture_id: result.capture_id,
          kind: opts?.kind,
          payload: opts?.payload ?? result.extracted,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const created = (data as any)?.created_entity_kind;
      toast.success(created ? `Saved as ${humanLabel(created)}` : ((data as any).warning ?? 'Saved'));
      reset();
      return data as any;
    } catch (e) {
      toast.error(`Commit failed: ${(e as Error).message}`);
      return null;
    } finally {
      setBusy(false);
    }
  }, [result, reset]);

  const discard = useCallback(async () => {
    if (!result) { reset(); return; }
    try {
      await (supabase as any)
        .from('vision_captures')
        .update({ status: 'discarded' })
        .eq('id', result.capture_id);
    } catch (e) {
      console.warn('[useVisionCapture] discard failed', (e as Error).message);
    }
    reset();
  }, [result, reset]);

  return {
    busy,
    result,
    previewUrl,
    captureFromFile,
    commit,
    discard,
  };
}

function humanLabel(kind: string): string {
  const map: Record<string, string> = {
    transaction: 'transaction',
    contact: 'contact',
    medication: 'medication',
    note: 'note',
    contract: 'contract',
  };
  return map[kind] ?? kind;
}

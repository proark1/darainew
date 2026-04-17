import { useEffect, useState } from 'react';
import { Send, Loader2, Check, Copy, Unlink, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface TelegramLink {
  is_active: boolean;
  telegram_username: string | null;
  telegram_first_name: string | null;
  linked_at: string | null;
}

export function TelegramConnectPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);

  const fetchLink = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('telegram_links')
      .select('is_active, telegram_username, telegram_first_name, linked_at')
      .eq('user_id', user.id)
      .maybeSingle();
    setLink(data);
    setLoading(false);
  };

  useEffect(() => { fetchLink(); }, [user]);

  // Poll for active status while waiting
  useEffect(() => {
    if (!code || link?.is_active) return;
    const id = setInterval(fetchLink, 3000);
    return () => clearInterval(id);
  }, [code, link?.is_active]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('telegram-link', {
        body: { action: 'generate' },
      });
      if (error) throw error;
      setCode(data.code);
      setDeepLink(data.deepLink);
      toast({ title: 'Link code generated', description: 'Open Telegram and tap the link to connect.' });
    } catch (e) {
      toast({ title: 'Could not generate code', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleUnlink = async () => {
    try {
      await supabase.functions.invoke('telegram-link', { body: { action: 'unlink' } });
      setLink(null);
      setCode(null);
      setDeepLink(null);
      toast({ title: 'Telegram disconnected' });
    } catch (e) {
      toast({ title: 'Could not unlink', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Send className="w-4 h-4 text-primary" />
          </div>
          Telegram
          {link?.is_active && <Badge variant="secondary" className="ml-auto"><Check className="w-3 h-3 mr-1" />Connected</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {link?.is_active ? (
          <>
            <p className="text-sm text-muted-foreground">
              Chat with Dori from Telegram as <span className="font-medium text-foreground">@{link.telegram_username ?? link.telegram_first_name}</span>. Send any message, question, or photo.
            </p>
            <Button variant="outline" size="sm" onClick={handleUnlink}>
              <Unlink className="w-3 h-3 mr-2" />
              Disconnect
            </Button>
          </>
        ) : code && deepLink ? (
          <>
            <p className="text-sm text-muted-foreground">
              Tap the button below to open Telegram and link your account. The code expires in 10 minutes.
            </p>
            <div className="flex gap-2">
              <a
                href={deepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Open Telegram
              </a>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { navigator.clipboard.writeText(code); toast({ title: 'Code copied' }); }}
              >
                <Copy className="w-3 h-3 mr-2" />
                {code}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Waiting for you to open Telegram…
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Connect Telegram to chat with Dori from your phone — anywhere, anytime. Send tasks, ask questions, get reminders.
            </p>
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Send className="w-3 h-3 mr-2" />}
              Connect Telegram
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

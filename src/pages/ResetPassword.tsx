import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sparkles, Lock, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();
  
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if we have a valid session from the reset link
    supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked the reset link
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: t('auth.error') || 'Error',
        description: t('auth.passwordsDontMatch') || 'Passwords do not match',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: t('auth.error') || 'Error',
        description: t('auth.passwordTooShort') || 'Password must be at least 6 characters',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast({
          variant: 'destructive',
          title: t('auth.error') || 'Error',
          description: error.message,
        });
      } else {
        setSuccess(true);
        toast({
          title: t('auth.passwordUpdated') || 'Password updated',
          description: t('auth.canNowLogin') || 'You can now login with your new password',
        });
        setTimeout(() => navigate('/auth'), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <h1 className="sr-only">Set new password</h1>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent">
            <Sparkles className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>

        {/* Reset Card */}
        <div className="glass-panel-solid p-8">
          {success ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mx-auto">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">
                {t('auth.passwordReset') || 'Password reset!'}
              </h2>
              <p className="text-muted-foreground text-sm">
                {t('auth.redirectingToLogin') || 'Redirecting you to login...'}
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  {t('auth.setNewPassword') || 'Set new password'}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {t('auth.enterNewPassword') || 'Enter your new password below'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    {t('auth.newPassword') || 'New password'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-12 pr-12 h-12 text-base"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    {t('auth.confirmPassword') || 'Confirm password'}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-12 h-12 text-base"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    t('auth.updatePassword') || 'Update password'
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

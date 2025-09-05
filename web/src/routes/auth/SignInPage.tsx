import { useState } from "react";
import { supabase } from '../../lib/supabase';
import { Input } from "../../components/UI/Input";
import { Button } from "../../components/UI/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/UI/Card";
import { Lock, Mail } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const disabled = email.trim().length === 0 || loading;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email for the sign-in link!');
    }
    setLoading(false);
  };

  return (
    <Card data-testid="signin-card">
      <CardHeader>
        <CardTitle className="text-2xl">Betting with Friends</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">Track your picks privately and securely.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSignIn} className="space-y-4">
          <label className="text-sm font-medium" htmlFor="email">Email Address</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              id="email" 
              data-testid="email-input" 
              className="pl-9 h-11 rounded-xl" 
              placeholder="Enter your email address" 
              type="email"
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
              required
            />
          </div>
          
          {error && (
            <div className="alert-error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {message && (
            <div className="alert-success">
              <strong>Success:</strong> {message}
            </div>
          )}

          <Button data-testid="magic-link" className="h-11 w-full rounded-xl" disabled={disabled} type="submit">
            <Lock className="mr-2 h-4 w-4"/> 
            {loading ? 'Sending Magic Link...' : 'Sign in with Magic Link'}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">We'll send you a secure magic link. No password needed.</p>
      </CardContent>
    </Card>
  );
}
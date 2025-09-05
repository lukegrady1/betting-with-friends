import { useState } from "react";
import { supabase } from '../../lib/supabase';
import { Input } from "../../components/UI/Input";
import { Button } from "../../components/UI/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/UI/Card";
import { Lock, Mail, User, Eye, EyeOff } from "lucide-react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const disabled = email.trim().length === 0 || password.trim().length === 0 || loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // Construct the correct callback URL based on environment
    const baseUrl = import.meta.env.PROD ? '/betting-with-friends' : '';
    const callbackUrl = `${window.location.origin}${baseUrl}/auth/callback`;

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: callbackUrl,
        },
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email to confirm your account!');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
      } else {
        // Successful sign-in will be handled by the auth state change
        setMessage('Signing you in...');
      }
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor="email">Email Address</label>
            <div className="relative mt-1">
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
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                id="password" 
                data-testid="password-input" 
                className="pl-9 pr-9 h-11 rounded-xl" 
                placeholder="Enter your password" 
                type={showPassword ? "text" : "password"}
                value={password} 
                onChange={e=>setPassword(e.target.value)} 
                required
                minLength={6}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
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

          <Button data-testid="submit-button" className="h-11 w-full rounded-xl" disabled={disabled} type="submit">
            <User className="mr-2 h-4 w-4"/> 
            {loading ? (isSignUp ? 'Creating Account...' : 'Signing In...') : (isSignUp ? 'Sign Up' : 'Sign In')}
          </Button>
        </form>
        
        <div className="text-center">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground underline"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          {isSignUp 
            ? "You'll receive a confirmation email after signing up." 
            : "Use your email and password to sign in."
          }
        </p>
      </CardContent>
    </Card>
  );
}
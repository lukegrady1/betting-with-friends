import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export function Callback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check if we have auth tokens in the URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        console.log('Callback: Processing auth tokens...', { 
          hasAccess: !!accessToken, 
          hasRefresh: !!refreshToken,
          fullHash: window.location.hash 
        });

        if (accessToken && refreshToken) {
          // Set the session from the tokens
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Auth callback error:', error);
            navigate('/auth/signin');
            return;
          }

          if (data.session) {
            console.log('Successfully authenticated user:', data.session.user?.email);
            navigate('/leagues');
            return;
          }
        }

        // Fallback: try to get existing session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          navigate('/auth/signin');
          return;
        }

        if (sessionData.session) {
          console.log('Found existing session:', sessionData.session.user?.email);
          navigate('/leagues');
        } else {
          console.log('No session found, redirecting to sign in');
          navigate('/auth/signin');
        }
      } catch (err) {
        console.error('Unexpected error:', err);
        navigate('/auth/signin');
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
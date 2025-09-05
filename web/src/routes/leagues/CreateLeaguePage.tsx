import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export function CreateLeaguePage() {
  const navigate = useNavigate();
  const [leagueName, setLeagueName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const inviteCode = generateInviteCode();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create the league
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .insert({
          name: leagueName,
          invite_code: inviteCode,
          created_by: user.id,
        })
        .select()
        .single();

      if (leagueError) throw leagueError;

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from('league_members')
        .insert({
          league_id: league.id,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      navigate(`/leagues/${league.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell 
      title="Create League" 
      onBack={() => navigate('/leagues')}
      showBottomNav={false}
    >
      <div className="px-4 py-6">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="leagueName" className="block text-sm font-medium text-gray-700 mb-1">
                League Name
              </label>
              <input
                id="leagueName"
                type="text"
                value={leagueName}
                onChange={(e) => setLeagueName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter league name"
                maxLength={50}
              />
              <p className="text-xs text-gray-500 mt-1">
                Choose a name that's easy for your friends to recognize
              </p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/leagues')}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !leagueName.trim()}
                className="flex-1"
              >
                {loading ? 'Creating...' : 'Create League'}
              </Button>
            </div>
          </form>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-500">
          You'll be the admin of this league and can manage events and settings.
        </div>
      </div>
    </MobileShell>
  );
}
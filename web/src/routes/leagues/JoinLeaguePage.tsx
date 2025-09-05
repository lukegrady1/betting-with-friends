import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';

export function JoinLeaguePage() {
  const navigate = useNavigate();
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find the league by invite code
      const { data: league, error: findError } = await supabase
        .from('leagues')
        .select('id, name')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();

      if (findError || !league) {
        throw new Error('League not found. Please check your invite code.');
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('league_members')
        .select('league_id')
        .eq('league_id', league.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        throw new Error('You are already a member of this league.');
      }

      // Add as member
      const { error: joinError } = await supabase
        .from('league_members')
        .insert({
          league_id: league.id,
          user_id: user.id,
          role: 'member',
        });

      if (joinError) throw joinError;

      navigate(`/leagues/${league.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobileShell 
      title="Join League" 
      onBack={() => navigate('/leagues')}
      showBottomNav={false}
    >
      <div className="px-4 py-6">
        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1">
                Invite Code
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-center text-lg tracking-wider"
                placeholder="Enter code"
                maxLength={10}
                style={{ textTransform: 'uppercase' }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the invite code shared by your league admin
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
                disabled={loading || !inviteCode.trim()}
                className="flex-1"
              >
                {loading ? 'Joining...' : 'Join League'}
              </Button>
            </div>
          </form>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-500">
          Ask your league admin for the invite code to join their league.
        </div>
      </div>
    </MobileShell>
  );
}
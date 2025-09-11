import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Settings, 
  Users, 
  AlertTriangle,
  Copy,
  UserMinus,
  Crown,
  Save,
  User
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';

interface LeagueMember {
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    username: string;
  };
}

interface League {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
}

export function SettingsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [username, setUsername] = useState('');

  // Get current user
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  // Get league details
  const { data: league, isLoading: leagueLoading } = useQuery({
    queryKey: ['league-settings', leagueId],
    queryFn: async () => {
      if (!leagueId) throw new Error('League ID required');
      
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .single();
      
      if (error) throw error;
      setLeagueName(data.name); // Set initial value
      return data as League;
    },
    enabled: !!leagueId,
  });

  // Get current user profile
  useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      if (!session?.user.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (error) throw error;
      setUsername(data.username || ''); // Set initial value
      return data;
    },
    enabled: !!session?.user.id,
  });

  // Get league members
  const { data: members } = useQuery({
    queryKey: ['league-members-settings', leagueId],
    queryFn: async () => {
      if (!leagueId) return [];

      const { data, error } = await supabase
        .from('league_members')
        .select(`
          user_id,
          role,
          joined_at,
          profiles!inner(username)
        `)
        .eq('league_id', leagueId)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      return data.map(member => ({
        ...member,
        profiles: Array.isArray(member.profiles) ? member.profiles[0] : member.profiles
      })) as LeagueMember[];
    },
    enabled: !!leagueId,
  });

  const isAdmin = league && session && league.created_by === session.user.id;

  const handleCopyInviteCode = async () => {
    if (league?.invite_code) {
      try {
        await navigator.clipboard.writeText(league.invite_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleUpdateLeague = async () => {
    if (!league || !isAdmin) return;

    try {
      const { error } = await supabase
        .from('leagues')
        .update({ name: leagueName })
        .eq('id', league.id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['league-settings', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['league', leagueId] });
    } catch (error) {
      console.error('Failed to update league:', error);
    }
  };

  const handleUpdateProfile = async () => {
    if (!session?.user.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', session.user.id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!isAdmin || !leagueId) return;
    
    if (confirm('Are you sure you want to remove this member from the league?')) {
      try {
        const { error } = await supabase
          .from('league_members')
          .delete()
          .eq('league_id', leagueId)
          .eq('user_id', userId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['league-members-settings', leagueId] });
      } catch (error) {
        console.error('Failed to remove member:', error);
      }
    }
  };

  const handleLeaveLeague = async () => {
    if (!session?.user.id || !leagueId) return;
    
    if (confirm('Are you sure you want to leave this league?')) {
      try {
        const { error } = await supabase
          .from('league_members')
          .delete()
          .eq('league_id', leagueId)
          .eq('user_id', session.user.id);

        if (error) throw error;
        navigate('/leagues');
      } catch (error) {
        console.error('Failed to leave league:', error);
      }
    }
  };

  if (leagueLoading || !league) {
    return (
      <MobileShell 
        title="Settings" 
        activeTab="settings"
        showBottomNav={false} 
        showDesktopSidebar={true}
        onBack={() => navigate(`/leagues/${leagueId}`)}
      >
        <div className="px-4 py-8 text-center">
          <div className="loading-spinner w-12 h-12 mx-auto mb-6"></div>
          <p className="text-lg font-medium text-gray-600">Loading settings...</p>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell 
      title="League Settings" 
      activeTab="settings"
      showBottomNav={false} 
      showDesktopSidebar={true}
      onBack={() => navigate(`/leagues/${leagueId}`)}
    >
      <div className="px-4 py-6 space-y-8 md:px-12 md:py-12">
        {/* Desktop Hero */}
        <div className="hidden md:block mb-8">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Settings
            </h1>
            <p className="text-gray-600">
              Manage your league and profile settings
            </p>
          </div>
        </div>

        {/* League Settings */}
        <Card className="p-6 border-gray-200">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
              <Settings size={20} className="text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">League Settings</h3>
              <p className="text-sm text-gray-600">Manage league details and invite code</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                League Name
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  disabled={!isAdmin}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
                />
                {isAdmin && (
                  <Button onClick={handleUpdateLeague} size="sm">
                    <Save size={16} className="mr-2" />
                    Save
                  </Button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invite Code
              </label>
              <div className="flex space-x-2">
                <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono text-lg">
                  {league.invite_code}
                </div>
                <Button onClick={handleCopyInviteCode} variant="outline" size="sm">
                  <Copy size={16} className="mr-2" />
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Profile Settings */}
        <Card className="p-6 border-gray-200">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
              <User size={20} className="text-gray-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Profile Settings</h3>
              <p className="text-sm text-gray-600">Update your profile information</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              />
              <Button onClick={handleUpdateProfile} size="sm">
                <Save size={16} className="mr-2" />
                Save
              </Button>
            </div>
          </div>
        </Card>

        {/* League Members */}
        <Card className="p-6 border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                <Users size={20} className="text-gray-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">League Members</h3>
                <p className="text-sm text-gray-600">{members?.length || 0} members</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {members?.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                    <User size={14} className="text-gray-600" />
                  </div>
                  <div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-900 mr-2">
                        {member.profiles.username || 'Anonymous'}
                      </span>
                      {member.role === 'admin' && (
                        <Crown size={14} className="text-yellow-600" />
                      )}
                      {member.user_id === session?.user.id && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                {isAdmin && member.user_id !== session?.user.id && (
                  <Button
                    onClick={() => handleRemoveMember(member.user_id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <UserMinus size={14} className="mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Danger Zone */}
        {!isAdmin && (
          <Card className="p-6 border-red-200 bg-red-50">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center mr-3">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
                <p className="text-sm text-red-700">Irreversible actions</p>
              </div>
            </div>
            
            <Button
              onClick={handleLeaveLeague}
              variant="outline"
              className="text-red-700 border-red-300 hover:bg-red-100"
            >
              Leave League
            </Button>
          </Card>
        )}
      </div>
    </MobileShell>
  );
}
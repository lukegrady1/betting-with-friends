import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { League } from '../../lib/types';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { EmptyState } from '../../components/UI/EmptyState';

interface LeagueStats {
  total_members: number;
  total_events: number;
  active_picks: number;
  completed_events: number;
}


export function LeagueHomePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('home');
  const [copied, setCopied] = useState(false);

  const { data: league, isLoading: leagueLoading } = useQuery({
    queryKey: ['league', leagueId],
    queryFn: async () => {
      if (!leagueId) throw new Error('League ID required');
      
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .single();
      
      if (error) throw error;
      return data as League;
    },
    enabled: !!leagueId,
  });

  const { data: leagueStats } = useQuery({
    queryKey: ['league-stats', leagueId],
    queryFn: async () => {
      if (!leagueId) return null;

      const [membersRes, eventsRes, picksRes] = await Promise.all([
        supabase
          .from('league_members')
          .select('user_id')
          .eq('league_id', leagueId),
        supabase
          .from('events')
          .select('id, status')
          .eq('league_id', leagueId),
        supabase
          .from('picks')
          .select('id, result')
          .eq('league_id', leagueId)
      ]);

      const totalMembers = membersRes.data?.length || 0;
      const totalEvents = eventsRes.data?.length || 0;
      const completedEvents = eventsRes.data?.filter(e => e.status === 'final').length || 0;
      const activePicks = picksRes.data?.filter(p => p.result === 'pending').length || 0;

      return {
        total_members: totalMembers,
        total_events: totalEvents,
        active_picks: activePicks,
        completed_events: completedEvents,
      } as LeagueStats;
    },
    enabled: !!leagueId,
  });

  const { data: leagueMembers } = useQuery({
    queryKey: ['league-members', leagueId],
    queryFn: async () => {
      if (!leagueId) return [];

      const { data, error } = await supabase
        .from('league_user_stats')
        .select(`
          user_id,
          wins,
          losses,
          net_units,
          profiles!inner(username)
        `)
        .eq('league_id', leagueId)
        .order('net_units', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!leagueId,
  });

  const { data: recentEvents } = useQuery({
    queryKey: ['recent-events', leagueId],
    queryFn: async () => {
      if (!leagueId) return [];

      const { data, error } = await supabase
        .from('events')
        .select('id, home_team, away_team, start_time, status')
        .eq('league_id', leagueId)
        .order('start_time', { ascending: false })
        .limit(3);

      if (error) throw error;
      return data || [];
    },
    enabled: !!leagueId,
  });

  // Get recent picks from all league members for the activity feed
  const { data: recentPicks } = useQuery({
    queryKey: ['league-feed', leagueId],
    queryFn: async () => {
      if (!leagueId) return [];

      const { data, error } = await supabase
        .from('picks')
        .select(`
          *,
          events(
            id,
            home_team,
            away_team,
            start_time,
            status,
            home_score,
            away_score
          ),
          profiles!user_id(username)
        `)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!leagueId,
  });

  // Helper functions for formatting picks
  const formatMarket = (market: string, side: string, line: number | null) => {
    switch (market) {
      case 'moneyline':
        return side === 'home' ? 'Moneyline (Home)' : 'Moneyline (Away)';
      case 'spread':
        const spreadText = side === 'home' ? `${line || 0}` : `+${Math.abs(line || 0)}`;
        return `Spread ${spreadText}`;
      case 'total':
        return `Total ${side === 'over' ? 'Over' : 'Under'} ${line || 0}`;
      default:
        return market;
    }
  };

  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'win': return 'text-green-600 bg-green-100';
      case 'loss': return 'text-red-600 bg-red-100';
      case 'push': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-blue-600 bg-blue-100';
    }
  };


  const handleTabChange = (tab: string) => {
    if (!leagueId) return;
    
    switch (tab) {
      case 'home':
        // Already on home page
        setActiveTab(tab);
        break;
      case 'upload':
        navigate(`/leagues/${leagueId}/upload`);
        break;
      case 'picks':
        navigate(`/leagues/${leagueId}/picks`);
        break;
      case 'leaderboard':
        navigate(`/leagues/${leagueId}/leaderboard`);
        break;
      default:
        setActiveTab(tab);
    }
  };

  const handleSettings = () => {
    navigate(`/leagues/${leagueId}/settings`);
  };

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

  const isLoading = leagueLoading;

  if (isLoading) {
    return (
      <MobileShell title="Loading..." showBottomNav={false} showDesktopSidebar={true}>
        <div className="px-4 py-8 text-center md:py-16">
          <div className="loading-spinner w-12 h-12 mx-auto mb-6"></div>
          <p className="text-lg font-medium text-gray-600">Loading league...</p>
          <p className="text-sm text-gray-400 mt-2">Just a moment while we get everything ready</p>
        </div>
      </MobileShell>
    );
  }

  if (!league) {
    return (
      <MobileShell title="League Not Found" showBottomNav={false} showDesktopSidebar={true}>
        <div className="px-4 py-8 text-center md:py-16">
          <EmptyState
            title="League Not Found"
            description="This league doesn't exist or you don't have access to it"
            icon={<Users className="h-12 w-12 md:h-20 md:w-20" />}
          />
          <Button onClick={() => navigate('/leagues')} className="mt-6">
            Back to Leagues
          </Button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title={league.name}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onBack={() => navigate('/leagues')}
      onSettings={handleSettings}
      showDesktopSidebar={true}
    >
      <div className="px-4 py-6 space-y-8 md:px-12 md:py-12">
        {/* Desktop Hero Section */}
        <div className="hidden md:block mb-8">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {league.name}
            </h1>
            <p className="text-gray-600">
              League Overview
            </p>
          </div>
        </div>

        {/* League Stats Overview */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          <Card className="p-6 border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {leagueStats?.total_members || 0}
            </div>
            <div className="text-sm text-gray-600">Members</div>
          </Card>

          <Card className="p-6 border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {leagueStats?.total_events || 0}
            </div>
            <div className="text-sm text-gray-600">Events</div>
          </Card>

          <Card className="p-6 border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {leagueStats?.active_picks || 0}
            </div>
            <div className="text-sm text-gray-600">Active Picks</div>
          </Card>

          <Card className="p-6 border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {leagueStats?.completed_events || 0}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </Card>
        </div>

        {/* League Code */}
        <Card className="p-6 border-gray-200">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Invite Code</h3>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-gray-50 px-4 py-3 rounded-lg flex-1">
              <div className="font-mono text-lg font-medium text-gray-900">
                {league.invite_code}
              </div>
            </div>
            <Button
              onClick={handleCopyInviteCode}
              variant="outline"
              className="px-4 py-3 border-gray-300 hover:border-gray-400"
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Button
            onClick={() => navigate(`/leagues/${leagueId}/picks`)}
            className="p-4 h-auto border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            variant="outline"
          >
            <span className="font-medium">My Picks</span>
          </Button>

          <Button
            onClick={() => navigate(`/leagues/${leagueId}/upload`)}
            className="p-4 h-auto border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            variant="outline"
          >
            <span className="font-medium">Upload Slips</span>
          </Button>

          <Button
            onClick={() => navigate(`/leagues/${leagueId}/leaderboard`)}
            className="p-4 h-auto border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            variant="outline"
          >
            <span className="font-medium">Leaderboard</span>
          </Button>

          <Button
            onClick={() => navigate(`/leagues/${leagueId}/analytics`)}
            className="p-4 h-auto border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            variant="outline"
          >
            <span className="font-medium">Analytics</span>
          </Button>
        </div>

        {/* Top Performers */}
        <Card className="p-6 border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Leaderboard</h3>
            <Button
              onClick={() => navigate(`/leagues/${leagueId}/leaderboard`)}
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900"
            >
              View All
            </Button>
          </div>

          {!leagueMembers || leagueMembers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">No rankings yet</p>
              <p className="text-sm text-gray-400">
                Rankings will appear after picks are made and events are graded
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {leagueMembers.slice(0, 3).map((member: any, index: number) => (
                <div key={member.user_id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center mr-3 text-sm font-medium text-gray-600">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {member.profiles?.username || 'Anonymous'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {member.wins}W - {member.losses}L
                      </div>
                    </div>
                  </div>
                  <div className={`font-medium ${
                    (member.net_units || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {(member.net_units || 0) >= 0 ? '+' : ''}{(member.net_units || 0).toFixed(1)}u
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="p-6 border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Recent Events</h3>
          </div>

          {!recentEvents || recentEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">No events yet</p>
              <p className="text-sm text-gray-400">
                Ask your league admin to add some events to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((event: any) => (
                <div key={event.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="font-medium text-gray-900">
                      {event.away_team} @ {event.home_team}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(event.start_time).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                  <div className={`px-2 py-1 text-xs font-medium rounded ${
                    event.status === 'final' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {event.status === 'final' ? 'Final' : 'Scheduled'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* League Activity Feed */}
        <Card className="p-6 border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">League Activity</h3>
            <Button
              onClick={() => navigate(`/leagues/${leagueId}/picks`)}
              variant="ghost"
              size="sm"
              className="text-gray-600 hover:text-gray-900"
            >
              View All
            </Button>
          </div>

          {!recentPicks || recentPicks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-2">No picks yet</p>
              <p className="text-sm text-gray-400">
                Activity will appear when league members start making picks
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentPicks.slice(0, 5).map((pick: any) => (
                <div key={pick.id} className="py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className="font-medium text-gray-900 mr-2">
                          {pick.profiles?.username || 'Anonymous'}
                        </span>
                        <span className="text-sm text-gray-600">made a pick</span>
                        <div className={`ml-2 px-2 py-1 rounded text-xs font-medium ${getResultColor(pick.result)}`}>
                          {pick.result === 'pending' ? 'Pending' : pick.result.toUpperCase()}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-900 mb-1">
                        {pick.events ? 
                          `${pick.events.away_team} @ ${pick.events.home_team}` : 
                          `${pick.market.toUpperCase()}: ${pick.side}${pick.line ? ` ${pick.line}` : ''}`
                        }
                      </div>
                      
                      {/* Show all pick details immediately */}
                      <div className="flex items-center space-x-4 text-xs text-gray-600">
                        <span>{formatMarket(pick.market, pick.side, pick.line)}</span>
                        <span>{formatOdds(pick.odds_american)}</span>
                        {pick.units_staked && <span>{pick.units_staked}u</span>}
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500 ml-4 text-right">
                      {new Date(pick.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </MobileShell>
  );
}
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  Trophy, 
  Calendar, 
  Target, 
  TrendingUp, 
  Share2, 
  Copy, 
  Settings,
  Plus,
  Activity,
  BarChart3,
  Clock,
  Zap
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

interface LeagueUser {
  id: string;
  username: string | null;
  role: string;
  wins: number;
  losses: number;
  net_units: number;
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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
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
      <div className="px-4 py-6 space-y-6 md:px-0 md:py-0">
        {/* Desktop Hero Section */}
        <div className="hidden md:block mb-12">
          <div className="text-center mb-16">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <span className="text-2xl font-bold text-white relative z-10">🏆</span>
            </div>
            <h1 className="text-6xl font-black text-gradient mb-4 tracking-tight">
              {league.name}
            </h1>
            <p className="text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
              Your premier betting league dashboard
            </p>
          </div>
        </div>

        {/* League Stats Overview */}
        <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4 md:gap-6">
          <Card className="text-center p-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Users size={20} className="text-blue-600 md:size-6" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-premium mb-1">
              {leagueStats?.total_members || 0}
            </div>
            <div className="text-xs md:text-sm text-neutral-600 font-medium">Members</div>
          </Card>

          <Card className="text-center p-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Calendar size={20} className="text-green-600 md:size-6" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-premium mb-1">
              {leagueStats?.total_events || 0}
            </div>
            <div className="text-xs md:text-sm text-neutral-600 font-medium">Events</div>
          </Card>

          <Card className="text-center p-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Target size={20} className="text-yellow-600 md:size-6" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-premium mb-1">
              {leagueStats?.active_picks || 0}
            </div>
            <div className="text-xs md:text-sm text-neutral-600 font-medium">Active Picks</div>
          </Card>

          <Card className="text-center p-4">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Trophy size={20} className="text-purple-600 md:size-6" />
            </div>
            <div className="text-2xl md:text-3xl font-bold text-premium mb-1">
              {leagueStats?.completed_events || 0}
            </div>
            <div className="text-xs md:text-sm text-neutral-600 font-medium">Completed</div>
          </Card>
        </div>

        {/* League Code & Actions */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3">
                <Share2 size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-premium">Invite Friends</h3>
                <p className="text-sm text-neutral-600">Share your league code</p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 mb-4">
            <div className="glass px-4 py-3 rounded-xl flex-1 text-center">
              <div className="font-mono text-xl font-bold text-blue-600 tracking-wider">
                {league.invite_code}
              </div>
            </div>
            <Button
              onClick={handleCopyInviteCode}
              variant="outline"
              size="sm"
              className="px-4 py-3"
            >
              {copied ? (
                <>
                  <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={16} className="mr-2" />
                  Copy
                </>
              )}
            </Button>
          </div>
          
          <p className="text-sm text-neutral-600 text-center">
            Friends can join using this code in the "Join League" section
          </p>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Button
            onClick={() => navigate(`/leagues/${leagueId}/picks`)}
            className="flex flex-col items-center p-4 h-auto"
            variant="outline"
          >
            <Target size={24} className="mb-2" />
            <span className="text-sm font-semibold">Make Picks</span>
          </Button>

          <Button
            onClick={() => navigate(`/leagues/${leagueId}/events`)}
            className="flex flex-col items-center p-4 h-auto"
            variant="outline"
          >
            <Calendar size={24} className="mb-2" />
            <span className="text-sm font-semibold">View Events</span>
          </Button>

          <Button
            onClick={() => navigate(`/leagues/${leagueId}/leaderboard`)}
            className="flex flex-col items-center p-4 h-auto"
            variant="outline"
          >
            <Trophy size={24} className="mb-2" />
            <span className="text-sm font-semibold">Leaderboard</span>
          </Button>

          <Button
            onClick={() => navigate(`/leagues/${leagueId}/analytics`)}
            className="flex flex-col items-center p-4 h-auto"
            variant="outline"
          >
            <BarChart3 size={24} className="mb-2" />
            <span className="text-sm font-semibold">Analytics</span>
          </Button>
        </div>

        {/* Top Performers */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center mr-3">
                <Trophy size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-premium">Top Performers</h3>
                <p className="text-sm text-neutral-600">League leaders by net units</p>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/leagues/${leagueId}/leaderboard`)}
              variant="ghost"
              size="sm"
            >
              View All
            </Button>
          </div>

          {!leagueMembers || leagueMembers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500 font-medium">No rankings yet</p>
              <p className="text-sm text-neutral-400 mt-1">
                Rankings will appear after picks are made and events are graded
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {leagueMembers.slice(0, 3).map((member: any, index: number) => (
                <div key={member.user_id} className="flex items-center justify-between p-3 glass rounded-xl">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 text-white font-bold text-sm ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' :
                      index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                      'bg-gradient-to-br from-orange-600 to-orange-700'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-premium">
                        {member.profiles?.username || 'Anonymous'}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {member.wins}W - {member.losses}L
                      </div>
                    </div>
                  </div>
                  <div className={`font-bold ${
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
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3">
                <Activity size={18} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-premium">Recent Events</h3>
                <p className="text-sm text-neutral-600">Latest betting opportunities</p>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/leagues/${leagueId}/events`)}
              variant="ghost"
              size="sm"
            >
              View All
            </Button>
          </div>

          {!recentEvents || recentEvents.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500 font-medium">No events yet</p>
              <p className="text-sm text-neutral-400 mt-1">
                Ask your league admin to add some events to get started
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((event: any) => (
                <div key={event.id} className="flex items-center justify-between p-3 glass rounded-xl">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <Zap size={14} className="text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-premium">
                        {event.away_team} @ {event.home_team}
                      </div>
                      <div className="text-sm text-neutral-600 flex items-center">
                        <Clock size={12} className="mr-1" />
                        {new Date(event.start_time).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    event.status === 'final' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {event.status === 'final' ? 'Final' : 'Scheduled'}
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
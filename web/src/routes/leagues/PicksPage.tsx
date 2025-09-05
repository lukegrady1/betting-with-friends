import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Target, 
  Calendar, 
  Clock, 
  Plus, 
  TrendingUp,
  TrendingDown,
  Minus,
  Filter,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { EmptyState } from '../../components/UI/EmptyState';

interface Pick {
  id: string;
  event_id: string;
  market: string;
  side: string;
  line: number | null;
  odds_american: number;
  units_staked: number;
  result: string;
  profit_units: number;
  created_at: string;
  events: {
    id: string;
    home_team: string;
    away_team: string;
    start_time: string;
    status: string;
    home_score?: number;
    away_score?: number;
  };
}

interface Event {
  id: string;
  home_team: string;
  away_team: string;
  start_time: string;
  status: string;
  sport: string;
  league_name?: string;
}

export function PicksPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [showHidden, setShowHidden] = useState(false);

  const { data: picks, isLoading: picksLoading } = useQuery({
    queryKey: ['my-picks', leagueId],
    queryFn: async () => {
      if (!leagueId) return [];
      
      const { data, error } = await supabase
        .from('picks')
        .select(`
          *,
          events!inner(
            id,
            home_team,
            away_team,
            start_time,
            status,
            home_score,
            away_score
          )
        `)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Pick[];
    },
    enabled: !!leagueId,
  });

  const { data: availableEvents, isLoading: eventsLoading } = useQuery({
    queryKey: ['available-events', leagueId],
    queryFn: async () => {
      if (!leagueId) return [];
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('league_id', leagueId)
        .gt('start_time', new Date().toISOString())
        .eq('status', 'scheduled')
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as Event[];
    },
    enabled: !!leagueId,
  });

  const filteredPicks = picks?.filter(pick => {
    if (filter === 'pending') return pick.result === 'pending';
    if (filter === 'completed') return pick.result !== 'pending';
    return true;
  }) || [];

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

  const isStarted = (startTime: string) => {
    return new Date(startTime) <= new Date();
  };

  if (picksLoading || eventsLoading) {
    return (
      <MobileShell 
        title="My Picks" 
        showBottomNav={false} 
        showDesktopSidebar={true}
        onBack={() => navigate(`/leagues/${leagueId}`)}
      >
        <div className="px-4 py-8 text-center md:py-16">
          <div className="loading-spinner w-12 h-12 mx-auto mb-6"></div>
          <p className="text-lg font-medium text-gray-600">Loading your picks...</p>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell 
      title="My Picks" 
      showBottomNav={false} 
      showDesktopSidebar={true}
      onBack={() => navigate(`/leagues/${leagueId}`)}
    >
      <div className="px-4 py-6 space-y-6 md:px-0 md:py-0">
        {/* Desktop Hero */}
        <div className="hidden md:block mb-12">
          <div className="text-center mb-16">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <span className="text-2xl font-bold text-white relative z-10">🎯</span>
            </div>
            <h1 className="text-6xl font-black text-gradient mb-4 tracking-tight">
              My Picks
            </h1>
            <p className="text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
              Track your betting predictions and performance
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        {picks && picks.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-premium mb-1">
                {picks.filter(p => p.result === 'pending').length}
              </div>
              <div className="text-xs text-neutral-600 font-medium">Pending</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {picks.filter(p => p.result === 'win').length}
              </div>
              <div className="text-xs text-neutral-600 font-medium">Wins</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {picks.filter(p => p.result === 'loss').length}
              </div>
              <div className="text-xs text-neutral-600 font-medium">Losses</div>
            </Card>
          </div>
        )}

        {/* Available Events for Picks */}
        {availableEvents && availableEvents.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3">
                  <Plus size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-premium">Available Events</h3>
                  <p className="text-sm text-neutral-600">Make picks before games start</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              {availableEvents.slice(0, 3).map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 glass rounded-xl">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                      <Calendar size={14} className="text-blue-600" />
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
                  <Button
                    onClick={() => navigate(`/leagues/${leagueId}/events/${event.id}/pick`)}
                    size="sm"
                  >
                    Pick
                  </Button>
                </div>
              ))}
              {availableEvents.length > 3 && (
                <Button
                  onClick={() => navigate(`/leagues/${leagueId}/events`)}
                  variant="ghost"
                  className="w-full"
                >
                  View All Events
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Filter Controls */}
        {picks && picks.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {(['all', 'pending', 'completed'] as const).map((filterType) => (
                <Button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  variant={filter === filterType ? 'default' : 'ghost'}
                  size="sm"
                  className="capitalize"
                >
                  {filterType}
                </Button>
              ))}
            </div>
            
            <Button
              onClick={() => setShowHidden(!showHidden)}
              variant="ghost"
              size="sm"
              className="flex items-center"
            >
              {showHidden ? (
                <>
                  <EyeOff size={16} className="mr-2" />
                  Hide Others
                </>
              ) : (
                <>
                  <Eye size={16} className="mr-2" />
                  Show Others
                </>
              )}
            </Button>
          </div>
        )}

        {/* Picks List */}
        {!filteredPicks || filteredPicks.length === 0 ? (
          <div className="text-center py-16">
            <EmptyState
              title={filter === 'all' ? "No picks yet" : `No ${filter} picks`}
              description={filter === 'all' ? 
                "Make your first pick on an upcoming event" :
                `You don't have any ${filter} picks`
              }
              icon={<Target className="h-12 w-12 md:h-20 md:w-20" />}
            />
            {availableEvents && availableEvents.length > 0 && (
              <Button
                onClick={() => navigate(`/leagues/${leagueId}/events`)}
                className="mt-6"
              >
                <Plus size={20} className="mr-2" />
                Make Your First Pick
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPicks.map((pick) => (
              <Card key={pick.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <h3 className="text-lg font-bold text-premium mr-2">
                        {pick.events.away_team} @ {pick.events.home_team}
                      </h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-semibold ${getResultColor(pick.result)}`}>
                        {pick.result === 'pending' ? 'Pending' : pick.result.toUpperCase()}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-neutral-500">Market:</span>
                        <div className="font-semibold">{formatMarket(pick.market, pick.side, pick.line)}</div>
                      </div>
                      <div>
                        <span className="text-neutral-500">Odds:</span>
                        <div className="font-semibold">{formatOdds(pick.odds_american)}</div>
                      </div>
                      <div>
                        <span className="text-neutral-500">Stake:</span>
                        <div className="font-semibold">{pick.units_staked}u</div>
                      </div>
                      <div>
                        <span className="text-neutral-500">P&L:</span>
                        <div className={`font-semibold flex items-center ${
                          pick.profit_units > 0 ? 'text-green-600' : 
                          pick.profit_units < 0 ? 'text-red-600' : 'text-neutral-600'
                        }`}>
                          {pick.profit_units > 0 && <TrendingUp size={14} className="mr-1" />}
                          {pick.profit_units < 0 && <TrendingDown size={14} className="mr-1" />}
                          {pick.profit_units === 0 && <Minus size={14} className="mr-1" />}
                          {pick.profit_units >= 0 ? '+' : ''}{pick.profit_units.toFixed(2)}u
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm text-neutral-600 pt-4 border-t border-neutral-200">
                  <div className="flex items-center">
                    <Clock size={14} className="mr-1" />
                    {isStarted(pick.events.start_time) ? 'Started' : 'Starts'} {' '}
                    {new Date(pick.events.start_time).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>
                  
                  {pick.events.status === 'final' && pick.events.home_score !== undefined && (
                    <div className="font-semibold">
                      Final: {pick.events.away_team} {pick.events.away_score} - {pick.events.home_score} {pick.events.home_team}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Trophy, 
  Medal,
  DollarSign,
  Percent,
  BarChart3,
  Crown,
  Star,
  Award,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { EmptyState } from '../../components/UI/EmptyState';

interface LeaderboardEntry {
  user_id: string;
  username: string | null;
  wins: number;
  losses: number;
  pushes: number;
  graded: number;
  win_pct: number;
  units_risked: number;
  net_units: number;
  rank: number;
}

export function LeaderboardPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'net_units' | 'win_pct' | 'units_risked'>('net_units');

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard', leagueId, sortBy],
    queryFn: async () => {
      if (!leagueId) return [];
      
      const { data, error } = await supabase
        .from('league_user_stats')
        .select(`
          user_id,
          wins,
          losses,
          pushes,
          graded,
          win_pct,
          units_risked,
          net_units,
          profiles!inner(username)
        `)
        .eq('league_id', leagueId)
        .order(sortBy, { ascending: false });

      if (error) throw error;

      return data?.map((entry, index) => ({
        ...entry,
        username: (entry.profiles as any)?.username || null,
        rank: index + 1
      })) as LeaderboardEntry[] || [];
    },
    enabled: !!leagueId,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-orange-600" />;
      default:
        return <Star className="w-6 h-6 text-neutral-400" />;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white';
      case 2:
        return 'bg-gradient-to-br from-gray-300 to-gray-500 text-white';
      case 3:
        return 'bg-gradient-to-br from-orange-400 to-orange-600 text-white';
      default:
        return 'bg-neutral-100 text-neutral-700';
    }
  };

  const getWinPercentageColor = (winPct: number) => {
    if (winPct >= 0.6) return 'text-green-600';
    if (winPct >= 0.5) return 'text-blue-600';
    if (winPct >= 0.4) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatWinPercentage = (winPct: number | null) => {
    if (winPct === null || winPct === undefined) return '0%';
    return `${Math.round(winPct * 100)}%`;
  };

  const sortOptions = [
    { value: 'net_units', label: 'Net Units', icon: DollarSign },
    { value: 'win_pct', label: 'Win %', icon: Percent },
    { value: 'units_risked', label: 'Volume', icon: BarChart3 }
  ] as const;

  if (isLoading) {
    return (
      <MobileShell 
        title="Leaderboard" 
        showBottomNav={false} 
        showDesktopSidebar={true}
        onBack={() => navigate(`/leagues/${leagueId}`)}
      >
        <div className="px-4 py-8 text-center md:py-16">
          <div className="loading-spinner w-12 h-12 mx-auto mb-6"></div>
          <p className="text-lg font-medium text-gray-600">Loading standings...</p>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell 
      title="Leaderboard" 
      showBottomNav={false} 
      showDesktopSidebar={true}
      onBack={() => navigate(`/leagues/${leagueId}`)}
    >
      <div className="px-4 py-6 space-y-6 md:px-0 md:py-0">
        {/* Desktop Hero */}
        <div className="hidden md:block mb-12">
          <div className="text-center mb-16">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 via-orange-500 to-red-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <span className="text-2xl font-bold text-white relative z-10">🏆</span>
            </div>
            <h1 className="text-6xl font-black text-gradient mb-4 tracking-tight">
              Leaderboard
            </h1>
            <p className="text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
              League standings and performance metrics
            </p>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center justify-center space-x-2 mb-6">
          {sortOptions.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              onClick={() => setSortBy(value)}
              variant={sortBy === value ? 'default' : 'ghost'}
              size="sm"
              className="flex items-center"
            >
              <Icon size={16} className="mr-2" />
              {label}
            </Button>
          ))}
        </div>

        {/* Top 3 Podium */}
        {leaderboard && leaderboard.length >= 3 && sortBy === 'net_units' && (
          <Card className="p-6 mb-6">
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-premium flex items-center justify-center">
                <Trophy className="mr-2 text-yellow-500" />
                Top Performers
              </h3>
            </div>
            
            <div className="flex items-end justify-center space-x-4">
              {/* 2nd Place */}
              {leaderboard[1] && (
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-300 to-gray-500 rounded-2xl flex items-center justify-center mb-3 mx-auto">
                    <span className="text-white font-bold text-lg">2</span>
                  </div>
                  <div className="font-semibold text-premium text-sm">
                    {leaderboard[1].username || 'Anonymous'}
                  </div>
                  <div className="text-green-600 font-bold text-lg">
                    +{leaderboard[1].net_units.toFixed(1)}u
                  </div>
                </div>
              )}
              
              {/* 1st Place */}
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl flex items-center justify-center mb-3 mx-auto shadow-lg">
                  <Crown className="text-white w-8 h-8" />
                </div>
                <div className="font-bold text-premium">
                  {leaderboard[0].username || 'Anonymous'}
                </div>
                <div className="text-green-600 font-bold text-xl">
                  +{leaderboard[0].net_units.toFixed(1)}u
                </div>
                <div className="text-xs text-neutral-600 mt-1">
                  {formatWinPercentage(leaderboard[0].win_pct)} • {leaderboard[0].wins}W-{leaderboard[0].losses}L
                </div>
              </div>
              
              {/* 3rd Place */}
              {leaderboard[2] && (
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center mb-3 mx-auto">
                    <span className="text-white font-bold text-lg">3</span>
                  </div>
                  <div className="font-semibold text-premium text-sm">
                    {leaderboard[2].username || 'Anonymous'}
                  </div>
                  <div className="text-green-600 font-bold text-lg">
                    +{leaderboard[2].net_units.toFixed(1)}u
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Full Leaderboard */}
        {!leaderboard || leaderboard.length === 0 ? (
          <div className="text-center py-16">
            <EmptyState
              title="No standings yet"
              description="Rankings will appear after members make picks and events are graded"
              icon={<Trophy className="h-12 w-12 md:h-20 md:w-20" />}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((entry) => (
              <Card 
                key={entry.user_id} 
                className={`p-4 ${
                  entry.user_id === currentUser?.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mr-4 font-bold text-sm ${getRankBadgeColor(entry.rank)}`}>
                      {entry.rank <= 3 ? getRankIcon(entry.rank) : entry.rank}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center mb-1">
                        <h3 className="font-bold text-premium mr-2">
                          {entry.username || 'Anonymous'}
                        </h3>
                        {entry.user_id === currentUser?.id && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                            You
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-neutral-500">Record:</span>
                          <div className="font-semibold">
                            {entry.wins}W-{entry.losses}L{entry.pushes > 0 && `-${entry.pushes}P`}
                          </div>
                        </div>
                        <div>
                          <span className="text-neutral-500">Win %:</span>
                          <div className={`font-semibold ${getWinPercentageColor(entry.win_pct || 0)}`}>
                            {formatWinPercentage(entry.win_pct)}
                          </div>
                        </div>
                        <div>
                          <span className="text-neutral-500">Volume:</span>
                          <div className="font-semibold">
                            {(entry.units_risked || 0).toFixed(1)}u
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right ml-4">
                    <div className={`text-lg font-bold flex items-center ${
                      (entry.net_units || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(entry.net_units || 0) > 0 && <TrendingUp size={18} className="mr-1" />}
                      {(entry.net_units || 0) < 0 && <TrendingDown size={18} className="mr-1" />}
                      {(entry.net_units || 0) >= 0 ? '+' : ''}{(entry.net_units || 0).toFixed(1)}u
                    </div>
                    <div className="text-xs text-neutral-500">
                      {entry.graded} pick{entry.graded !== 1 ? 's' : ''} graded
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* League Stats Summary */}
        {leaderboard && leaderboard.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-bold text-premium mb-4 flex items-center">
              <BarChart3 className="mr-2" />
              League Summary
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-premium mb-1">
                  {leaderboard.length}
                </div>
                <div className="text-xs text-neutral-600">Active Members</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {leaderboard.reduce((sum, entry) => sum + entry.graded, 0)}
                </div>
                <div className="text-xs text-neutral-600">Total Picks</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {leaderboard.reduce((sum, entry) => sum + entry.units_risked, 0).toFixed(0)}u
                </div>
                <div className="text-xs text-neutral-600">Total Volume</div>
              </div>
              
              <div className="text-center">
                <div className={`text-2xl font-bold mb-1 ${
                  leaderboard.reduce((sum, entry) => sum + entry.net_units, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {leaderboard.reduce((sum, entry) => sum + entry.net_units, 0) >= 0 ? '+' : ''}
                  {leaderboard.reduce((sum, entry) => sum + entry.net_units, 0).toFixed(1)}u
                </div>
                <div className="text-xs text-neutral-600">Net League P&L</div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </MobileShell>
  );
}
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
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 2:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      case 3:
        return 'bg-orange-100 text-orange-800 border border-orange-200';
      default:
        return 'bg-gray-50 text-gray-700 border border-gray-200';
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
      activeTab="leaderboard"
      showBottomNav={false} 
      showDesktopSidebar={true}
      onBack={() => navigate(`/leagues/${leagueId}`)}
    >
      <div className="px-4 py-6 space-y-8 md:px-12 md:py-12">
        {/* Desktop Hero */}
        <div className="hidden md:block mb-8">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Leaderboard
            </h1>
            <p className="text-gray-600">
              League standings and performance metrics
            </p>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center justify-center space-x-1 mb-8">
          {sortOptions.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              onClick={() => setSortBy(value)}
              variant={sortBy === value ? 'default' : 'ghost'}
              size="sm"
              className={`flex items-center ${
                sortBy === value 
                  ? 'bg-gray-900 text-white hover:bg-gray-800' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon size={16} className="mr-2" />
              {label}
            </Button>
          ))}
        </div>


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
          <Card className="border-gray-200">
            <div className="space-y-0">
              {leaderboard.map((entry, index) => (
                <div 
                  key={entry.user_id} 
                  className={`p-4 border-b border-gray-100 last:border-0 ${
                    entry.user_id === currentUser?.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 font-medium text-sm ${getRankBadgeColor(entry.rank)}`}>
                        {entry.rank}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <h3 className="font-semibold text-gray-900 mr-2">
                            {entry.username || 'Anonymous'}
                          </h3>
                          {entry.user_id === currentUser?.id && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                              You
                            </span>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Record:</span>
                            <div className="font-medium text-gray-900">
                              {entry.wins}W-{entry.losses}L{entry.pushes > 0 && `-${entry.pushes}P`}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Win %:</span>
                            <div className={`font-medium ${getWinPercentageColor(entry.win_pct || 0)}`}>
                              {formatWinPercentage(entry.win_pct)}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Volume:</span>
                            <div className="font-medium text-gray-900">
                              {(entry.units_risked || 0).toFixed(1)}u
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${
                        (entry.net_units || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(entry.net_units || 0) >= 0 ? '+' : ''}{(entry.net_units || 0).toFixed(1)}u
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {entry.graded} pick{entry.graded !== 1 ? 's' : ''} graded
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
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
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  Target, 
  Clock, 
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  EyeOff,
  Upload as UploadIcon
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { EmptyState } from '../../components/UI/EmptyState';

interface Pick {
  id: string;
  event_id: string | null;
  market: string;
  side: string;
  line: number | null;
  odds_american: number;
  units_staked: number | null;
  result: string;
  profit_units: number;
  created_at: string;
  slip_id?: string | null;
  events?: {
    id: string;
    home_team: string;
    away_team: string;
    start_time: string;
    status: string;
    home_score?: number;
    away_score?: number;
  } | null;
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
          events(
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

  if (picksLoading) {
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
      activeTab="picks"
      showBottomNav={false} 
      showDesktopSidebar={true}
      onBack={() => navigate(`/leagues/${leagueId}`)}
    >
      <div className="px-4 py-6 space-y-8 md:px-12 md:py-12">
        {/* Desktop Hero */}
        <div className="hidden md:block mb-8">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              My Picks
            </h1>
            <p className="text-gray-600">
              Track your betting predictions and performance
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        {picks && picks.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="text-center p-4 border-gray-200">
              <div className="text-2xl font-semibold text-gray-900 mb-1">
                {picks.filter(p => p.result === 'pending').length}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </Card>
            <Card className="text-center p-4 border-gray-200">
              <div className="text-2xl font-semibold text-green-600 mb-1">
                {picks.filter(p => p.result === 'win').length}
              </div>
              <div className="text-sm text-gray-600">Wins</div>
            </Card>
            <Card className="text-center p-4 border-gray-200">
              <div className="text-2xl font-semibold text-red-600 mb-1">
                {picks.filter(p => p.result === 'loss').length}
              </div>
              <div className="text-sm text-gray-600">Losses</div>
            </Card>
          </div>
        )}


        {/* Filter Controls */}
        {picks && picks.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex space-x-1">
              {(['all', 'pending', 'completed'] as const).map((filterType) => (
                <Button
                  key={filterType}
                  onClick={() => setFilter(filterType)}
                  variant={filter === filterType ? 'default' : 'ghost'}
                  size="sm"
                  className={`capitalize ${
                    filter === filterType 
                      ? 'bg-gray-900 text-white hover:bg-gray-800' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {filterType}
                </Button>
              ))}
            </div>
            
            <Button
              onClick={() => setShowHidden(!showHidden)}
              variant="ghost"
              size="sm"
              className="flex items-center text-gray-600 hover:text-gray-900"
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
                "Upload your first betting slip to get started" :
                `You don't have any ${filter} picks`
              }
              icon={<Target className="h-12 w-12 md:h-20 md:w-20" />}
            />
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center mt-6">
              <Button
                onClick={() => navigate(`/leagues/${leagueId}/upload`)}
              >
                <UploadIcon size={20} className="mr-2" />
                Upload Betting Slip
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPicks.map((pick) => (
              <Card key={pick.id} className="p-6 border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 mr-3">
                        {pick.events ? 
                          `${pick.events.away_team} @ ${pick.events.home_team}` : 
                          `${pick.market.toUpperCase()}: ${pick.side}${pick.line ? ` ${pick.line}` : ''}`
                        }
                      </h3>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${getResultColor(pick.result)}`}>
                        {pick.result === 'pending' ? 'Pending' : pick.result.toUpperCase()}
                      </div>
                      {!pick.events && pick.slip_id && (
                        <div className="ml-2 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          From Slip
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Market:</span>
                        <div className="font-medium text-gray-900">{formatMarket(pick.market, pick.side, pick.line)}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Odds:</span>
                        <div className="font-medium text-gray-900">{formatOdds(pick.odds_american)}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Stake:</span>
                        <div className="font-medium text-gray-900">{pick.units_staked ? `${pick.units_staked}u` : '—'}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">P&L:</span>
                        <div className={`font-medium flex items-center ${
                          pick.profit_units > 0 ? 'text-green-600' : 
                          pick.profit_units < 0 ? 'text-red-600' : 'text-gray-600'
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

                <div className="flex items-center justify-between text-sm text-gray-600 pt-4 border-t border-gray-200">
                  <div className="flex items-center">
                    <Clock size={14} className="mr-1" />
                    {pick.events ? (
                      <>
                        {isStarted(pick.events.start_time) ? 'Started' : 'Starts'} {' '}
                        {new Date(pick.events.start_time).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </>
                    ) : (
                      <>
                        Created {new Date(pick.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </>
                    )}
                  </div>
                  
                  {pick.events?.status === 'final' && pick.events.home_score !== undefined && (
                    <div className="font-medium text-gray-900">
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
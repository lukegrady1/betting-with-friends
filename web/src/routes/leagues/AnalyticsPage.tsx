import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  Target,
  Users,
  Activity,
  Award
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { EmptyState } from '../../components/UI/EmptyState';

interface AnalyticsData {
  totalPicks: number;
  totalMembers: number;
  totalEvents: number;
  totalVolume: number;
  avgWinRate: number;
  topMarket: string;
  marketStats: MarketStat[];
  memberPerformance: MemberStat[];
  recentTrends: TrendData[];
}

interface MarketStat {
  market: string;
  total_picks: number;
  win_rate: number;
  avg_units: number;
  total_profit: number;
}

interface MemberStat {
  username: string;
  total_picks: number;
  win_rate: number;
  net_units: number;
  avg_bet_size: number;
}

interface TrendData {
  date: string;
  total_picks: number;
  wins: number;
  losses: number;
  net_units: number;
}

export function AnalyticsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'all'>('30d');

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['league-analytics', leagueId, timeframe],
    queryFn: async (): Promise<AnalyticsData> => {
      if (!leagueId) throw new Error('League ID required');

      const timeframeDays = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : null;
      const dateFilter = timeframeDays ? 
        new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000).toISOString() : 
        null;

      // Get basic stats
      const [picksRes, membersRes, eventsRes] = await Promise.all([
        supabase
          .from('picks')
          .select('*')
          .eq('league_id', leagueId)
          .gte('created_at', dateFilter || '1900-01-01'),
        supabase
          .from('league_members')
          .select('user_id')
          .eq('league_id', leagueId),
        supabase
          .from('events')
          .select('id, status')
          .eq('league_id', leagueId)
      ]);

      const picks = picksRes.data || [];
      const totalMembers = membersRes.data?.length || 0;
      const totalEvents = eventsRes.data?.length || 0;

      // Calculate market stats
      const marketGroups = picks.reduce((acc, pick) => {
        const market = pick.market;
        if (!acc[market]) {
          acc[market] = { picks: [], wins: 0, totalUnits: 0, totalProfit: 0 };
        }
        acc[market].picks.push(pick);
        acc[market].totalUnits += pick.units_staked;
        acc[market].totalProfit += pick.profit_units || 0;
        if (pick.result === 'win') acc[market].wins++;
        return acc;
      }, {} as Record<string, { picks: any[], wins: number, totalUnits: number, totalProfit: number }>);

      const marketStats: MarketStat[] = Object.entries(marketGroups).map(([market, groupData]) => {
        const data = groupData as { picks: any[], wins: number, totalUnits: number, totalProfit: number };
        return {
          market,
          total_picks: data.picks.length,
          win_rate: data.picks.length > 0 ? data.wins / data.picks.length : 0,
          avg_units: data.picks.length > 0 ? data.totalUnits / data.picks.length : 0,
          total_profit: data.totalProfit
        };
      });

      // Get member performance
      const { data: memberStats } = await supabase
        .from('league_user_stats')
        .select(`
          user_id,
          wins,
          losses,
          graded,
          win_pct,
          net_units,
          units_risked,
          profiles!inner(username)
        `)
        .eq('league_id', leagueId)
        .order('net_units', { ascending: false })
        .limit(10);

      const memberPerformance: MemberStat[] = memberStats?.map(member => ({
        username: (member.profiles as any)?.username || 'Anonymous',
        total_picks: member.graded || 0,
        win_rate: member.win_pct || 0,
        net_units: member.net_units || 0,
        avg_bet_size: member.graded > 0 ? (member.units_risked || 0) / member.graded : 0
      })) || [];

      // Calculate recent trends (simplified for demo)
      const recentTrends: TrendData[] = [];
      
      const totalVolume = picks.reduce((sum, pick) => sum + pick.units_staked, 0);
      const avgWinRate = picks.length > 0 ? 
        picks.filter(p => p.result === 'win').length / picks.filter(p => p.result !== 'pending').length :
        0;

      const topMarket = marketStats.length > 0 ? 
        marketStats.reduce((a, b) => a.total_picks > b.total_picks ? a : b).market :
        'None';

      return {
        totalPicks: picks.length,
        totalMembers,
        totalEvents,
        totalVolume,
        avgWinRate,
        topMarket,
        marketStats,
        memberPerformance,
        recentTrends
      };
    },
    enabled: !!leagueId,
  });

  const formatPercentage = (value: number) => `${Math.round(value * 100)}%`;
  const formatCurrency = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}u`;

  const getMarketIcon = (market: string) => {
    switch (market.toLowerCase()) {
      case 'moneyline': return '🎯';
      case 'spread': return '📊';
      case 'total': return '🔢';
      default: return '🎲';
    }
  };

  if (isLoading) {
    return (
      <MobileShell 
        title="Analytics" 
        showBottomNav={false} 
        showDesktopSidebar={true}
        onBack={() => navigate(`/leagues/${leagueId}`)}
      >
        <div className="px-4 py-8 text-center md:py-16">
          <div className="loading-spinner w-12 h-12 mx-auto mb-6"></div>
          <p className="text-lg font-medium text-gray-600">Analyzing data...</p>
        </div>
      </MobileShell>
    );
  }

  if (!analytics || analytics.totalPicks === 0) {
    return (
      <MobileShell 
        title="Analytics" 
        showBottomNav={false} 
        showDesktopSidebar={true}
        onBack={() => navigate(`/leagues/${leagueId}`)}
      >
        <div className="px-4 py-8 text-center md:py-16">
          <EmptyState
            title="No data yet"
            description="Analytics will appear after members make picks and events are completed"
            icon={<BarChart3 className="h-12 w-12 md:h-20 md:w-20" />}
          />
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell 
      title="Analytics" 
      activeTab="analytics"
      showBottomNav={false} 
      showDesktopSidebar={true}
      onBack={() => navigate(`/leagues/${leagueId}`)}
    >
      <div className="px-4 py-6 space-y-8 md:px-12 md:py-12">
        {/* Desktop Hero */}
        <div className="hidden md:block mb-8">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Analytics
            </h1>
            <p className="text-gray-600">
              Deep insights into league performance and trends
            </p>
          </div>
        </div>

        {/* Timeframe Filter */}
        <div className="flex items-center justify-center space-x-1 mb-8">
          {([
            { value: '7d', label: '7 Days' },
            { value: '30d', label: '30 Days' },
            { value: 'all', label: 'All Time' }
          ] as const).map(({ value, label }) => (
            <Button
              key={value}
              onClick={() => setTimeframe(value)}
              variant={timeframe === value ? 'default' : 'ghost'}
              size="sm"
              className={`${
                timeframe === value 
                  ? 'bg-gray-900 text-white hover:bg-gray-800' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="text-center p-6 border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {analytics.totalPicks}
            </div>
            <div className="text-sm text-gray-600">Total Picks</div>
          </Card>

          <Card className="text-center p-6 border-gray-200">
            <div className="text-2xl font-semibold text-green-600 mb-1">
              {formatPercentage(analytics.avgWinRate || 0)}
            </div>
            <div className="text-sm text-gray-600">Avg Win Rate</div>
          </Card>

          <Card className="text-center p-6 border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {analytics.totalVolume.toFixed(0)}u
            </div>
            <div className="text-sm text-gray-600">Total Volume</div>
          </Card>

          <Card className="text-center p-6 border-gray-200">
            <div className="text-2xl font-semibold text-gray-900 mb-1">
              {analytics.totalMembers}
            </div>
            <div className="text-sm text-gray-600">Active Members</div>
          </Card>
        </div>

        {/* Market Performance */}
        <Card className="p-6 border-gray-200">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Market Performance</h3>
            <p className="text-gray-600">Performance by betting market</p>
          </div>

          {analytics.marketStats.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500">No market data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {analytics.marketStats.map((market) => (
                <div key={market.market} className="glass p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{getMarketIcon(market.market)}</span>
                      <div>
                        <h4 className="font-semibold text-premium capitalize">{market.market}</h4>
                        <p className="text-sm text-neutral-600">{market.total_picks} picks</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold text-lg ${
                        market.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(market.total_profit)}
                      </div>
                      <div className="text-sm text-neutral-600">
                        {formatPercentage(market.win_rate)} win rate
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-neutral-500">Avg Bet Size:</span>
                      <div className="font-semibold">{market.avg_units.toFixed(1)}u</div>
                    </div>
                    <div>
                      <span className="text-neutral-500">ROI:</span>
                      <div className={`font-semibold ${
                        (market.total_profit / (market.avg_units * market.total_picks)) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatPercentage(market.total_profit / (market.avg_units * market.total_picks) || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top Performers */}
        <Card className="p-6">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl flex items-center justify-center mr-3">
              <Award size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-premium">Top Performers</h3>
              <p className="text-sm text-neutral-600">Best performing members</p>
            </div>
          </div>

          {analytics.memberPerformance.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
              <p className="text-neutral-500">No performance data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.memberPerformance.slice(0, 5).map((member, index) => (
                <div key={member.username} className="flex items-center justify-between p-3 glass rounded-xl">
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 text-white font-bold text-sm ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-500 to-yellow-600' :
                      index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-500' :
                      index === 2 ? 'bg-gradient-to-br from-orange-600 to-orange-700' :
                      'bg-neutral-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-premium">{member.username}</div>
                      <div className="text-sm text-neutral-600">
                        {member.total_picks} picks • {formatPercentage(member.win_rate)} win rate
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${
                      member.net_units >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(member.net_units)}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {member.avg_bet_size.toFixed(1)}u avg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* League Insights */}
        <Card className="p-6">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3">
              <Activity size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-premium">League Insights</h3>
              <p className="text-sm text-neutral-600">Key statistics and trends</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="glass p-4 rounded-xl text-center">
              <div className="text-2xl mb-2">🎯</div>
              <div className="font-semibold text-premium mb-1">Most Popular Market</div>
              <div className="text-lg font-bold text-blue-600 capitalize">{analytics.topMarket}</div>
            </div>

            <div className="glass p-4 rounded-xl text-center">
              <div className="text-2xl mb-2">📈</div>
              <div className="font-semibold text-premium mb-1">Average Bet Size</div>
              <div className="text-lg font-bold text-green-600">
                {analytics.totalPicks > 0 ? (analytics.totalVolume / analytics.totalPicks).toFixed(1) : 0}u
              </div>
            </div>

            <div className="glass p-4 rounded-xl text-center">
              <div className="text-2xl mb-2">🏆</div>
              <div className="font-semibold text-premium mb-1">League Activity</div>
              <div className="text-lg font-bold text-purple-600">
                {(analytics.totalPicks / Math.max(analytics.totalMembers, 1)).toFixed(1)} picks/member
              </div>
            </div>

            <div className="glass p-4 rounded-xl text-center">
              <div className="text-2xl mb-2">⚡</div>
              <div className="font-semibold text-premium mb-1">Event Coverage</div>
              <div className="text-lg font-bold text-orange-600">
                {analytics.totalEvents > 0 ? Math.round((analytics.totalPicks / analytics.totalEvents) * 100) / 100 : 0} picks/event
              </div>
            </div>
          </div>
        </Card>
      </div>
    </MobileShell>
  );
}
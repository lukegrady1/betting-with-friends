import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Target,
  Users,
  CheckCircle,
  Circle,
  AlertCircle,
  Zap,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { EmptyState } from '../../components/UI/EmptyState';
import { syncWeek, syncSeason } from '../../lib/functions';
import { useSeasonWeek, formatKickoff, formatTeamName } from '../../lib/nfl';

interface Event {
  id: string;
  sport: string;
  league_name?: string;
  home_team: string;
  away_team: string;
  start_time: string;
  status: 'scheduled' | 'final' | 'canceled';
  home_score?: number;
  away_score?: number;
  created_at: string;
  week?: number;
  season?: number;
  venue_name?: string;
  venue_city?: string;
  venue_state?: string;
  external_provider?: string;
  external_id?: string;
}

interface EventWithPickCount extends Event {
  pick_count: number;
  user_has_pick: boolean;
}

// Sync Controls Component
function SyncControls({ season, week, leagueId }: { season: number; week: number; leagueId: string }) {
  const queryClient = useQueryClient();
  
  const syncWeekMutation = useMutation({
    mutationFn: () => syncWeek({ season, week, leagueId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league-events', leagueId] });
    },
  });

  const syncSeasonMutation = useMutation({
    mutationFn: () => syncSeason({ season, leagueId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league-events', leagueId] });
    },
  });

  const anyPending = syncWeekMutation.isPending || syncSeasonMutation.isPending;
  const error = syncWeekMutation.error || syncSeasonMutation.error;

  return (
    <div className="flex flex-col items-end space-y-2">
      <div className="flex items-center space-x-2">
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={() => syncWeekMutation.mutate()} 
          disabled={anyPending} 
          className="rounded-xl"
        >
          <RefreshCw size={16} className={`mr-1 ${syncWeekMutation.isPending ? 'animate-spin' : ''}`} />
          {syncWeekMutation.isPending ? "Syncing…" : "Sync Week"}
        </Button>
        <Button 
          size="sm" 
          variant="secondary" 
          onClick={() => syncSeasonMutation.mutate()} 
          disabled={anyPending} 
          className="rounded-xl"
        >
          <RefreshCw size={16} className={`mr-1 ${syncSeasonMutation.isPending ? 'animate-spin' : ''}`} />
          {syncSeasonMutation.isPending ? "Syncing…" : "Sync Season"}
        </Button>
      </div>
      {error && (
        <div className="text-xs text-red-600 max-w-48 text-right">
          {error.message || 'Failed to sync'}
        </div>
      )}
    </div>
  );
}

export function EventsPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [season, week] = useSeasonWeek();

  const { data: events, isLoading } = useQuery({
    queryKey: ['league-events', leagueId],
    queryFn: async () => {
      if (!leagueId) return [];
      
      // Get events with pick counts, including NFL-specific fields
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          picks(count)
        `)
        .eq('league_id', leagueId)
        .order('start_time', { ascending: false });

      if (eventsError) throw eventsError;

      // Get user's picks for these events
      const { data: userPicksData } = await supabase
        .from('picks')
        .select('event_id')
        .eq('league_id', leagueId);

      const userEventIds = new Set(userPicksData?.map(p => p.event_id) || []);

      const eventsWithPickInfo = eventsData?.map(event => ({
        ...event,
        pick_count: event.picks?.length || 0,
        user_has_pick: userEventIds.has(event.id)
      })) as EventWithPickCount[];

      return eventsWithPickInfo || [];
    },
    enabled: !!leagueId,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ['user-league-role', leagueId],
    queryFn: async () => {
      if (!leagueId) return false;
      
      const { data, error } = await supabase
        .from('league_members')
        .select('role')
        .eq('league_id', leagueId)
        .single();

      if (error) return false;
      return data.role === 'admin';
    },
    enabled: !!leagueId,
  });

  const filteredEvents = events?.filter(event => {
    const now = new Date();
    const startTime = new Date(event.start_time);
    
    if (filter === 'upcoming') {
      return startTime > now && event.status === 'scheduled';
    }
    if (filter === 'completed') {
      return event.status === 'final' || startTime <= now;
    }
    return true;
  }) || [];

  const upcomingEvents = events?.filter(e => 
    new Date(e.start_time) > new Date() && e.status === 'scheduled'
  ) || [];

  const getStatusIcon = (event: Event) => {
    if (event.status === 'final') {
      return <CheckCircle size={16} className="text-green-600" />;
    }
    if (event.status === 'canceled') {
      return <AlertCircle size={16} className="text-red-600" />;
    }
    if (new Date(event.start_time) <= new Date()) {
      return <Zap size={16} className="text-yellow-600" />;
    }
    return <Circle size={16} className="text-blue-600" />;
  };

  const getStatusText = (event: Event) => {
    if (event.status === 'final') return 'Final';
    if (event.status === 'canceled') return 'Canceled';
    if (new Date(event.start_time) <= new Date()) return 'Live';
    return 'Scheduled';
  };

  const getStatusColor = (event: Event) => {
    if (event.status === 'final') return 'bg-green-100 text-green-800';
    if (event.status === 'canceled') return 'bg-red-100 text-red-800';
    if (new Date(event.start_time) <= new Date()) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  const canMakePick = (event: Event) => {
    return new Date(event.start_time) > new Date() && event.status === 'scheduled';
  };

  if (isLoading) {
    return (
      <MobileShell 
        title="Events" 
        showBottomNav={false} 
        showDesktopSidebar={true}
        onBack={() => navigate(`/leagues/${leagueId}`)}
      >
        <div className="px-4 py-8 text-center md:py-16">
          <div className="loading-spinner w-12 h-12 mx-auto mb-6"></div>
          <p className="text-lg font-medium text-gray-600">Loading events...</p>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell 
      title="Events" 
      showBottomNav={false} 
      showDesktopSidebar={true}
      onBack={() => navigate(`/leagues/${leagueId}`)}
      rightAction={isAdmin ? (
        <Button
          onClick={() => navigate(`/leagues/${leagueId}/events/create`)}
          size="sm"
        >
          <Plus size={16} className="mr-1" />
          Add Event
        </Button>
      ) : undefined}
    >
      <div className="px-4 py-6 space-y-6 md:px-0 md:py-0">
        {/* Desktop Hero */}
        <div className="hidden md:block mb-12">
          <div className="text-center mb-16">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <span className="text-2xl font-bold text-white relative z-10">📅</span>
            </div>
            <h1 className="text-6xl font-black text-gradient mb-4 tracking-tight">
              Events
            </h1>
            <p className="text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
              Browse upcoming games and betting opportunities
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        {events && events.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {upcomingEvents.length}
              </div>
              <div className="text-xs text-neutral-600 font-medium">Upcoming</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {events.filter(e => e.status === 'final').length}
              </div>
              <div className="text-xs text-neutral-600 font-medium">Completed</div>
            </Card>
            <Card className="text-center p-4">
              <div className="text-2xl font-bold text-premium mb-1">
                {events.reduce((sum, e) => sum + e.pick_count, 0)}
              </div>
              <div className="text-xs text-neutral-600 font-medium">Total Picks</div>
            </Card>
          </div>
        )}

        {/* Season Header and Controls */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-premium">NFL Schedule · {season}</h2>
            <p className="text-sm text-muted-foreground">Browse upcoming games and make your picks</p>
          </div>
          {isAdmin && leagueId && (
            <SyncControls season={season} week={week} leagueId={leagueId} />
          )}
        </div>

        {/* Filter Controls */}
        {events && events.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              {(['all', 'upcoming', 'completed'] as const).map((filterType) => (
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
            
            {isAdmin && (
              <Button
                onClick={() => navigate(`/leagues/${leagueId}/events/create`)}
                size="sm"
              >
                <Plus size={16} className="mr-2" />
                Add Event
              </Button>
            )}
          </div>
        )}

        {/* Events List */}
        {!filteredEvents || filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <EmptyState
              title={filter === 'all' ? "No events yet" : `No ${filter} events`}
              description={
                filter === 'all' 
                  ? "Events will appear here when they are added by league admins"
                  : `There are no ${filter} events at the moment`
              }
              icon={<Calendar className="h-12 w-12 md:h-20 md:w-20" />}
            />
            {isAdmin && (
              <Button
                onClick={() => navigate(`/leagues/${leagueId}/events/create`)}
                className="mt-6"
              >
                <Plus size={20} className="mr-2" />
                Add First Event
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <Card key={event.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <h3 className="text-lg font-bold text-premium mr-3">
                        {event.sport === 'NFL' ? formatTeamName(event.away_team) : event.away_team} @ {event.sport === 'NFL' ? formatTeamName(event.home_team) : event.home_team}
                      </h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center ${getStatusColor(event)}`}>
                        {getStatusIcon(event)}
                        <span className="ml-1">{getStatusText(event)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex items-center text-muted-foreground">
                        <Clock size={14} className="mr-2" />
                        {event.sport === 'NFL' ? formatKickoff(event.start_time) : new Date(event.start_time).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric', 
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </div>
                      
                      {event.venue_name && (
                        <div className="flex items-center text-muted-foreground">
                          <MapPin size={14} className="mr-2" />
                          {event.venue_name}
                          {event.venue_city && ` • ${event.venue_city}${event.venue_state ? `, ${event.venue_state}` : ''}`}
                        </div>
                      )}
                      
                      <div className="flex items-center text-muted-foreground">
                        <Users size={14} className="mr-2" />
                        {event.pick_count} pick{event.pick_count !== 1 ? 's' : ''} made
                      </div>
                    </div>

                    {/* Final Score */}
                    {event.status === 'final' && event.home_score !== undefined && (
                      <div className="glass p-3 rounded-xl mb-4">
                        <div className="text-center">
                          <div className="text-sm text-neutral-600 mb-1">Final Score</div>
                          <div className="text-lg font-bold text-premium">
                            {event.away_team} {event.away_score} - {event.home_score} {event.home_team}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
                  <div className="flex items-center space-x-2">
                    {event.user_has_pick && (
                      <div className="flex items-center text-green-600 text-sm font-medium">
                        <CheckCircle size={14} className="mr-1" />
                        You have a pick
                      </div>
                    )}
                    {!event.user_has_pick && canMakePick(event) && (
                      <div className="flex items-center text-blue-600 text-sm font-medium">
                        <Target size={14} className="mr-1" />
                        Available for picks
                      </div>
                    )}
                  </div>
                  
                  <div className="flex space-x-2">
                    {canMakePick(event) && !event.user_has_pick && (
                      <Button
                        onClick={() => navigate(`/leagues/${leagueId}/picks/new?event=${event.id}`)}
                        size="sm"
                        className="rounded-xl"
                      >
                        Select
                        <Target size={16} className="ml-2" />
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => navigate(`/leagues/${leagueId}/events/${event.id}`)}
                      variant="outline"
                      size="sm"
                    >
                      View Details
                    </Button>
                    
                    {isAdmin && (
                      <Button
                        onClick={() => navigate(`/leagues/${leagueId}/events/${event.id}/edit`)}
                        variant="ghost"
                        size="sm"
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
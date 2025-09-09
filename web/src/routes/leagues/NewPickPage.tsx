import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Target, Clock, MapPin, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { formatKickoff, formatTeamName } from '../../lib/nfl';

interface Event {
  id: string;
  sport: string;
  league_name?: string;
  home_team: string;
  away_team: string;
  start_time: string;
  status: string;
  venue_name?: string;
  venue_city?: string;
  venue_state?: string;
}

interface PickFormData {
  market: 'moneyline' | 'spread' | 'total';
  side: string;
  line?: number;
  oddsAmerican: number;
  unitsStaked: number;
}

export function NewPickPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const eventId = new URLSearchParams(location.search).get('event');
  
  const [formData, setFormData] = useState<PickFormData>({
    market: 'moneyline',
    side: 'home',
    oddsAmerican: -110,
    unitsStaked: 1.0
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch the event details
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (error) throw error;
      return data as Event;
    },
    enabled: !!eventId,
  });

  // Create pick mutation
  const { mutate: createPick, isPending } = useMutation({
    mutationFn: async (pickData: PickFormData) => {
      if (!leagueId || !eventId) throw new Error('Missing league or event ID');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('picks')
        .insert({
          league_id: leagueId,
          event_id: eventId,
          user_id: user.id,
          market: pickData.market,
          side: pickData.side,
          line: pickData.line || null,
          odds_american: pickData.oddsAmerican,
          units_staked: pickData.unitsStaked,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league-events', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['picks', leagueId] });
      navigate(`/leagues/${leagueId}/picks`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    
    if (!formData.unitsStaked || formData.unitsStaked <= 0) {
      newErrors.unitsStaked = 'Units must be greater than 0';
    }
    
    if (!formData.oddsAmerican) {
      newErrors.oddsAmerican = 'Odds are required';
    }
    
    if (formData.market === 'spread' || formData.market === 'total') {
      if (formData.line === undefined || formData.line === null) {
        newErrors.line = 'Line is required for spread and total bets';
      }
    }

    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      createPick(formData);
    }
  };

  const handleInputChange = (field: keyof PickFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Check if event has started
  const eventHasStarted = event ? new Date(event.start_time) <= new Date() : false;

  if (eventLoading) {
    return (
      <MobileShell 
        title="New Pick" 
        onBack={() => navigate(`/leagues/${leagueId}/events`)}
        showBottomNav={false}
      >
        <div className="px-4 py-8 text-center">
          <div className="loading-spinner w-12 h-12 mx-auto mb-6"></div>
          <p className="text-lg font-medium text-gray-600">Loading event...</p>
        </div>
      </MobileShell>
    );
  }

  if (!event) {
    return (
      <MobileShell 
        title="Event Not Found" 
        onBack={() => navigate(`/leagues/${leagueId}/events`)}
        showBottomNav={false}
      >
        <div className="px-4 py-8 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Event Not Found</h2>
          <p className="text-gray-600 mb-6">The event you're trying to bet on could not be found.</p>
          <Button onClick={() => navigate(`/leagues/${leagueId}/events`)}>
            <ArrowLeft size={16} className="mr-2" />
            Back to Events
          </Button>
        </div>
      </MobileShell>
    );
  }

  if (eventHasStarted) {
    return (
      <MobileShell 
        title="Event Started" 
        onBack={() => navigate(`/leagues/${leagueId}/events`)}
        showBottomNav={false}
      >
        <div className="px-4 py-8 text-center">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Event Has Started</h2>
          <p className="text-gray-600 mb-6">You can no longer place picks on this event.</p>
          <Button onClick={() => navigate(`/leagues/${leagueId}/events`)}>
            <ArrowLeft size={16} className="mr-2" />
            Back to Events
          </Button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell 
      title="New Pick" 
      onBack={() => navigate(`/leagues/${leagueId}/events`)}
      showBottomNav={false}
    >
      <div className="px-4 py-6 space-y-6">
        {/* Event Details */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-premium mb-3">
            {event.sport === 'NFL' ? formatTeamName(event.away_team) : event.away_team} @ {event.sport === 'NFL' ? formatTeamName(event.home_team) : event.home_team}
          </h2>
          
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center">
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
              <div className="flex items-center">
                <MapPin size={14} className="mr-2" />
                {event.venue_name}
                {event.venue_city && ` • ${event.venue_city}${event.venue_state ? `, ${event.venue_state}` : ''}`}
              </div>
            )}
          </div>
        </Card>

        {/* Pick Form */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-premium mb-4">Make Your Pick</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Market Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bet Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['moneyline', 'spread', 'total'] as const).map((market) => (
                  <Button
                    key={market}
                    type="button"
                    onClick={() => handleInputChange('market', market)}
                    variant={formData.market === market ? 'default' : 'outline'}
                    size="sm"
                    className="capitalize"
                  >
                    {market}
                  </Button>
                ))}
              </div>
            </div>

            {/* Side Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Side
              </label>
              <div className="grid grid-cols-2 gap-2">
                {formData.market === 'moneyline' ? (
                  <>
                    <Button
                      type="button"
                      onClick={() => handleInputChange('side', 'away')}
                      variant={formData.side === 'away' ? 'default' : 'outline'}
                      size="sm"
                    >
                      {event.sport === 'NFL' ? formatTeamName(event.away_team) : event.away_team}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleInputChange('side', 'home')}
                      variant={formData.side === 'home' ? 'default' : 'outline'}
                      size="sm"
                    >
                      {event.sport === 'NFL' ? formatTeamName(event.home_team) : event.home_team}
                    </Button>
                  </>
                ) : formData.market === 'spread' ? (
                  <>
                    <Button
                      type="button"
                      onClick={() => handleInputChange('side', 'away')}
                      variant={formData.side === 'away' ? 'default' : 'outline'}
                      size="sm"
                    >
                      {event.sport === 'NFL' ? formatTeamName(event.away_team) : event.away_team}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleInputChange('side', 'home')}
                      variant={formData.side === 'home' ? 'default' : 'outline'}
                      size="sm"
                    >
                      {event.sport === 'NFL' ? formatTeamName(event.home_team) : event.home_team}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      onClick={() => handleInputChange('side', 'over')}
                      variant={formData.side === 'over' ? 'default' : 'outline'}
                      size="sm"
                    >
                      Over
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleInputChange('side', 'under')}
                      variant={formData.side === 'under' ? 'default' : 'outline'}
                      size="sm"
                    >
                      Under
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* Line (for spread and total) */}
            {(formData.market === 'spread' || formData.market === 'total') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Line {formData.market === 'spread' ? '(Spread)' : '(Total Points)'}
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={formData.line || ''}
                  onChange={(e) => handleInputChange('line', parseFloat(e.target.value))}
                  placeholder={formData.market === 'spread' ? 'e.g., -3.5' : 'e.g., 44.5'}
                  className="w-full"
                />
                {errors.line && (
                  <p className="text-red-600 text-xs mt-1">{errors.line}</p>
                )}
              </div>
            )}

            {/* Odds */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Odds (American)
              </label>
              <Input
                type="number"
                value={formData.oddsAmerican || ''}
                onChange={(e) => handleInputChange('oddsAmerican', parseInt(e.target.value))}
                placeholder="e.g., -110 or +150"
                className="w-full"
              />
              {errors.oddsAmerican && (
                <p className="text-red-600 text-xs mt-1">{errors.oddsAmerican}</p>
              )}
            </div>

            {/* Units */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Units to Stake
              </label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={formData.unitsStaked || ''}
                onChange={(e) => handleInputChange('unitsStaked', parseFloat(e.target.value))}
                placeholder="e.g., 1.0"
                className="w-full"
              />
              {errors.unitsStaked && (
                <p className="text-red-600 text-xs mt-1">{errors.unitsStaked}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full h-11 rounded-xl"
              >
                <Target size={16} className="mr-2" />
                {isPending ? 'Placing Pick...' : 'Place Pick'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </MobileShell>
  );
}
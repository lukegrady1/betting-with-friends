import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, 
  Clock, 
  Users,
  Save,
  AlertCircle,
  X,
  Trophy,
  Target
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { Input } from '../../components/UI/Input';
import { Label } from '../../components/UI/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/UI/Select';
import { Badge } from '../../components/UI/Badge';
import Spinner, { SpinnerInline } from '../../components/UI/Spinner';

interface CreateEventForm {
  sport: string;
  league_name: string;
  home_team: string;
  away_team: string;
  start_time: string;
}

export function CreateEventPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState<CreateEventForm>({
    sport: '',
    league_name: '',
    home_team: '',
    away_team: '',
    start_time: ''
  });
  
  const [errors, setErrors] = useState<Partial<CreateEventForm>>({});

  // Check if user is admin
  const { data: isAdmin, isLoading: adminLoading } = useQuery({
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

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (eventData: CreateEventForm) => {
      if (!leagueId) throw new Error('League ID required');

      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user?.id) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('events')
        .insert({
          league_id: leagueId,
          sport: eventData.sport,
          league_name: eventData.league_name || null,
          home_team: eventData.home_team,
          away_team: eventData.away_team,
          start_time: eventData.start_time,
          status: 'scheduled',
          created_by: session.session.user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch events
      queryClient.invalidateQueries({ queryKey: ['league-events', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['available-events', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['recent-events', leagueId] });
      
      // Navigate back to events page
      navigate(`/leagues/${leagueId}/events`);
    },
  });

  const handleInputChange = (field: keyof CreateEventForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<CreateEventForm> = {};

    if (!form.sport.trim()) {
      newErrors.sport = 'Sport is required';
    }

    if (!form.home_team.trim()) {
      newErrors.home_team = 'Home team is required';
    }

    if (!form.away_team.trim()) {
      newErrors.away_team = 'Away team is required';
    }

    if (form.home_team.trim() === form.away_team.trim()) {
      newErrors.home_team = 'Home and away teams must be different';
      newErrors.away_team = 'Home and away teams must be different';
    }

    if (!form.start_time) {
      newErrors.start_time = 'Start time is required';
    } else {
      const startTime = new Date(form.start_time);
      const now = new Date();
      if (startTime <= now) {
        newErrors.start_time = 'Start time must be in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    createEventMutation.mutate(form);
  };

  // Set default date/time (1 hour from now)
  React.useEffect(() => {
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    oneHourFromNow.setMinutes(0, 0, 0); // Round to nearest hour
    
    const defaultDateTime = oneHourFromNow.toISOString().slice(0, 16);
    setForm(prev => ({ ...prev, start_time: defaultDateTime }));
  }, []);

  if (adminLoading) {
    return (
      <MobileShell 
        title="Create Event" 
        showBottomNav={false} 
        showDesktopSidebar={true}
        onBack={() => navigate(`/leagues/${leagueId}/events`)}
      >
        <div className="px-4 py-8 text-center md:py-16">
          <Spinner />
          <p className="text-lg font-medium text-muted-foreground">Loading...</p>
        </div>
      </MobileShell>
    );
  }

  if (!isAdmin) {
    return (
      <MobileShell 
        title="Access Denied" 
        showBottomNav={false} 
        showDesktopSidebar={true}
        onBack={() => navigate(`/leagues/${leagueId}/events`)}
      >
        <div className="px-4 py-8 text-center md:py-16">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-premium mb-4">Access Denied</h2>
          <p className="text-neutral-600 mb-6">
            Only league administrators can create events.
          </p>
          <Button onClick={() => navigate(`/leagues/${leagueId}/events`)}>
            Back to Events
          </Button>
        </div>
      </MobileShell>
    );
  }

  const commonSports = [
    'NFL', 'NBA', 'MLB', 'NHL', 'NCAA Football', 'NCAA Basketball',
    'Premier League', 'Champions League', 'La Liga', 'Bundesliga',
    'UFC', 'Boxing', 'Tennis', 'Golf'
  ];

  return (
    <MobileShell 
      title="Create Event" 
      showBottomNav={false} 
      showDesktopSidebar={true}
      onBack={() => navigate(`/leagues/${leagueId}/events`)}
    >
      <div className="px-4 py-6 space-y-6 md:px-0 md:py-0">
        {/* Desktop Hero */}
        <div className="hidden md:block mb-12">
          <div className="text-center mb-16">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
              <span className="text-2xl font-bold text-white relative z-10">➕</span>
            </div>
            <h1 className="text-6xl font-black text-gradient mb-4 tracking-tight">
              Create Event
            </h1>
            <p className="text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
              Add a new betting event for your league members
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sport & League */}
          <Card>
            <CardHeader>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mr-3">
                  <Trophy size={18} className="text-white" />
                </div>
                <div>
                  <CardTitle>Event Details</CardTitle>
                  <CardDescription>Basic event information</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="sport" className="form-label">Sport *</Label>
                <Select value={form.sport} onValueChange={(value) => handleInputChange('sport', value)}>
                  <SelectTrigger className={errors.sport ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select a sport" />
                  </SelectTrigger>
                  <SelectContent>
                    {commonSports.map(sport => (
                      <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.sport && (
                  <p className="text-red-600 text-sm">{errors.sport}</p>
                )}
              </div>

              {form.sport === 'Other' && (
                <div className="space-y-2">
                  <Label htmlFor="custom-sport">Custom Sport Name *</Label>
                  <Input
                    id="custom-sport"
                    type="text"
                    value={form.sport === 'Other' ? '' : form.sport}
                    onChange={(e) => handleInputChange('sport', e.target.value)}
                    className={errors.sport ? 'border-red-500' : ''}
                    placeholder="Enter sport name"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="league-name" className="form-label">League/Competition</Label>
                <Input
                  id="league-name"
                  type="text"
                  value={form.league_name}
                  onChange={(e) => handleInputChange('league_name', e.target.value)}
                  placeholder="e.g., Week 10, Regular Season, etc. (optional)"
                />
                <p className="text-sm text-slate-500">
                  Optional additional context for the event
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Teams */}
          <Card>
            <CardHeader>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mr-3">
                  <Users size={18} className="text-white" />
                </div>
                <div>
                  <CardTitle>Matchup</CardTitle>
                  <CardDescription>Teams or participants</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="away-team" className="form-label">Away Team/Player *</Label>
                <Input
                  id="away-team"
                  type="text"
                  value={form.away_team}
                  onChange={(e) => handleInputChange('away_team', e.target.value)}
                  className={errors.away_team ? 'border-red-500' : ''}
                  placeholder="Visiting team or player"
                />
                {errors.away_team && (
                  <p className="text-red-600 text-sm">{errors.away_team}</p>
                )}
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-slate-400">@</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="home-team" className="form-label">Home Team/Player *</Label>
                <Input
                  id="home-team"
                  type="text"
                  value={form.home_team}
                  onChange={(e) => handleInputChange('home_team', e.target.value)}
                  className={errors.home_team ? 'border-red-500' : ''}
                  placeholder="Home team or player"
                />
                {errors.home_team && (
                  <p className="text-red-600 text-sm">{errors.home_team}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center mr-3">
                  <Calendar size={18} className="text-white" />
                </div>
                <div>
                  <CardTitle>Schedule</CardTitle>
                  <CardDescription>When the event takes place</CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="start-time" className="form-label">Start Date & Time *</Label>
                <Input
                  id="start-time"
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(e) => handleInputChange('start_time', e.target.value)}
                  className={errors.start_time ? 'border-red-500' : ''}
                />
                {errors.start_time && (
                  <p className="text-red-600 text-sm">{errors.start_time}</p>
                )}
                <p className="text-sm text-slate-500">
                  Members can make picks until this time
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          {form.home_team && form.away_team && (
            <Card>
              <CardHeader>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mr-3">
                    <Target size={18} className="text-white" />
                  </div>
                  <div>
                    <CardTitle>Preview</CardTitle>
                    <CardDescription>How your event will appear</CardDescription>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-xl border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-slate-900">
                        {form.away_team} @ {form.home_team}
                      </h4>
                      {form.sport && (
                        <p className="text-sm text-slate-600">
                          {form.sport}{form.league_name && ` • ${form.league_name}`}
                        </p>
                      )}
                    </div>
                    <Badge variant="info">Scheduled</Badge>
                  </div>
                  
                  {form.start_time && (
                    <div className="flex items-center text-sm text-slate-600">
                      <Clock size={14} className="mr-1" />
                      {new Date(form.start_time).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {createEventMutation.error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                  <div>
                    <h4 className="font-semibold text-red-800">Error Creating Event</h4>
                    <p className="text-red-700 text-sm">
                      {createEventMutation.error.message}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate(`/leagues/${leagueId}/events`)}
              disabled={createEventMutation.isPending}
            >
              <X size={20} className="mr-2" />
              Cancel
            </Button>
            
            <Button
              type="submit"
              className="flex-1"
              disabled={createEventMutation.isPending}
            >
              {createEventMutation.isPending ? (
                <>
                  <SpinnerInline />
                  Creating...
                </>
              ) : (
                <>
                  <Save size={20} className="mr-2" />
                  Create Event
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </MobileShell>
  );
}
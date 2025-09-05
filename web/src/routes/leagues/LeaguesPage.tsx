import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { League } from '../../lib/types';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Button } from '../../components/UI/Button';
import { LeagueCard } from '../../components/UI/LeagueCard';
import { SkeletonCard } from '../../components/UI/SkeletonCard';
import Spinner from '../../components/UI/Spinner';

export function LeaguesPage() {
  const navigate = useNavigate();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  const { data: leagues, isLoading } = useQuery({
    queryKey: ['leagues'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as League[];
    },
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const openCreate = () => {
    navigate('/leagues/create');
  };

  const openJoin = () => {
    navigate('/leagues/join');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Add toast notification "Copied"
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <MobileShell 
      title="My Leagues" 
      showBottomNav={false}
      showDesktopSidebar={true}
      rightAction={
        <button
          onClick={handleSignOut}
          className="p-2 text-gray-600 hover:text-gray-900 transition-colors focus-ring rounded-lg"
        >
          <LogOut size={20} />
        </button>
      }
    >
      <div className="container-responsive space-y-4 pb-24">
        <header className="sticky top-0 z-20 -mx-3 mb-2 bg-background/80 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h1 className="text-3xl font-bold">My Leagues</h1>
          <p className="text-sm text-muted-foreground">Create or join a league and start logging your picks.</p>
        </header>

        {isLoading && (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {!isLoading && (!leagues || leagues.length === 0) && (
          <div className="card soft grid place-items-center gap-2 p-8 text-center">
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Users className="h-5 w-5"/>
            </div>
            <h3 className="text-lg font-semibold">No leagues yet</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create a league and invite friends with a code. Picks stay hidden until each game starts.
            </p>
            <div className="mt-2 flex gap-2">
              <Button onClick={openCreate} className="rounded-xl">Create League</Button>
              <Button variant="secondary" onClick={openJoin} className="rounded-xl">Join League</Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {!isLoading && leagues?.map(league => (
            <LeagueCard 
              key={league.id}
              name={league.name}
              inviteCode={league.invite_code}
              createdAt={formatDate(league.created_at)}
              active={true}
              onOpen={() => navigate(`/leagues/${league.id}`)}
              onCopy={() => copyToClipboard(league.invite_code)}
            />
          ))}
        </div>

        {/* Mobile CTA bar */}
        <div className="sticky bottom-3 z-30 grid grid-cols-2 gap-3 md:hidden">
          <Button className="h-11 rounded-xl" onClick={openCreate}>+ Create League</Button>
          <Button variant="secondary" className="h-11 rounded-xl" onClick={openJoin}>
            <Users className="mr-2 h-4 w-4"/>Join
          </Button>
        </div>
      </div>
    </MobileShell>
  );
}
import { Trophy, ArrowRight, Copy } from "lucide-react";
import { Card } from "./Card";
import { Button } from "./Button";

interface LeagueCardProps {
  name: string;
  inviteCode: string;
  createdAt: string;
  active?: boolean;
  onOpen: () => void;
  onCopy: () => void;
}

export function LeagueCard({ name, inviteCode, createdAt, active, onOpen, onCopy }: LeagueCardProps) {
  return (
    <Card className="soft hover:-translate-y-0.5 transition-all duration-200 grid grid-cols-[1fr_auto] items-center gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Trophy className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="truncate">{name}</span>
            {active && <span className="badge border-accent/50 bg-accent/15 text-accent">Active League</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <button 
              onClick={onCopy} 
              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 hover:bg-muted transition-colors focus-ring"
            >
              <Copy className="h-3.5 w-3.5" /> {inviteCode}
            </button>
            <span>Created {createdAt}</span>
          </div>
        </div>
      </div>
      <Button onClick={onOpen} size="sm" className="rounded-xl h-10 w-10 p-0">
        <ArrowRight className="h-5 w-5" />
      </Button>
    </Card>
  );
}
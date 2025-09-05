# Betting With Friends

A mobile-first web application for tracking sports betting picks privately among friends.

## Features

- **Private picks until kickoff**: Picks remain hidden from other players until the event starts
- **League management**: Create and join leagues with invite codes
- **Multiple bet types**: Moneyline, spread, and total bets with American odds
- **Automatic grading**: Picks are automatically scored when events are finalized
- **Leaderboards**: Track wins, losses, win percentage, units risked, and profit/loss
- **Mobile-first design**: Optimized for mobile devices with touch-friendly interface

## Tech Stack

- **Frontend**: Vite + React + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Backend**: Supabase (PostgreSQL + Authentication + Row Level Security)
- **Deployment**: GitHub Pages

## Development Setup

### Prerequisites

- Node.js 20+ 
- Supabase account

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/betting-with-friends.git
   cd betting-with-friends
   ```

2. **Set up Supabase**
   - Create a new project in [Supabase](https://supabase.com)
   - Run the SQL migrations found in `supabase/migrations/` in your Supabase SQL editor:
     - `000_init.sql` - Creates tables
     - `010_rls.sql` - Sets up Row Level Security
     - `020_functions_and_views.sql` - Creates functions and views

3. **Configure environment**
   ```bash
   cd web
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Install dependencies and start development server**
   ```bash
   npm install
   npm run dev
   ```

The app will be available at `http://localhost:5173`

## Database Schema

The application uses the following main tables:

- `profiles` - User profiles
- `leagues` - Betting leagues
- `league_members` - League membership with roles
- `events` - Sports events/games
- `picks` - User betting picks
- `picks_visible` - View that handles pick privacy
- `league_user_stats` - Leaderboard statistics

## Security Features

- **Row Level Security (RLS)**: Database-level security ensures users can only access leagues they belong to
- **Pick Privacy**: Picks are automatically hidden from other users until event start time
- **Role-based Access**: League admins can manage events and settings
- **Authentication**: Secure email-based authentication via Supabase

## Deployment

The app is automatically deployed to GitHub Pages when changes are pushed to the main branch.

To deploy manually:
```bash
cd web
npm run build
```

The built files will be in `web/dist/` and can be deployed to any static hosting service.

## Usage

1. **Sign Up/Sign In**: Use email-based authentication
2. **Create or Join League**: Create a new league or join with an invite code
3. **Add Events**: League admins can add sports events
4. **Make Picks**: Submit picks before event start time
5. **View Results**: Picks are automatically graded and leaderboards updated

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
# Betting With Friends

A mobile-first web application for tracking sports betting picks privately among friends.

## Features

- **Private picks until kickoff**: Picks remain hidden from other players until the event starts
- **League management**: Create and join leagues with invite codes
- **NFL Integration**: Automatic NFL schedule sync with SportsDataIO API
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
     - `030_events_nfl_integration.sql` - Adds NFL integration support

3. **Set up SportsDataIO API (Optional - for NFL integration)**
   - Sign up for a free account at [SportsDataIO](https://sportsdata.io/)
   - Get your API key from the dashboard
   - You'll need to configure this in your Supabase Edge Functions environment

4. **Deploy Supabase Edge Functions**
   ```bash
   # Install Supabase CLI if you haven't already
   npm install -g supabase
   
   # Login to Supabase
   supabase login
   
   # Link your project
   supabase link --project-ref your_project_ref
   
   # Deploy the NFL sync function
   supabase functions deploy nfl-sync-week
   
   # Set the SportsDataIO API key as an environment secret
   supabase secrets set SPORTSDATAIO_API_KEY=your_api_key_here
   ```

5. **Configure environment**
   ```bash
   cd web
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your configuration:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_PUBLIC_FUNCTIONS_URL=https://your_project_ref.supabase.co/functions/v1
   ```

6. **Install dependencies and start development server**
   ```bash
   npm install
   npm run dev
   ```

The app will be available at `http://localhost:5173`

## NFL Integration

The app includes automatic NFL schedule synchronization using the SportsDataIO API. Features include:

- **Automatic Schedule Sync**: League admins can sync current NFL week games with venue information
- **Team Name Formatting**: Displays full team names (e.g., "Patriots" instead of "NE")  
- **Season/Week Tracking**: Automatically calculates current NFL season and week
- **Venue Information**: Shows stadium names, cities, and states
- **Rate Limiting**: Prevents excessive API calls with 1-hour cooldown periods

### How NFL Sync Works

1. League admins see a "Sync NFL Week" button on the Events page
2. Clicking the button calls the `nfl-sync-week` Supabase Edge Function
3. The function fetches current week games from SportsDataIO API
4. Games are upserted into the `events` table with venue and team information
5. Users can then make picks on the synchronized games

### NFL Sync Requirements

- SportsDataIO API key configured in Supabase Edge Functions
- League admin permissions
- Edge Function deployed to Supabase

## Database Schema

The application uses the following main tables:

- `profiles` - User profiles
- `leagues` - Betting leagues
- `league_members` - League membership with roles
- `events` - Sports events/games (includes NFL venue fields and external provider tracking)
- `picks` - User betting picks
- `picks_visible` - View that handles pick privacy
- `league_user_stats` - Leaderboard statistics
- `sync_log` - Tracks NFL API sync operations and rate limiting

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
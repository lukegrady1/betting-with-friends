import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { getSlipWithLegs, type Slip } from '../../lib/slips';
import { MobileShell } from '../../components/Layout/MobileShell';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { PicksUpload } from './PicksUpload';

export function SlipUploadPage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Get current user session
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  // Get recent slips for this user and league
  const { data: recentSlips = [] } = useQuery({
    queryKey: ['recent-slips', leagueId],
    queryFn: async () => {
      if (!leagueId || !session?.user) return [];
      
      const { data, error } = await supabase
        .from('slips')
        .select('*')
        .eq('league_id', leagueId)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (error) throw error;
      return data as Slip[];
    },
    enabled: !!leagueId && !!session?.user,
  });

  const handleSlipSuccess = () => {
    // Refetch recent slips and picks data
    queryClient.invalidateQueries({ queryKey: ['recent-slips', leagueId] });
    queryClient.invalidateQueries({ queryKey: ['my-picks', leagueId] });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'parsed':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'queued':
        return 'Queued';
      case 'processing':
        return 'Processing';
      case 'parsed':
        return 'Ready to Review';
      case 'failed':
        return 'Failed';
      case 'confirmed':
        return 'Confirmed';
      default:
        return status;
    }
  };

  return (
    <MobileShell 
      title="Upload Betting Slips" 
      activeTab="upload"
      showBottomNav={false} 
      showDesktopSidebar={true}
      onBack={() => navigate(`/leagues/${leagueId}`)}
    >
      <div className="px-4 py-6 space-y-8 md:px-12 md:py-12">
        {/* Desktop Hero */}
        <div className="hidden md:block mb-8">
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Upload Slips
            </h1>
            <p className="text-gray-600">
              Upload photos of your betting slips for automatic processing
            </p>
          </div>
        </div>

        {/* Upload Section */}
        {leagueId && (
          <PicksUpload
            leagueId={leagueId}
            onSuccess={handleSlipSuccess}
          />
        )}

        {/* Recent Slips */}
        {recentSlips.length > 0 && (
          <Card className="p-6 border-gray-200">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Recent Uploads</h3>
            </div>
            
            <div className="space-y-3">
              {recentSlips.map((slip) => (
                <div key={slip.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="font-medium text-gray-900">
                      {new Date(slip.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(slip.status)}`}>
                        {getStatusText(slip.status)}
                      </span>
                      {slip.error && (
                        <span className="text-red-600 text-xs">
                          {slip.error}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    {slip.status === 'parsed' && (
                      <Button
                        onClick={async () => {
                          const slipData = await getSlipWithLegs(slip.id);
                          if (slipData && slipData.legs.length > 0) {
                            window.location.reload();
                          }
                        }}
                        size="sm"
                        className="border-gray-300 hover:border-gray-400"
                        variant="outline"
                      >
                        Review
                      </Button>
                    )}
                    
                    {slip.status === 'failed' && (
                      <Button
                        onClick={() => {
                          console.log('Retry parsing for slip:', slip.id);
                        }}
                        variant="outline"
                        size="sm"
                        className="border-gray-300 hover:border-gray-400"
                      >
                        Retry
                      </Button>
                    )}
                    
                    {slip.status === 'confirmed' && (
                      <Button
                        onClick={() => navigate(`/leagues/${leagueId}/picks`)}
                        variant="ghost"
                        size="sm"
                        className="text-gray-600 hover:text-gray-900"
                      >
                        View Picks
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Help Section */}
        <Card className="p-6 border-gray-200 bg-gray-50">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tips for Best Results</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>• Take clear, well-lit photos of your betting slips</li>
              <li>• Ensure all text is readable and not blurry</li>
              <li>• Include the entire slip with stakes and odds visible</li>
              <li>• Supported formats: PNG, JPG, WebP, HEIC</li>
              <li>• Maximum file size: 5MB</li>
            </ul>
          </div>
        </Card>
      </div>
    </MobileShell>
  );
}

export default SlipUploadPage;
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Camera, Upload, FileImage, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { uploadSlip, getSlipWithLegs, retrySlipParsing, getSlipImageUrl, type Slip } from '../../lib/slips';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';
import { ConfirmSlip } from './ConfirmSlip';

interface PicksUploadProps {
  leagueId: string;
  onSuccess?: () => void;
}

export function PicksUpload({ leagueId, onSuccess }: PicksUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedSlip, setUploadedSlip] = useState<Slip | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Get current user
  const { data: session } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  // Poll for slip status updates
  const { data: slipData, refetch: refetchSlip } = useQuery({
    queryKey: ['slip-status', uploadedSlip?.id],
    queryFn: () => uploadedSlip ? getSlipWithLegs(uploadedSlip.id) : null,
    enabled: !!uploadedSlip,
    refetchInterval: (data) => {
      // Stop polling once parsing is complete
      if (!data?.slip || ['parsed', 'failed', 'confirmed'].includes(data.slip.status)) {
        return false;
      }
      return 2000; // Poll every 2 seconds while processing
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Create preview URL
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      
      // Clean up previous preview
      return () => URL.revokeObjectURL(url);
    }
  };

  const handleUpload = async () => {
    if (!file || !session?.user) return;

    setIsUploading(true);
    try {
      const slip = await uploadSlip({
        file,
        leagueId,
        userId: session.user.id,
      });
      setUploadedSlip(slip);
      setFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRetryParsing = async () => {
    if (!uploadedSlip) return;
    
    try {
      await retrySlipParsing(uploadedSlip.id);
      refetchSlip();
    } catch (error) {
      console.error('Retry failed:', error);
      alert(`Retry failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued':
      case 'processing':
        return <Clock size={16} className="text-yellow-600 animate-pulse" />;
      case 'parsed':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'failed':
        return <AlertCircle size={16} className="text-red-600" />;
      case 'confirmed':
        return <CheckCircle size={16} className="text-green-600" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'queued':
        return 'Queued for processing...';
      case 'processing':
        return 'Processing with OCR...';
      case 'parsed':
        return 'Ready to review';
      case 'failed':
        return 'Processing failed';
      case 'confirmed':
        return 'Picks saved successfully';
      default:
        return status;
    }
  };

  const currentSlip = slipData?.slip || uploadedSlip;
  const legs = slipData?.legs || [];

  if (showConfirm && currentSlip && legs.length > 0) {
    return (
      <ConfirmSlip
        slip={currentSlip}
        legs={legs}
        leagueId={leagueId}
        onDone={() => {
          setShowConfirm(false);
          setUploadedSlip(null);
          refetchSlip();
          onSuccess?.();
        }}
        onBack={() => setShowConfirm(false)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mx-auto flex items-center justify-center">
            <Camera size={24} className="text-white" />
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Upload Betting Slip</h3>
            <p className="text-sm text-gray-600 mb-4">
              Take a photo or upload a screenshot of your betting slip. 
              Our OCR will extract the bets automatically.
            </p>
          </div>

          {/* File Input */}
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-blue-400 transition-colors">
              {previewUrl ? (
                <div className="space-y-3">
                  <img 
                    src={previewUrl} 
                    alt="Slip preview" 
                    className="max-w-full max-h-48 mx-auto rounded-lg shadow-sm object-contain"
                  />
                  <div className="flex items-center justify-center text-sm text-gray-600">
                    <FileImage size={16} className="mr-2" />
                    {file?.name}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload size={32} className="mx-auto text-gray-400 mb-3" />
                  <p className="text-sm text-gray-600">
                    Click to select or drag and drop an image
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PNG, JPG, WebP up to 5MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {file && (
            <Button 
              onClick={handleUpload} 
              disabled={isUploading}
              className="rounded-xl w-full"
            >
              {isUploading ? (
                <>
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={16} className="mr-2" />
                  Upload Slip
                </>
              )}
            </Button>
          )}
        </div>
      </Card>

      {/* Processing Status */}
      {currentSlip && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon(currentSlip.status)}
              <div>
                <div className="font-medium text-gray-900">
                  {getStatusText(currentSlip.status)}
                </div>
                {currentSlip.error && (
                  <div className="text-sm text-red-600 mt-1">
                    {currentSlip.error}
                  </div>
                )}
                {legs.length > 0 && (
                  <div className="text-sm text-gray-600 mt-1">
                    Found {legs.length} bet{legs.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex space-x-2">
              {currentSlip.status === 'failed' && (
                <Button
                  onClick={handleRetryParsing}
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                >
                  <RefreshCw size={14} className="mr-1" />
                  Retry
                </Button>
              )}
              
              {currentSlip.status === 'parsed' && legs.length > 0 && (
                <Button
                  onClick={() => setShowConfirm(true)}
                  size="sm"
                  className="rounded-xl"
                >
                  Review Bets
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default PicksUpload;
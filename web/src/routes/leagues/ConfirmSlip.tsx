import { useState } from 'react';
import { ArrowLeft, CheckCircle, Edit2, DollarSign, TrendingUp, Target } from 'lucide-react';
import { confirmSlipLegs, getSlipImageUrl, type Slip, type SlipLeg } from '../../lib/slips';
import { Card } from '../../components/UI/Card';
import { Button } from '../../components/UI/Button';

interface ConfirmSlipProps {
  slip: Slip;
  legs: SlipLeg[];
  leagueId: string;
  onDone: () => void;
  onBack: () => void;
}

interface EditableLeg extends SlipLeg {
  isEditing?: boolean;
}

export function ConfirmSlip({ slip, legs, leagueId, onDone, onBack }: ConfirmSlipProps) {
  const [editableLegs, setEditableLegs] = useState<EditableLeg[]>(legs);
  const [isConfirming, setIsConfirming] = useState(false);
  const [slipImageUrl, setSlipImageUrl] = useState<string | null>(null);

  // Load slip image on mount
  useState(() => {
    getSlipImageUrl(slip).then(setSlipImageUrl).catch(console.error);
  });

  const handleEditLeg = (index: number) => {
    setEditableLegs(prev => prev.map((leg, i) => 
      i === index ? { ...leg, isEditing: !leg.isEditing } : leg
    ));
  };

  const handleUpdateLeg = (index: number, field: keyof SlipLeg, value: any) => {
    setEditableLegs(prev => prev.map((leg, i) => 
      i === index ? { ...leg, [field]: value } : leg
    ));
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await confirmSlipLegs(slip.id, leagueId, editableLegs);
      onDone();
    } catch (error) {
      console.error('Failed to confirm slip:', error);
      alert(`Failed to confirm slip: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConfirming(false);
    }
  };

  const formatOdds = (odds?: number) => {
    if (!odds) return '—';
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const formatMarket = (market?: string) => {
    if (!market) return 'Unknown';
    return market.charAt(0).toUpperCase() + market.slice(1);
  };

  const formatUnits = (units?: number) => {
    if (!units) return '—';
    return `${units}u`;
  };

  const getMarketIcon = (market?: string) => {
    switch (market) {
      case 'moneyline':
        return <Target size={16} className="text-blue-600" />;
      case 'spread':
        return <TrendingUp size={16} className="text-purple-600" />;
      case 'total':
        return <DollarSign size={16} className="text-green-600" />;
      default:
        return <Target size={16} className="text-gray-600" />;
    }
  };

  const validLegs = editableLegs.filter(leg => leg.market && leg.odds_american);
  const hasValidLegs = validLegs.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="rounded-xl"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back
        </Button>
        <h2 className="text-xl font-bold text-gray-900">Review Your Bets</h2>
        <div /> {/* Spacer for centering */}
      </div>

      {/* Slip Image */}
      {slipImageUrl && (
        <Card className="p-4">
          <div className="text-center">
            <img 
              src={slipImageUrl} 
              alt="Original betting slip" 
              className="max-w-full max-h-64 mx-auto rounded-lg shadow-sm object-contain"
            />
            <p className="text-sm text-gray-600 mt-2">Original slip</p>
          </div>
        </Card>
      )}

      {/* OCR Text (for debugging) */}
      {slip.ocr_text && (
        <Card className="p-4">
          <details>
            <summary className="text-sm font-medium text-gray-700 cursor-pointer">
              Raw OCR Text (for debugging)
            </summary>
            <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap bg-gray-50 p-2 rounded">
              {slip.ocr_text}
            </pre>
          </details>
        </Card>
      )}

      {/* Parsed Legs */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Detected Bets ({editableLegs.length})
        </h3>
        
        {editableLegs.map((leg, index) => (
          <Card key={leg.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                {getMarketIcon(leg.market)}
                <span className="font-medium text-gray-900">
                  {formatMarket(leg.market)}
                </span>
                {leg.confidence && (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    leg.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                    leg.confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {Math.round(leg.confidence * 100)}% confident
                  </span>
                )}
              </div>
              
              <Button
                onClick={() => handleEditLeg(index)}
                variant="ghost"
                size="sm"
                className="rounded-xl"
              >
                <Edit2 size={14} className="mr-1" />
                {leg.isEditing ? 'Done' : 'Edit'}
              </Button>
            </div>

            {leg.isEditing ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Market
                  </label>
                  <select
                    value={leg.market || ''}
                    onChange={(e) => handleUpdateLeg(index, 'market', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select market</option>
                    <option value="moneyline">Moneyline</option>
                    <option value="spread">Spread</option>
                    <option value="total">Total</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selection
                  </label>
                  <input
                    type="text"
                    value={leg.selection || ''}
                    onChange={(e) => handleUpdateLeg(index, 'selection', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., PHI Eagles"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Side
                  </label>
                  <input
                    type="text"
                    value={leg.side || ''}
                    onChange={(e) => handleUpdateLeg(index, 'side', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., home, over"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Line
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={leg.line || ''}
                    onChange={(e) => handleUpdateLeg(index, 'line', e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., -2.5"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Odds
                  </label>
                  <input
                    type="number"
                    value={leg.odds_american || ''}
                    onChange={(e) => handleUpdateLeg(index, 'odds_american', e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., -110"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Units Staked
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={leg.units_staked || ''}
                    onChange={(e) => handleUpdateLeg(index, 'units_staked', e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 1.0"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900">
                    {leg.selection || 'Unknown selection'}
                  </span>
                  <span className={`text-lg font-bold ${
                    (leg.odds_american || 0) > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatOdds(leg.odds_american)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    {leg.side && `${leg.side}${leg.line ? ` ${leg.line}` : ''}`}
                  </span>
                  <span>{formatUnits(leg.units_staked)}</span>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Parlay Info */}
      {slip.parlay_units_staked && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-blue-900">Parlay Information</div>
              <div className="text-sm text-blue-700">
                Total stake: {formatUnits(slip.parlay_units_staked)}
                {slip.parlay_payout && ` • Potential payout: $${slip.parlay_payout}`}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Summary */}
      <Card className="p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <span className="font-medium text-gray-900">Summary</span>
          <CheckCircle size={20} className="text-green-600" />
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{editableLegs.length}</div>
            <div className="text-sm text-gray-600">Total legs</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{validLegs.length}</div>
            <div className="text-sm text-gray-600">Valid legs</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {formatUnits(validLegs.reduce((sum, leg) => sum + (leg.units_staked || 0), 0))}
            </div>
            <div className="text-sm text-gray-600">Total units</div>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1 rounded-xl"
        >
          Cancel
        </Button>
        
        <Button
          onClick={handleConfirm}
          disabled={!hasValidLegs || isConfirming}
          className="flex-1 rounded-xl"
        >
          {isConfirming ? (
            'Saving Picks...'
          ) : (
            `Confirm ${validLegs.length} Pick${validLegs.length !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  );
}

export default ConfirmSlip;
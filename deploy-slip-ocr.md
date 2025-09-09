# Deploy Slip OCR System

Great news! The file upload is now working ✅. You just need to deploy the Edge Function for OCR processing.

## Next Steps

### 1. **Deploy the Edge Function**
```bash
# Deploy the parse-slip function
supabase functions deploy parse-slip
```

### 2. **Set Environment Secrets**
```bash
# Get a free OCR.Space API key from https://ocr.space/ocrapi
supabase secrets set OCRSPACE_API_KEY=your_ocr_space_api_key_here

# Set Supabase credentials (replace with your actual values)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set SUPABASE_URL=https://aqxaghkhswerbcizblnp.supabase.co
```

### 3. **Get OCR.Space API Key**
1. Visit [ocr.space/ocrapi](https://ocr.space/ocrapi)
2. Sign up for free (25,000 requests/month)
3. Get your API key from the dashboard
4. Add it to Supabase secrets as shown above

## Current Status

✅ **Storage Upload**: Working perfectly - files upload to the slips bucket  
✅ **Database Records**: Slip records are created successfully  
✅ **Error Handling**: Graceful fallback when Edge Function not available  
❌ **OCR Processing**: Needs Edge Function deployment  

## Test the Complete Flow

After deploying the function and setting the API key:

1. Upload a betting slip image
2. Wait a few seconds for OCR processing  
3. Click "Review Bets" when parsing completes
4. Edit any incorrect fields in the confirmation screen
5. Click "Confirm" to save picks to your picks list

## Alternative: Manual Testing

If you want to test the UI flow without OCR, you can:

1. Upload an image (it will show "Processing failed")
2. The system will still create a slip record
3. Manually add some test `slip_legs` via SQL:

```sql
insert into slip_legs (slip_id, leg_index, market, selection, side, odds_american, units_staked, confidence, parsed_json)
values (
  'your-slip-id-here',
  0,
  'moneyline', 
  'PHI Eagles',
  'team',
  -110,
  1.0,
  0.8,
  '{"test": true}'
);
```

Then you can test the confirmation flow.

---

The file upload functionality is working perfectly! Just deploy the Edge Function and you'll have a complete slip OCR system.
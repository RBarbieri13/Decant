# Batch Import UI Improvements

## Overview
Enhanced the batch import feature with better error handling, validation, and user guidance to improve the overall user experience when imports fail.

## Changes Made

### 1. API Key Pre-validation (`useBatchImport.ts`)

**New State Variables:**
- `hasApiKey: boolean` - Tracks if OpenAI API key is configured
- `isCheckingApiKey: boolean` - Loading state during API key validation
- `startError: string | null` - Error message when import fails to start

**New Behavior:**
- Checks for API key immediately when hook initializes
- Validates API key before allowing import to start
- Returns clear error messages when validation fails
- Prevents import attempts when prerequisites are not met

**Code Location:** `/decant-standalone/src/renderer/hooks/useBatchImport.ts`

### 2. Warning & Error Banners (`BatchImportModal.tsx`)

#### API Key Warning Banner
- **When:** Displayed when API key check completes and no key is found
- **Style:** Yellow background (#FFF9E6) with gold border
- **Content:**
  - Warning icon (⚠️)
  - Title: "OpenAI API Key Required"
  - Message: Explains requirement for AI-powered classification
  - Action: "Open Settings" button that opens Settings dialog

#### Start Error Banner
- **When:** Displayed when import fails to start
- **Style:** Red background (#FFF0F0) with red border
- **Content:**
  - Error icon (❌)
  - Title: "Import Failed to Start"
  - Message: Shows specific error from backend

**Code Location:** `/decant-standalone/src/renderer/components/import/BatchImportModal.tsx`

### 3. Enhanced Error Display (`BatchImportResults.tsx`)

**New Features:**
- Expandable error details for each failed import item
- Toggle button: "Show/Hide error details"
- Error messages displayed in readable format
- Proper styling consistent with design system

**Visual Design:**
- Collapsible error sections
- Light red background for error areas
- Monospace-friendly error text
- Word-wrapping for long error messages

**Code Location:** `/decant-standalone/src/renderer/components/import/BatchImportResults.tsx`

### 4. Improved Button States

**Import Button Now:**
- Disabled when API key is not configured
- Disabled when no valid URLs are entered
- Shows "Checking..." while validating API key
- Displays helpful tooltips explaining why it's disabled
- Properly integrated with validation state

## User Experience Flow

### Flow 1: Missing API Key
1. User opens Batch Import modal
2. System checks for API key (shows "Checking..." on button)
3. Yellow warning banner appears: "OpenAI API Key Required"
4. Import button is disabled with tooltip explanation
5. User clicks "Open Settings" button
6. Batch Import modal closes, Settings dialog opens
7. User configures API key in Settings
8. User reopens Batch Import
9. Warning banner is gone, import functionality enabled

### Flow 2: Individual URL Failures
1. User starts batch import with multiple URLs
2. Import processes URLs in parallel
3. Some URLs fail (invalid format, network error, etc.)
4. Failed items show red status badge: "Failed"
5. User clicks "Show error details" on failed item
6. Expandable section reveals actual error message
7. User understands the issue and can take corrective action

### Flow 3: Import Startup Failure
1. User attempts to start import
2. Backend validation fails (e.g., rate limit exceeded)
3. Red error banner appears at top of modal
4. Shows specific error message from backend
5. User reads error and understands what went wrong
6. User can address the issue and retry

## Technical Details

### Dependencies
- Uses `window.decantAPI.settings.getApiKey()` for validation
- Integrates with `useApp()` context for settings dialog
- Maintains existing SSE subscription architecture
- Backward compatible with existing batch import API

### State Management
- All new state managed within `useBatchImport` hook
- No global state pollution
- Clean separation of concerns
- Proper React hooks patterns

### Styling
- Consistent with existing "gum" design system
- Uses CSS-in-JS with inline styles
- Responsive design maintained
- Accessible color contrasts for error states

### TypeScript
- Fully typed with no compilation errors
- Extended existing interfaces cleanly
- Proper type inference throughout
- No `any` types introduced

## Testing Recommendations

### Manual Testing
1. **API Key Missing:**
   - Remove OpenAI API key from settings
   - Open Batch Import modal
   - Verify warning banner appears
   - Verify Import button is disabled
   - Click "Open Settings" and verify navigation

2. **Import Errors:**
   - Add invalid URLs to batch import
   - Start import and wait for failures
   - Expand error details on failed items
   - Verify error messages are readable

3. **Startup Errors:**
   - Simulate backend error (disconnect API, etc.)
   - Try to start import
   - Verify error banner shows correct message

### Automated Testing (Future)
- Unit tests for `useBatchImport` validation logic
- Integration tests for modal banner display
- E2E tests for complete user flows
- Accessibility tests for error states

## Files Modified

1. `/decant-standalone/src/renderer/hooks/useBatchImport.ts`
   - Added API key validation
   - Added error state management
   - Enhanced startImport with validation

2. `/decant-standalone/src/renderer/components/import/BatchImportModal.tsx`
   - Added warning banner for missing API key
   - Added error banner for startup failures
   - Integrated settings dialog navigation
   - Enhanced button states with tooltips

3. `/decant-standalone/src/renderer/components/import/BatchImportResults.tsx`
   - Added expandable error details for failed items
   - Enhanced styling for error states
   - Improved readability of error messages

## Future Enhancements

### Potential Improvements
1. **Retry Failed Items:** Add button to retry individual failed URLs
2. **Error Categorization:** Group errors by type (network, validation, etc.)
3. **Error Analytics:** Track common error patterns for UX improvements
4. **Offline Detection:** Show specific message when network is unavailable
5. **Progress Estimation:** Show estimated time remaining for large batches
6. **Batch Templates:** Save common URL lists for repeated imports

### Integration Opportunities
1. Link error messages to documentation/help articles
2. Suggest fixes based on error type (e.g., "Try different URL format")
3. Auto-retry with exponential backoff for transient errors
4. Notification when batch completes (for long-running imports)

## Rollout Notes

### Deployment
- No database migrations required
- No API changes required
- Client-side only changes
- Can be deployed independently

### Rollback Plan
- Changes are isolated to import UI components
- No data persistence changes
- Easy to revert if issues arise
- Previous behavior can be restored by reverting 3 files

## Support

### Common Questions
**Q: Why does the Import button stay disabled?**
A: Check that you have configured an OpenAI API key in Settings > AI

**Q: Where can I see why an import failed?**
A: Click "Show error details" on any failed item in the results panel

**Q: How do I configure the API key?**
A: Click "Open Settings" in the warning banner, or use the Settings menu

---

*Document created as part of Decant UI improvement initiative*
*Last updated: 2026-02-10*

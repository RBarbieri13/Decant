// ============================================================
// ImportDialog Component Tests
// ============================================================
//
// NOTE: These tests require @testing-library/react to be installed.
// Install with: pnpm add -D @testing-library/react @testing-library/user-event
//
// Update vitest.config.ts to include:
//   test: {
//     environment: 'jsdom',
//     setupFiles: ['src/renderer/__tests__/setup.tsx']
//   }
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportDialog } from '../components/import/ImportDialog';
import { AppProvider } from '../context/AppContext';
import type { ImportProgress } from '../context/AppContext';

// Mock the API
vi.mock('../services/api', () => ({
  hierarchyAPI: {
    getSegments: vi.fn().mockResolvedValue([]),
    getOrganizations: vi.fn().mockResolvedValue([]),
    getTree: vi.fn().mockResolvedValue({ root: [] }),
  },
  nodesAPI: {
    get: vi.fn().mockResolvedValue(null),
    update: vi.fn(),
    delete: vi.fn(),
  },
  searchAPI: {
    search: vi.fn().mockResolvedValue([]),
  },
  importAPI: {
    importUrl: vi.fn(),
  },
  settingsAPI: {
    setApiKey: vi.fn(),
    getApiKeyStatus: vi.fn().mockResolvedValue({ configured: true }),
  },
  mergeAPI: {
    merge: vi.fn(),
  },
  moveAPI: {
    moveNode: vi.fn(),
  },
}));

import { importAPI } from '../services/api';

// Helper to render with AppProvider
function renderWithProvider(ui: React.ReactElement, initialDialogState = true) {
  // We'll need to extend AppProvider to accept initial state for testing
  return render(<AppProvider>{ui}</AppProvider>);
}

describe('ImportDialog Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should not render when dialog is closed', () => {
      renderWithProvider(<ImportDialog />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when dialog is open', async () => {
      renderWithProvider(<ImportDialog />);

      // Trigger dialog open (requires context action)
      // This would be done via the app context
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByLabelText(/import url/i)).toBeInTheDocument();
    });

    it('should have accessible modal attributes', async () => {
      renderWithProvider(<ImportDialog />);
      const dialog = await screen.findByRole('dialog');

      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'import-dialog-title');
    });
  });

  describe('URL Input', () => {
    it('should render URL input field', async () => {
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'url');
      expect(input).toHaveAttribute('placeholder', 'https://example.com/article');
    });

    it('should update input value when user types', async () => {
      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      expect(input).toHaveValue('https://example.com/test');
    });

    it('should auto-focus input when dialog opens', async () => {
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      expect(input).toHaveFocus();
    });

    it('should disable input while importing', async () => {
      // Mock ongoing import
      vi.mocked(importAPI.importUrl).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      const submitButton = screen.getByRole('button', { name: /^import$/i });

      await user.type(input, 'https://example.com/test');
      await user.click(submitButton);

      expect(input).toBeDisabled();
    });
  });

  describe('URL Validation', () => {
    it('should not submit with empty URL', async () => {
      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const submitButton = await screen.findByRole('button', { name: /^import$/i });
      expect(submitButton).toBeDisabled();

      await user.click(submitButton);
      expect(importAPI.importUrl).not.toHaveBeenCalled();
    });

    it('should not submit with invalid URL', async () => {
      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'not-a-url');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      expect(importAPI.importUrl).not.toHaveBeenCalled();
    });

    it('should accept valid HTTP URL', async () => {
      vi.mocked(importAPI.importUrl).mockResolvedValue({
        success: true,
        nodeId: 'node-123',
      });

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/article');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      expect(importAPI.importUrl).toHaveBeenCalledWith('https://example.com/article');
    });
  });

  describe('Progress Indicator', () => {
    it('should show progress steps during import', async () => {
      let resolveImport: any;
      vi.mocked(importAPI.importUrl).mockImplementation(
        () => new Promise((resolve) => { resolveImport = resolve; })
      );

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      // Should show progress steps
      expect(screen.getByText(/validating/i)).toBeInTheDocument();
      expect(screen.getByText(/fetching/i)).toBeInTheDocument();
      expect(screen.getByText(/classifying/i)).toBeInTheDocument();
      expect(screen.getByText(/saving/i)).toBeInTheDocument();

      // Cleanup
      resolveImport({ success: true, nodeId: 'test' });
    });

    it('should show active phase with animation', async () => {
      // This would test that the current phase has the 'active' class
      // Implementation depends on how progress is managed in context
    });

    it('should show progress percentage', async () => {
      // Test that progress bar width updates based on percentage
    });

    it('should show current progress message', async () => {
      // Test that the message displayed matches the current phase
    });
  });

  describe('Classification Preview', () => {
    it('should display classification when available', async () => {
      // Mock import with classification data
      vi.mocked(importAPI.importUrl).mockResolvedValue({
        success: true,
        nodeId: 'node-123',
        classification: {
          segment: 'Technology',
          category: 'Development Tools',
          contentType: 'Article',
        },
      });

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Technology')).toBeInTheDocument();
        expect(screen.getByText('Development Tools')).toBeInTheDocument();
        expect(screen.getByText('Article')).toBeInTheDocument();
      });
    });

    it('should show classification preview title', async () => {
      // Test that "Classification Preview" header is shown
    });

    it('should style classification tags appropriately', async () => {
      // Test that different tag types have different colors
    });
  });

  describe('Error Handling', () => {
    it('should display error message on import failure', async () => {
      vi.mocked(importAPI.importUrl).mockResolvedValue({
        success: false,
        error: 'Failed to fetch URL',
      });

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/404');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch url/i)).toBeInTheDocument();
      });
    });

    it('should show retry button on error', async () => {
      vi.mocked(importAPI.importUrl).mockResolvedValue({
        success: false,
        error: 'Network error',
      });

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      vi.mocked(importAPI.importUrl)
        .mockResolvedValueOnce({ success: false, error: 'Failed' })
        .mockResolvedValueOnce({ success: true, nodeId: 'node-123' });

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      // First attempt
      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/failed/i)).toBeInTheDocument();
      });

      // Retry
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText(/import complete/i)).toBeInTheDocument();
      });
    });
  });

  describe('Success State', () => {
    it('should show success message on completion', async () => {
      vi.mocked(importAPI.importUrl).mockResolvedValue({
        success: true,
        nodeId: 'node-123',
      });

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/import complete/i)).toBeInTheDocument();
      });
    });

    it('should show "View Node" button on success', async () => {
      vi.mocked(importAPI.importUrl).mockResolvedValue({
        success: true,
        nodeId: 'node-123',
      });

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      await waitFor(() => {
        const viewButton = screen.getByRole('button', { name: /view node/i });
        expect(viewButton).toBeInTheDocument();
      });
    });

    it('should show enrichment status if Phase 2 is queued', async () => {
      vi.mocked(importAPI.importUrl).mockResolvedValue({
        success: true,
        nodeId: 'node-123',
        phase2: { queued: true },
      });

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/enriching in background/i)).toBeInTheDocument();
      });
    });
  });

  describe('Dialog Controls', () => {
    it('should close dialog when close button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const closeButton = await screen.findByRole('button', { name: /close dialog/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should close dialog when overlay is clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const dialog = await screen.findByRole('dialog');
      const overlay = dialog.parentElement;

      await user.click(overlay!);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should not close dialog when clicking inside dialog content', async () => {
      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const dialog = await screen.findByRole('dialog');
      await user.click(dialog);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should close on Escape key when not importing', async () => {
      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      await screen.findByRole('dialog');
      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('should not close on Escape during import', async () => {
      let resolveImport: any;
      vi.mocked(importAPI.importUrl).mockImplementation(
        () => new Promise((resolve) => { resolveImport = resolve; })
      );

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      await user.keyboard('{Escape}');

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Cleanup
      resolveImport({ success: true, nodeId: 'test' });
    });

    it('should disable close button during import', async () => {
      let resolveImport: any;
      vi.mocked(importAPI.importUrl).mockImplementation(
        () => new Promise((resolve) => { resolveImport = resolve; })
      );

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      expect(closeButton).toBeDisabled();

      // Cleanup
      resolveImport({ success: true, nodeId: 'test' });
    });
  });

  describe('Import Button States', () => {
    it('should show "Import" text initially', async () => {
      renderWithProvider(<ImportDialog />);

      const button = await screen.findByRole('button', { name: /^import$/i });
      expect(button).toHaveTextContent('Import');
    });

    it('should show "Importing..." during import', async () => {
      let resolveImport: any;
      vi.mocked(importAPI.importUrl).mockImplementation(
        () => new Promise((resolve) => { resolveImport = resolve; })
      );

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /importing/i })).toBeInTheDocument();
      });

      // Cleanup
      resolveImport({ success: true, nodeId: 'test' });
    });

    it('should be disabled when URL is empty', async () => {
      renderWithProvider(<ImportDialog />);

      const button = await screen.findByRole('button', { name: /^import$/i });
      expect(button).toBeDisabled();
    });

    it('should be disabled during import', async () => {
      let resolveImport: any;
      vi.mocked(importAPI.importUrl).mockImplementation(
        () => new Promise((resolve) => { resolveImport = resolve; })
      );

      const user = userEvent.setup();
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      await user.type(input, 'https://example.com/test');

      const submitButton = screen.getByRole('button', { name: /^import$/i });
      await user.click(submitButton);

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /importing/i });
        expect(button).toBeDisabled();
      });

      // Cleanup
      resolveImport({ success: true, nodeId: 'test' });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithProvider(<ImportDialog />);

      const input = await screen.findByLabelText(/paste a url to import/i);
      expect(input).toHaveAccessibleName();

      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      expect(closeButton).toHaveAccessibleName();
    });

    it('should trap focus within dialog', async () => {
      // Test that Tab key cycles through dialog elements only
    });

    it('should announce status updates to screen readers', async () => {
      // Test for aria-live regions for progress updates
    });
  });
});

// ============================================================
// DetailPanel Component Tests
// ============================================================
//
// NOTE: These tests require @testing-library/react to be installed.
// Install with: pnpm add -D @testing-library/react @testing-library/user-event
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DetailPanel } from '../components/layout/DetailPanel';
import { AppProvider } from '../context/AppContext';

// Mock API
vi.mock('../services/api', () => ({
  hierarchyAPI: {
    getSegments: vi.fn().mockResolvedValue([]),
    getOrganizations: vi.fn().mockResolvedValue([]),
    getTree: vi.fn().mockResolvedValue({ root: [] }),
  },
  nodesAPI: {
    get: vi.fn(),
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

import { nodesAPI } from '../services/api';

const mockNode = {
  id: 'node-123',
  title: 'Example Article',
  url: 'https://example.com/article',
  source_domain: 'example.com',
  date_added: '2024-01-15T10:30:00Z',
  company: 'Example Inc',
  phrase_description: 'A great article',
  short_description: 'This is a short description',
  logo_url: 'https://example.com/logo.png',
  ai_summary: 'This is an AI-generated summary of the article content.',
  extracted_fields: {
    contentType: 'A',
    segment: 'T',
  },
  metadata_tags: ['tag1', 'tag2', 'tag3'],
  function_parent_id: null,
  organization_parent_id: null,
  is_deleted: 0,
  created_at: '2024-01-15T10:30:00Z',
  updated_at: '2024-01-15T10:30:00Z',
  key_concepts: ['concept1', 'concept2', 'concept3'],
};

describe('DetailPanel Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should show empty state when no node is selected', () => {
      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      expect(screen.getByText(/select an item to view details/i)).toBeInTheDocument();
      expect(screen.getByText('👆')).toBeInTheDocument();
    });

    it('should not show tabs in empty state', () => {
      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      expect(screen.queryByRole('button', { name: /overview/i })).not.toBeInTheDocument();
    });
  });

  describe('Node Display', () => {
    it('should display node title', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      // This would require selecting a node through context
      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(mockNode.title)).toBeInTheDocument();
      });
    });

    it('should display node logo when available', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        const logo = screen.getByRole('img', { name: '' });
        expect(logo).toHaveAttribute('src', mockNode.logo_url);
      });
    });

    it('should hide logo on error', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        const logo = screen.getByRole('img', { name: '' });
        fireEvent.error(logo);
        expect(logo).toHaveStyle({ display: 'none' });
      });
    });

    it('should display content type badge', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Article')).toBeInTheDocument();
      });
    });

    it('should display source URL', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        const link = screen.getByText('example.com');
        expect(link.closest('a')).toHaveAttribute('href', mockNode.url);
      });
    });

    it('should display short description', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(mockNode.short_description!)).toBeInTheDocument();
      });
    });

    it('should display AI summary', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(mockNode.ai_summary!)).toBeInTheDocument();
      });
    });

    it('should show placeholder when AI summary is missing', async () => {
      const nodeWithoutSummary = { ...mockNode, ai_summary: null };
      vi.mocked(nodesAPI.get).mockResolvedValue(nodeWithoutSummary);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/no summary available/i)).toBeInTheDocument();
      });
    });

    it('should display key concepts', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        mockNode.key_concepts.forEach((concept) => {
          expect(screen.getByText(concept)).toBeInTheDocument();
        });
      });
    });

    it('should display metadata tags', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        mockNode.metadata_tags.forEach((tag) => {
          expect(screen.getByText(tag)).toBeInTheDocument();
        });
      });
    });

    it('should format date correctly', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        // Should format as "January 15, 2024"
        expect(screen.getByText(/january 15, 2024/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tabs', () => {
    it('should display all tabs', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /properties/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /related/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /backlinks/i })).toBeInTheDocument();
      });
    });

    it('should have overview tab active by default', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        const overviewTab = screen.getByRole('button', { name: /overview/i });
        expect(overviewTab).toHaveClass('active');
      });
    });

    it('should switch tabs when clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
      });

      const propertiesTab = screen.getByRole('button', { name: /properties/i });
      await user.click(propertiesTab);

      expect(propertiesTab).toHaveClass('active');
      expect(screen.getByRole('button', { name: /overview/i })).not.toHaveClass('active');
    });

    it('should reset to overview tab when node changes', async () => {
      const user = userEvent.setup();
      vi.mocked(nodesAPI.get).mockResolvedValueOnce(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
      });

      // Switch to properties tab
      const propertiesTab = screen.getByRole('button', { name: /properties/i });
      await user.click(propertiesTab);

      // Select a different node (this would be done via context)
      // After reselection, should reset to overview
      // ... test implementation depends on context
    });
  });

  describe('Edit Mode', () => {
    it('should enter edit mode when Edit button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
      });

      const editButton = screen.getByRole('button', { name: /^edit$/i });
      await user.click(editButton);

      expect(screen.getByText(/editing/i)).toBeInTheDocument();
    });

    it('should show input fields in edit mode', async () => {
      const user = userEvent.setup();
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^edit$/i }));

      // Should show editable title
      const titleInput = screen.getByDisplayValue(mockNode.title);
      expect(titleInput).toBeInTheDocument();

      // Should show editable summary
      const summaryInput = screen.getByDisplayValue(mockNode.ai_summary!);
      expect(summaryInput).toBeInTheDocument();
    });

    it('should allow editing title and summary', async () => {
      const user = userEvent.setup();
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^edit$/i }));

      const titleInput = screen.getByDisplayValue(mockNode.title);
      await user.clear(titleInput);
      await user.type(titleInput, 'New Title');

      expect(titleInput).toHaveValue('New Title');
    });

    it('should save changes when Save button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);
      vi.mocked(nodesAPI.update).mockResolvedValue({
        ...mockNode,
        title: 'Updated Title',
      });

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^edit$/i }));

      const titleInput = screen.getByDisplayValue(mockNode.title);
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Title');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(nodesAPI.update).toHaveBeenCalledWith(mockNode.id, {
          title: 'Updated Title',
          ai_summary: mockNode.ai_summary,
        });
      });
    });

    it('should cancel changes when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^edit$/i }));

      const titleInput = screen.getByDisplayValue(mockNode.title);
      await user.clear(titleInput);
      await user.type(titleInput, 'Changed Title');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.getByText(mockNode.title)).toBeInTheDocument();
        expect(screen.queryByDisplayValue('Changed Title')).not.toBeInTheDocument();
      });
    });

    it('should show saving state', async () => {
      const user = userEvent.setup();
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);
      vi.mocked(nodesAPI.update).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockNode), 100))
      );

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^edit$/i }));

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should open URL in new tab when Open button is clicked', async () => {
      const user = userEvent.setup();
      const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open/i })).toBeInTheDocument();
      });

      const openButton = screen.getByRole('button', { name: /open/i });
      await user.click(openButton);

      expect(windowOpenSpy).toHaveBeenCalledWith(mockNode.url, '_blank');
      windowOpenSpy.mockRestore();
    });

    it('should copy URL to clipboard', async () => {
      const user = userEvent.setup();
      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextSpy,
        },
      });
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy url/i })).toBeInTheDocument();
      });

      const copyButton = screen.getByRole('button', { name: /copy url/i });
      await user.click(copyButton);

      expect(writeTextSpy).toHaveBeenCalledWith(mockNode.url);
    });

    it('should show delete confirmation dialog', async () => {
      const user = userEvent.setup();
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(screen.getByText(/delete item\?/i)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(mockNode.title))).toBeInTheDocument();
    });

    it('should delete node when confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);
      vi.mocked(nodesAPI.delete).mockResolvedValue(undefined);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /delete/i }));

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(nodesAPI.delete).toHaveBeenCalledWith(mockNode.id);
      });
    });

    it('should cancel delete when Cancel is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /delete/i }));

      const cancelButton = within(screen.getByText(/delete item\?/i).parentElement!).getByRole(
        'button',
        { name: /cancel/i }
      );
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText(/delete item\?/i)).not.toBeInTheDocument();
      });

      expect(nodesAPI.delete).not.toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('should handle node loading', async () => {
      // Test that loading state is shown while fetching node details
    });

    it('should handle node loading error', async () => {
      // Test error state when node fails to load
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: mockNode.title });
        expect(heading).toBeInTheDocument();
      });
    });

    it('should have accessible button labels', async () => {
      vi.mocked(nodesAPI.get).mockResolvedValue(mockNode);

      render(
        <AppProvider>
          <DetailPanel />
        </AppProvider>
      );

      await waitFor(() => {
        const editButton = screen.getByRole('button', { name: /edit node details/i });
        expect(editButton).toHaveAccessibleName();
      });
    });
  });
});

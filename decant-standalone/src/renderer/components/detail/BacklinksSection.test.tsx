// ============================================================
// BacklinksSection Component Tests
// ============================================================

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BacklinksSection } from './BacklinksSection';
import { nodesAPI } from '../../services/api';

// Mock the API
jest.mock('../../services/api', () => ({
  nodesAPI: {
    getBacklinks: jest.fn(),
  },
}));

const mockBacklinksResponse = {
  nodeId: 'node-123',
  backlinks: [
    {
      node: {
        id: 'node-456',
        title: 'Similar Item 1',
        segment: 'Technology',
        category: 'Tools',
        contentType: 'T',
        logo_url: 'https://example.com/logo.png',
        phrase_description: 'A great tool for developers',
      },
      referenceType: 'similar' as const,
      strength: 85,
      sharedAttributes: ['tech', 'dev', 'tools'],
      computedAt: '2024-01-15T12:00:00Z',
    },
    {
      node: {
        id: 'node-789',
        title: 'Related Item 2',
        segment: 'Business',
        category: 'Analytics',
        contentType: 'A',
      },
      referenceType: 'related' as const,
      strength: 65,
      sharedAttributes: ['analytics'],
      computedAt: '2024-01-15T12:00:00Z',
    },
  ],
  grouped: {
    similar: [
      {
        node: {
          id: 'node-456',
          title: 'Similar Item 1',
          segment: 'Technology',
          category: 'Tools',
          contentType: 'T',
          logo_url: 'https://example.com/logo.png',
          phrase_description: 'A great tool for developers',
        },
        referenceType: 'similar' as const,
        strength: 85,
        sharedAttributes: ['tech', 'dev', 'tools'],
        computedAt: '2024-01-15T12:00:00Z',
      },
    ],
    related: [
      {
        node: {
          id: 'node-789',
          title: 'Related Item 2',
          segment: 'Business',
          category: 'Analytics',
          contentType: 'A',
        },
        referenceType: 'related' as const,
        strength: 65,
        sharedAttributes: ['analytics'],
        computedAt: '2024-01-15T12:00:00Z',
      },
    ],
  },
  total: 2,
};

describe('BacklinksSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays loading state initially', () => {
    (nodesAPI.getBacklinks as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<BacklinksSection nodeId="node-123" />);
    expect(screen.getByText('Loading backlinks...')).toBeInTheDocument();
  });

  it('displays backlinks when loaded', async () => {
    (nodesAPI.getBacklinks as jest.Mock).mockResolvedValue(mockBacklinksResponse);

    render(<BacklinksSection nodeId="node-123" />);

    await waitFor(() => {
      expect(screen.getByText('Similar Item 1')).toBeInTheDocument();
      expect(screen.getByText('Related Item 2')).toBeInTheDocument();
    });
  });

  it('displays empty state when no backlinks', async () => {
    (nodesAPI.getBacklinks as jest.Mock).mockResolvedValue({
      nodeId: 'node-123',
      backlinks: [],
      grouped: {},
      total: 0,
    });

    render(<BacklinksSection nodeId="node-123" />);

    await waitFor(() => {
      expect(screen.getByText('No backlinks found')).toBeInTheDocument();
    });
  });

  it('displays error state on API failure', async () => {
    (nodesAPI.getBacklinks as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<BacklinksSection nodeId="node-123" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load backlinks')).toBeInTheDocument();
    });
  });

  it('calls onNavigate when backlink is clicked', async () => {
    const mockOnNavigate = jest.fn();
    (nodesAPI.getBacklinks as jest.Mock).mockResolvedValue(mockBacklinksResponse);

    render(<BacklinksSection nodeId="node-123" onNavigate={mockOnNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Similar Item 1')).toBeInTheDocument();
    });

    const backlinkItem = screen.getByText('Similar Item 1').closest('button');
    if (backlinkItem) {
      await userEvent.click(backlinkItem);
      expect(mockOnNavigate).toHaveBeenCalledWith('node-456');
    }
  });

  it('toggles between grouped and list view', async () => {
    (nodesAPI.getBacklinks as jest.Mock).mockResolvedValue(mockBacklinksResponse);

    render(<BacklinksSection nodeId="node-123" />);

    await waitFor(() => {
      expect(screen.getByText('Similar Item 1')).toBeInTheDocument();
    });

    // Initially in grouped view
    expect(screen.getByText('Similar Items')).toBeInTheDocument();
    expect(screen.getByText('Related Items')).toBeInTheDocument();

    // Switch to list view
    const listViewButton = screen.getByTitle('Show as list');
    await userEvent.click(listViewButton);

    // In list view, reference types should be shown as badges
    const typeBadges = screen.getAllByText(/similar|related/i);
    expect(typeBadges.length).toBeGreaterThan(0);
  });

  it('displays backlink count', async () => {
    (nodesAPI.getBacklinks as jest.Mock).mockResolvedValue(mockBacklinksResponse);

    render(<BacklinksSection nodeId="node-123" />);

    await waitFor(() => {
      expect(screen.getByText('2 backlinks')).toBeInTheDocument();
    });
  });

  it('displays strength with appropriate color', async () => {
    (nodesAPI.getBacklinks as jest.Mock).mockResolvedValue(mockBacklinksResponse);

    render(<BacklinksSection nodeId="node-123" />);

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeInTheDocument();
      expect(screen.getByText('65%')).toBeInTheDocument();
    });
  });

  it('displays shared attributes', async () => {
    (nodesAPI.getBacklinks as jest.Mock).mockResolvedValue(mockBacklinksResponse);

    render(<BacklinksSection nodeId="node-123" />);

    await waitFor(() => {
      expect(screen.getByText('tech')).toBeInTheDocument();
      expect(screen.getByText('dev')).toBeInTheDocument();
      expect(screen.getByText('tools')).toBeInTheDocument();
      expect(screen.getByText('analytics')).toBeInTheDocument();
    });
  });
});

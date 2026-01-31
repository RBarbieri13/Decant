// ============================================================
// BacklinksSection Usage Example
// ============================================================

import React, { useState } from 'react';
import { BacklinksSection } from './BacklinksSection';

/**
 * Example: Basic Usage
 * Shows how to use BacklinksSection with navigation callback
 */
export function BasicBacklinksExample() {
  const [currentNodeId, setCurrentNodeId] = useState('node-123');

  const handleNavigate = (nodeId: string) => {
    console.log('Navigating to node:', nodeId);
    setCurrentNodeId(nodeId);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2>Backlinks Example</h2>
      <p>Current Node ID: {currentNodeId}</p>

      <BacklinksSection
        nodeId={currentNodeId}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

/**
 * Example: Without Navigation
 * Shows backlinks but doesn't allow navigation
 */
export function ReadOnlyBacklinksExample() {
  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2>Read-Only Backlinks</h2>

      <BacklinksSection nodeId="node-456" />
    </div>
  );
}

/**
 * Example: In a Tab System
 * Shows how BacklinksSection integrates with tabs
 */
export function BacklinksInTabsExample() {
  const [activeTab, setActiveTab] = useState<'overview' | 'backlinks'>('overview');
  const [selectedNodeId] = useState('node-789');

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'overview' ? '#000' : '#fff',
            color: activeTab === 'overview' ? '#fff' : '#000',
            border: '2px solid #000',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('backlinks')}
          style={{
            padding: '10px 20px',
            background: activeTab === 'backlinks' ? '#000' : '#fff',
            color: activeTab === 'backlinks' ? '#fff' : '#000',
            border: '2px solid #000',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Backlinks
        </button>
      </div>

      {activeTab === 'overview' && (
        <div style={{ padding: '20px', border: '2px solid #e0e0e0', borderRadius: '8px' }}>
          <h3>Node Overview</h3>
          <p>This is the overview section for node {selectedNodeId}</p>
        </div>
      )}

      {activeTab === 'backlinks' && (
        <BacklinksSection
          nodeId={selectedNodeId}
          onNavigate={(nodeId) => console.log('Navigate to:', nodeId)}
        />
      )}
    </div>
  );
}

/**
 * Example: Custom Styling Container
 * Shows how to wrap BacklinksSection with custom styles
 */
export function StyledBacklinksExample() {
  return (
    <div
      style={{
        maxWidth: '700px',
        margin: '0 auto',
        padding: '30px',
        background: '#f5f5f5',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: '20px' }}>
        Items Linking Here
      </h2>

      <BacklinksSection
        nodeId="node-abc"
        onNavigate={(nodeId) => {
          // Custom navigation logic
          window.location.href = `/nodes/${nodeId}`;
        }}
      />
    </div>
  );
}

/**
 * Example: With Loading State Handler
 * Shows how to manage loading state externally
 */
export function BacklinksWithLoadingExample() {
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div>Loading backlinks data...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <BacklinksSection
        nodeId="node-xyz"
        onNavigate={(nodeId) => console.log('Navigate:', nodeId)}
      />
    </div>
  );
}

/**
 * Example: Multiple Nodes Comparison
 * Shows backlinks for multiple nodes side-by-side
 */
export function CompareBacklinksExample() {
  const nodeIds = ['node-001', 'node-002'];

  return (
    <div style={{ display: 'flex', gap: '20px', padding: '20px' }}>
      {nodeIds.map((nodeId) => (
        <div
          key={nodeId}
          style={{
            flex: 1,
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            padding: '15px',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Node: {nodeId}</h3>
          <BacklinksSection
            nodeId={nodeId}
            onNavigate={(id) => console.log(`Navigate from ${nodeId} to ${id}`)}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Example: With Analytics Tracking
 * Shows how to track user interactions with backlinks
 */
export function BacklinksWithAnalyticsExample() {
  const trackBacklinkClick = (fromNodeId: string, toNodeId: string) => {
    // Track in analytics system
    console.log('Analytics Event:', {
      event: 'backlink_navigation',
      from: fromNodeId,
      to: toNodeId,
      timestamp: new Date().toISOString(),
    });
  };

  const handleNavigate = (toNodeId: string) => {
    const currentNodeId = 'node-current';
    trackBacklinkClick(currentNodeId, toNodeId);

    // Perform actual navigation
    console.log('Navigating to:', toNodeId);
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2>Backlinks with Analytics</h2>
      <BacklinksSection
        nodeId="node-current"
        onNavigate={handleNavigate}
      />
    </div>
  );
}

/**
 * Example: Responsive Layout
 * Shows backlinks in a responsive container
 */
export function ResponsiveBacklinksExample() {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
        }}
      >
        <div style={{ border: '2px solid #e0e0e0', borderRadius: '8px', padding: '15px' }}>
          <h3>Main Content</h3>
          <p>Your main content here...</p>
        </div>

        <div style={{ border: '2px solid #e0e0e0', borderRadius: '8px', padding: '15px' }}>
          <h3>Backlinks</h3>
          <BacklinksSection
            nodeId="node-responsive"
            onNavigate={(nodeId) => console.log('Navigate:', nodeId)}
          />
        </div>
      </div>
    </div>
  );
}

// Export all examples
export default {
  BasicBacklinksExample,
  ReadOnlyBacklinksExample,
  BacklinksInTabsExample,
  StyledBacklinksExample,
  BacklinksWithLoadingExample,
  CompareBacklinksExample,
  BacklinksWithAnalyticsExample,
  ResponsiveBacklinksExample,
};

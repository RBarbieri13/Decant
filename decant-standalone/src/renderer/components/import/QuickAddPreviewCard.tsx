// ============================================================
// Quick Add Preview Card — Compact metadata preview
// ============================================================

import React from 'react';
import type { AIClassification } from '../../../shared/types';

// ============================================
// TYPES
// ============================================

export interface QuickAddPreviewMetadata {
  title: string | null;
  description: string | null;
  favicon: string | null;
  domain: string;
}

interface QuickAddPreviewCardProps {
  metadata: QuickAddPreviewMetadata;
  classification: AIClassification | null;
  isClassifying: boolean;
}

// ============================================
// CODE-TO-LABEL MAPS
// ============================================

const CONTENT_TYPE_LABELS: Record<string, string> = {
  T: 'Website',
  A: 'Article',
  V: 'Video',
  P: 'Podcast',
  R: 'Research',
  G: 'Repository',
  S: 'Social',
  C: 'Course',
  I: 'Image',
  N: 'Newsletter',
  K: 'Book',
  U: 'Audio',
};

const SEGMENT_LABELS: Record<string, string> = {
  A: 'AI',
  T: 'Technology',
  F: 'Finance',
  S: 'Sports',
  H: 'Health',
  B: 'Business',
  E: 'Entertainment',
  L: 'Lifestyle',
  X: 'Science',
  C: 'Creative',
};

function getContentTypeLabel(code: string): string {
  return CONTENT_TYPE_LABELS[code.toUpperCase()] || code;
}

function getSegmentLabel(code: string): string {
  return SEGMENT_LABELS[code.toUpperCase()] || code;
}

// ============================================
// COMPONENT
// ============================================

export const QuickAddPreviewCard: React.FC<QuickAddPreviewCardProps> = ({
  metadata,
  classification,
  isClassifying,
}) => {
  return (
    <div className="quick-add-preview">
      {/* Favicon / Logo */}
      <div className="quick-add-preview-icon">
        {metadata.favicon ? (
          <img
            src={metadata.favicon}
            alt=""
            className="quick-add-preview-favicon"
            onError={(e) => {
              // Fallback to first letter if favicon fails to load
              (e.target as HTMLImageElement).style.display = 'none';
              const next = (e.target as HTMLImageElement).nextElementSibling;
              if (next) next.classList.remove('quick-add-preview-letter--hidden');
            }}
          />
        ) : null}
        <span
          className={`quick-add-preview-letter ${
            metadata.favicon ? 'quick-add-preview-letter--hidden' : ''
          }`}
        >
          {metadata.title?.charAt(0)?.toUpperCase() || metadata.domain?.charAt(0)?.toUpperCase() || '?'}
        </span>
      </div>

      {/* Content */}
      <div className="quick-add-preview-content">
        {/* Title Row with Badges */}
        <div className="quick-add-preview-title-row">
          <span className="quick-add-preview-title">
            {metadata.title || metadata.domain}
          </span>

          {/* Classification Badges */}
          {isClassifying ? (
            <span className="quick-add-preview-badge quick-add-preview-badge--loading">
              <span className="quick-add-preview-badge-spinner" />
              Classifying...
            </span>
          ) : classification ? (
            <>
              <span className="quick-add-preview-badge quick-add-preview-badge--type">
                {getContentTypeLabel(classification.contentType)}
              </span>
              <span className="quick-add-preview-badge quick-add-preview-badge--segment">
                {getSegmentLabel(classification.segment)}
              </span>
            </>
          ) : null}
        </div>

        {/* Description */}
        <p className="quick-add-preview-description">
          {metadata.description
            ? metadata.description.length > 80
              ? metadata.description.substring(0, 80) + '...'
              : metadata.description
            : metadata.domain}
        </p>
      </div>
    </div>
  );
};

// ============================================================
// SearchResultCard - Enhanced search result display
// ============================================================

import React from 'react';
import { HighlightedText } from './HighlightedText';
import type { SearchResult, ContentTypeCode } from '../../../shared/types';

interface SearchResultCardProps {
  result: SearchResult;
  searchTerms: string[];
  onClick: () => void;
  isSelected?: boolean;
}

/**
 * SearchResultCard Component
 *
 * Displays an enhanced search result with:
 * - Highlighted matched terms
 * - Relevance score badge
 * - Content type and segment badges
 * - Context snippet
 * - Favicon/logo
 *
 * @example
 * <SearchResultCard
 *   result={searchResult}
 *   searchTerms={["ai", "tool"]}
 *   onClick={() => selectNode(result.node.id)}
 * />
 */
export function SearchResultCard({
  result,
  searchTerms,
  onClick,
  isSelected = false,
}: SearchResultCardProps): React.ReactElement {
  const { node, matchedField, matchedText, score } = result;

  // Calculate relevance percentage
  const relevancePercentage = Math.round(score * 100);

  // Get relevance color based on score
  const getRelevanceColor = (scoreValue: number): string => {
    if (scoreValue >= 0.8) return 'var(--gum-green)';
    if (scoreValue >= 0.5) return 'var(--gum-yellow)';
    return 'var(--gum-pink)';
  };

  // Format content type for display
  const formatContentType = (code: ContentTypeCode | null): string => {
    if (!code) return '';
    const types: Record<string, string> = {
      T: 'Tool',
      A: 'Article',
      V: 'Video',
      P: 'Podcast',
      R: 'Paper',
      G: 'Repository',
      S: 'Social',
      C: 'Course',
      I: 'Image',
      N: 'Newsletter',
      K: 'Book',
      U: 'Audio',
    };
    return types[code] || code;
  };

  // Create snippet with context (50 chars before/after match)
  const createSnippet = (text: string, match: string): string => {
    if (!text || !match) return text || '';

    const matchIndex = text.toLowerCase().indexOf(match.toLowerCase());
    if (matchIndex === -1) return text.substring(0, 150) + (text.length > 150 ? '...' : '');

    const contextLength = 50;
    const start = Math.max(0, matchIndex - contextLength);
    const end = Math.min(text.length, matchIndex + match.length + contextLength);

    let snippet = text.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  };

  const snippet = createSnippet(matchedText, searchTerms[0] || '');

  // Check if match is exact (case-insensitive)
  const isExactMatch = searchTerms.some(
    term => node.title.toLowerCase() === term.toLowerCase()
  );

  return (
    <button
      className={`search-result-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      {/* Favicon/Logo */}
      {node.faviconPath && (
        <img
          src={`file://${node.faviconPath}`}
          alt=""
          className="result-favicon"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      )}

      {/* Main Content */}
      <div className="result-content">
        {/* Title with highlighting */}
        <div className="result-title">
          <HighlightedText text={node.title} searchTerms={searchTerms} />
          {isExactMatch && (
            <span className="exact-match-badge" title="Exact match">
              ✓
            </span>
          )}
        </div>

        {/* Snippet with highlighting */}
        {snippet && (
          <div className="result-snippet">
            <HighlightedText
              text={snippet}
              searchTerms={searchTerms}
              className="snippet-text"
            />
          </div>
        )}

        {/* Matched field indicator */}
        <div className="result-metadata">
          <span className="matched-field">
            Match: <strong>{matchedField}</strong>
          </span>

          {/* Badges */}
          <div className="result-badges">
            {node.contentTypeCode && (
              <span className="gum-badge gum-badge--small gum-badge--blue">
                {formatContentType(node.contentTypeCode)}
              </span>
            )}
            {node.functionCode && (
              <span className="gum-badge gum-badge--small gum-badge--pink">
                {node.functionCode}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Relevance Score */}
      <div
        className="result-score"
        style={{ background: getRelevanceColor(score) }}
        title={`Relevance: ${relevancePercentage}%`}
      >
        {relevancePercentage}%
      </div>

      <style>{`
        .search-result-card {
          display: flex;
          align-items: flex-start;
          gap: var(--space-md);
          width: 100%;
          padding: var(--space-md);
          background: var(--gum-white);
          border: var(--border-width) solid var(--gum-gray-300);
          border-radius: var(--border-radius);
          text-align: left;
          cursor: pointer;
          font-family: var(--font-main);
          transition: all 0.2s ease;
          margin-bottom: var(--space-sm);
        }

        .search-result-card:hover,
        .search-result-card.selected {
          border-color: var(--gum-black);
          box-shadow: var(--shadow-default);
          background: var(--gum-gray-50);
        }

        .result-favicon {
          width: 24px;
          height: 24px;
          flex-shrink: 0;
          border-radius: 4px;
          margin-top: 2px;
        }

        .result-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .result-title {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-bold);
          color: var(--gum-black);
          display: flex;
          align-items: center;
          gap: var(--space-xs);
        }

        .exact-match-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          background: var(--gum-green);
          color: var(--gum-white);
          border-radius: 50%;
          font-size: 12px;
          font-weight: var(--font-weight-bold);
          flex-shrink: 0;
        }

        .result-snippet {
          font-size: var(--font-size-sm);
          color: var(--gum-gray-700);
          line-height: 1.5;
        }

        .snippet-text {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .result-metadata {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-sm);
          font-size: var(--font-size-xs);
        }

        .matched-field {
          color: var(--gum-gray-600);
        }

        .matched-field strong {
          color: var(--gum-black);
          text-transform: capitalize;
        }

        .result-badges {
          display: flex;
          gap: var(--space-xs);
          flex-wrap: wrap;
        }

        .result-score {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--border-radius);
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-bold);
          color: var(--gum-black);
          border: var(--border-width) solid var(--gum-black);
        }
      `}</style>
    </button>
  );
}

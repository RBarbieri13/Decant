// ============================================================
// HighlightedText Component - Highlights search terms in text
// ============================================================

import React from 'react';

interface HighlightedTextProps {
  text: string;
  searchTerms: string[];
  className?: string;
}

/**
 * HighlightedText Component
 *
 * Highlights search terms within text using <mark> tags.
 * Supports multiple search terms and case-insensitive matching.
 *
 * @example
 * <HighlightedText
 *   text="This is a sample text"
 *   searchTerms={["sample", "text"]}
 * />
 */
export function HighlightedText({ text, searchTerms, className = '' }: HighlightedTextProps): React.ReactElement {
  if (!searchTerms.length || !text) {
    return <span className={className}>{text}</span>;
  }

  // Create regex pattern from search terms
  // Escape special regex characters and join with OR
  const escapedTerms = searchTerms
    .filter(term => term.trim())
    .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (escapedTerms.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  const parts = text.split(pattern);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        // Check if this part matches any search term
        const isMatch = escapedTerms.some(term =>
          new RegExp(`^${term}$`, 'i').test(part)
        );

        return isMatch ? (
          <mark key={index} className="search-highlight">
            {part}
          </mark>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        );
      })}

      <style>{`
        .search-highlight {
          background: var(--gum-yellow);
          color: var(--gum-black);
          padding: 2px 0;
          font-weight: var(--font-weight-bold);
          border-radius: 2px;
        }
      `}</style>
    </span>
  );
}

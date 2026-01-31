// ============================================================
// Node Metadata Section - Comprehensive metadata display
// ============================================================

import React from 'react';
import type { Node } from '../../services/api';

interface NodeMetadataSectionProps {
  node: Node;
}

export function NodeMetadataSection({ node }: NodeMetadataSectionProps): React.ReactElement {
  // Format date for display
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Get content type label
  const getContentTypeLabel = (code: string | null): string => {
    if (!code) return 'Unknown';
    const labels: Record<string, string> = {
      T: 'Tool / Website',
      A: 'Article',
      V: 'Video',
      P: 'Podcast',
      R: 'Research Paper',
      G: 'Repository',
      S: 'Social Post',
      C: 'Course / Tutorial',
      I: 'Image / Graphic',
      N: 'Newsletter',
      K: 'Book / eBook',
    };
    return labels[code] || code;
  };

  return (
    <div className="node-metadata-section">
      {/* Core Info Section */}
      <div className="metadata-group">
        <h3 className="metadata-group-title">Core Information</h3>

        <div className="metadata-field">
          <div className="metadata-label">Title</div>
          <div className="metadata-value">{node.title}</div>
        </div>

        {node.url && (
          <div className="metadata-field">
            <div className="metadata-label">URL</div>
            <div className="metadata-value">
              <a
                href={node.url}
                className="metadata-link"
                onClick={(e) => {
                  e.preventDefault();
                  window.open(node.url!, '_blank');
                }}
              >
                {node.url}
                <span className="external-link-icon">↗</span>
              </a>
            </div>
          </div>
        )}

        {node.source_domain && (
          <div className="metadata-field">
            <div className="metadata-label">Source Domain</div>
            <div className="metadata-value">{node.source_domain}</div>
          </div>
        )}
      </div>

      {/* Classification Section */}
      <div className="metadata-group">
        <h3 className="metadata-group-title">Classification</h3>

        {node.extracted_fields?.segment && (
          <div className="metadata-field">
            <div className="metadata-label">Segment</div>
            <div className="metadata-value">
              <span className="metadata-badge gum-badge--blue">
                {node.extracted_fields.segment}
              </span>
            </div>
          </div>
        )}

        {node.extracted_fields?.category && (
          <div className="metadata-field">
            <div className="metadata-label">Category</div>
            <div className="metadata-value">
              <span className="metadata-badge gum-badge--green">
                {node.extracted_fields.category}
              </span>
            </div>
          </div>
        )}

        {node.extracted_fields?.contentType && (
          <div className="metadata-field">
            <div className="metadata-label">Content Type</div>
            <div className="metadata-value">
              <span className="metadata-badge gum-badge--pink">
                {getContentTypeLabel(node.extracted_fields.contentType)}
              </span>
            </div>
          </div>
        )}

        {node.extracted_fields?.organization && (
          <div className="metadata-field">
            <div className="metadata-label">Organization</div>
            <div className="metadata-value">
              <span className="metadata-badge gum-badge--yellow">
                {node.extracted_fields.organization}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Hierarchy Codes Section */}
      {(node.function_parent_id || node.organization_parent_id) && (
        <div className="metadata-group">
          <h3 className="metadata-group-title">Hierarchy</h3>

          {node.function_parent_id && (
            <div className="metadata-field">
              <div className="metadata-label">Function Parent</div>
              <div className="metadata-value">
                <code className="metadata-code">{node.function_parent_id}</code>
              </div>
            </div>
          )}

          {node.organization_parent_id && (
            <div className="metadata-field">
              <div className="metadata-label">Organization Parent</div>
              <div className="metadata-value">
                <code className="metadata-code">{node.organization_parent_id}</code>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Descriptions Section */}
      {(node.company || node.phrase_description || node.short_description || node.ai_summary) && (
        <div className="metadata-group">
          <h3 className="metadata-group-title">Descriptions</h3>

          {node.company && (
            <div className="metadata-field">
              <div className="metadata-label">Company</div>
              <div className="metadata-value">{node.company}</div>
            </div>
          )}

          {node.phrase_description && (
            <div className="metadata-field">
              <div className="metadata-label">Phrase Description</div>
              <div className="metadata-value metadata-value--italic">{node.phrase_description}</div>
            </div>
          )}

          {node.short_description && (
            <div className="metadata-field">
              <div className="metadata-label">Short Description</div>
              <div className="metadata-value">{node.short_description}</div>
            </div>
          )}

          {node.ai_summary && (
            <div className="metadata-field">
              <div className="metadata-label">AI Summary</div>
              <div className="metadata-value">{node.ai_summary}</div>
            </div>
          )}
        </div>
      )}

      {/* Tags & Concepts Section */}
      {((node.metadata_tags && node.metadata_tags.length > 0) ||
        (node.key_concepts && node.key_concepts.length > 0)) && (
        <div className="metadata-group">
          <h3 className="metadata-group-title">Tags & Concepts</h3>

          {node.metadata_tags && node.metadata_tags.length > 0 && (
            <div className="metadata-field">
              <div className="metadata-label">Metadata Tags</div>
              <div className="metadata-tags">
                {node.metadata_tags.map((tag: string, index: number) => (
                  <span key={index} className="metadata-tag">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {node.key_concepts && node.key_concepts.length > 0 && (
            <div className="metadata-field">
              <div className="metadata-label">Key Concepts</div>
              <div className="metadata-tags">
                {node.key_concepts.map((concept: string, index: number) => (
                  <span key={index} className="metadata-tag metadata-tag--concept">{concept}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timestamps Section */}
      <div className="metadata-group">
        <h3 className="metadata-group-title">Timestamps</h3>

        {node.date_added && (
          <div className="metadata-field">
            <div className="metadata-label">Date Added</div>
            <div className="metadata-value metadata-value--muted">{formatDate(node.date_added)}</div>
          </div>
        )}

        {node.extracted_fields?.createdAt && (
          <div className="metadata-field">
            <div className="metadata-label">Created At</div>
            <div className="metadata-value metadata-value--muted">
              {formatDate(node.extracted_fields.createdAt)}
            </div>
          </div>
        )}

        {node.extracted_fields?.updatedAt && (
          <div className="metadata-field">
            <div className="metadata-label">Updated At</div>
            <div className="metadata-value metadata-value--muted">
              {formatDate(node.extracted_fields.updatedAt)}
            </div>
          </div>
        )}
      </div>

      {/* Additional Extracted Fields */}
      {node.extracted_fields && Object.keys(node.extracted_fields).length > 0 && (
        <div className="metadata-group">
          <h3 className="metadata-group-title">Additional Fields</h3>
          {Object.entries(node.extracted_fields).map(([key, value]) => {
            // Skip already displayed fields
            if (['segment', 'category', 'contentType', 'organization', 'createdAt', 'updatedAt'].includes(key)) {
              return null;
            }

            return (
              <div key={key} className="metadata-field">
                <div className="metadata-label">{key}</div>
                <div className="metadata-value">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .node-metadata-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-lg);
        }

        .metadata-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          padding-bottom: var(--space-lg);
          border-bottom: 1px solid var(--gum-gray-200);
        }

        .metadata-group:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .metadata-group-title {
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-bold);
          text-transform: uppercase;
          color: var(--gum-gray-600);
          letter-spacing: 0.5px;
          margin: 0;
        }

        .metadata-field {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .metadata-label {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          color: var(--gum-gray-500);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .metadata-value {
          font-size: var(--font-size-sm);
          color: var(--gum-black);
          word-break: break-word;
          line-height: 1.5;
        }

        .metadata-value--italic {
          font-style: italic;
          color: var(--gum-gray-700);
        }

        .metadata-value--muted {
          color: var(--gum-gray-600);
        }

        .metadata-link {
          color: var(--gum-black);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: var(--space-xs);
          word-break: break-all;
        }

        .metadata-link:hover {
          text-decoration: underline;
        }

        .external-link-icon {
          font-size: var(--font-size-xs);
          opacity: 0.5;
          flex-shrink: 0;
        }

        .metadata-code {
          font-family: var(--font-mono);
          font-size: var(--font-size-xs);
          background: var(--gum-gray-100);
          padding: 2px 6px;
          border-radius: 3px;
          display: inline-block;
        }

        .metadata-badge {
          display: inline-block;
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          padding: 4px 8px;
          border-radius: var(--border-radius);
        }

        .metadata-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-xs);
        }

        .metadata-tag {
          display: inline-block;
          background: var(--gum-gray-200);
          padding: var(--space-xs) var(--space-sm);
          border-radius: var(--border-radius);
          font-size: var(--font-size-xs);
          color: var(--gum-gray-800);
          font-weight: var(--font-weight-medium);
        }

        .metadata-tag--concept {
          background: var(--gum-blue-100);
          color: var(--gum-blue-800);
        }
      `}</style>
    </div>
  );
}

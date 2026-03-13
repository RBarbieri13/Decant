import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

interface CommandItem {
  id: string;
  label: string;
  secondary?: string;
  icon: string;
  type: 'item' | 'category' | 'command';
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: Array<{ id: string; title: string; type: string; segmentCode: string; url?: string }>;
  categories: Array<{ id: string; label: string; segmentCode: string; catCode: string }>;
  onSelectItem: (id: string) => void;
  onNavigateCategory: (segCode: string, catCode: string) => void;
  onImport: () => void;
  onBatchImport: () => void;
  onReclassify: () => void;
  onToggleStarred: () => void;
  onShowAll: () => void;
}

function fuzzyMatch(query: string, text: string): boolean {
  const lq = query.toLowerCase();
  const lt = text.toLowerCase();
  if (lt.includes(lq)) return true;
  // Simple character-by-character fuzzy match
  let qi = 0;
  for (let ti = 0; ti < lt.length && qi < lq.length; ti++) {
    if (lt[ti] === lq[qi]) qi++;
  }
  return qi === lq.length;
}

function matchScore(query: string, text: string): number {
  const lq = query.toLowerCase();
  const lt = text.toLowerCase();
  if (lt === lq) return 100;
  if (lt.startsWith(lq)) return 90;
  if (lt.includes(lq)) return 70;
  return 50; // fuzzy match
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  items,
  categories,
  onSelectItem,
  onNavigateCategory,
  onImport,
  onBatchImport,
  onReclassify,
  onToggleStarred,
  onShowAll,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands: CommandItem[] = useMemo(() => [
    { id: 'cmd-import', label: 'Import URL', secondary: 'Add a single URL', icon: 'bx-plus-circle', type: 'command', action: () => { onClose(); onImport(); } },
    { id: 'cmd-batch', label: 'Batch Import', secondary: 'Import multiple URLs', icon: 'bx-upload', type: 'command', action: () => { onClose(); onBatchImport(); } },
    { id: 'cmd-reclassify', label: 'Reclassify All', secondary: 'Re-run AI classification', icon: 'bx-refresh', type: 'command', action: () => { onClose(); onReclassify(); } },
    { id: 'cmd-starred', label: 'Toggle Starred Filter', secondary: 'Show/hide starred items', icon: 'bx-star', type: 'command', action: () => { onClose(); onToggleStarred(); } },
    { id: 'cmd-all', label: 'Show All Items', secondary: 'Clear filters', icon: 'bx-grid-alt', type: 'command', action: () => { onClose(); onShowAll(); } },
  ], [onClose, onImport, onBatchImport, onReclassify, onToggleStarred, onShowAll]);

  const allResults = useMemo(() => {
    const results: CommandItem[] = [];

    if (!query.trim()) {
      // Show commands first when no query
      results.push(...commands);
      // Then first 5 recent items
      items.slice(0, 5).forEach(item => {
        results.push({
          id: `item-${item.id}`,
          label: item.title,
          secondary: item.type,
          icon: 'bx-link',
          type: 'item',
          action: () => { onClose(); onSelectItem(item.id); },
        });
      });
      return results;
    }

    // Filter commands
    const matchingCommands = commands.filter(cmd => fuzzyMatch(query, cmd.label));
    results.push(...matchingCommands);

    // Filter categories
    categories
      .filter(cat => fuzzyMatch(query, cat.label))
      .sort((a, b) => matchScore(query, b.label) - matchScore(query, a.label))
      .slice(0, 5)
      .forEach(cat => {
        results.push({
          id: `cat-${cat.segmentCode}-${cat.catCode}`,
          label: cat.label,
          secondary: 'Category',
          icon: 'bx-folder',
          type: 'category',
          action: () => { onClose(); onNavigateCategory(cat.segmentCode, cat.catCode); },
        });
      });

    // Filter items
    items
      .filter(item => fuzzyMatch(query, item.title))
      .sort((a, b) => matchScore(query, b.title) - matchScore(query, a.title))
      .slice(0, 10)
      .forEach(item => {
        results.push({
          id: `item-${item.id}`,
          label: item.title,
          secondary: item.type,
          icon: 'bx-link',
          type: 'item',
          action: () => { onClose(); onSelectItem(item.id); },
        });
      });

    return results;
  }, [query, items, categories, commands, onClose, onSelectItem, onNavigateCategory]);

  // Clamp selected index when results change
  useEffect(() => {
    setSelectedIndex(prev => Math.min(prev, Math.max(0, allResults.length - 1)));
  }, [allResults.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (allResults[selectedIndex]) {
          allResults[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [allResults, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIndex] as HTMLElement;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="command-palette__input-wrapper">
          <i className="bx bx-search command-palette__search-icon" />
          <input
            ref={inputRef}
            className="command-palette__input"
            type="text"
            placeholder="Search items, categories, or type a command..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
          />
          <kbd className="command-palette__kbd">esc</kbd>
        </div>
        <div className="command-palette__results" ref={listRef}>
          {allResults.length === 0 && (
            <div className="command-palette__empty">No results found</div>
          )}
          {allResults.map((result, idx) => (
            <div
              key={result.id}
              className={`command-palette__item ${idx === selectedIndex ? 'command-palette__item--selected' : ''} command-palette__item--${result.type}`}
              onClick={() => result.action()}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <i className={`bx ${result.icon} command-palette__item-icon`} />
              <div className="command-palette__item-content">
                <span className="command-palette__item-label">{result.label}</span>
                {result.secondary && (
                  <span className="command-palette__item-secondary">{result.secondary}</span>
                )}
              </div>
              {result.type === 'command' && (
                <span className="command-palette__item-type">Command</span>
              )}
              {result.type === 'category' && (
                <span className="command-palette__item-type">Go to</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

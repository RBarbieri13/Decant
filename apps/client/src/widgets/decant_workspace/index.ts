/**
 * Decant Workspace Widget
 *
 * Barrel export for the Toby-like visual workspace.
 */

export { default } from "./DecantWorkspaceWidget.js";
export { default as DecantWorkspaceWidget } from "./DecantWorkspaceWidget.js";

// Types
export type {
    ContentType,
    SpaceColor,
    ViewMode,
    DecantItem,
    DecantCollection,
    DecantSpace,
    WorkspaceState,
    WorkspaceAction,
    WorkspaceContextValue,
    DragItem,
    ContentTypeConfig
} from "./types/workspace.types.js";

export { CONTENT_TYPE_CONFIG, SPACE_COLOR_MAP } from "./types/workspace.types.js";

// Context
export { WorkspaceProvider, useWorkspace, useWorkspaceState, useWorkspaceActions } from "./context/WorkspaceContext.js";

// Hooks
export { useDecantNotes } from "./hooks/useDecantNotes.js";

// Components
export { ContentTypeBadge } from "./components/ContentTypeBadge.js";
export { ItemCard } from "./components/ItemCard.js";
export { SpaceItem } from "./components/SpaceItem.js";
export { SpacesSidebar } from "./components/SpacesSidebar.js";
export { CollectionCard } from "./components/CollectionCard.js";
export { CollectionsPanel } from "./components/CollectionsPanel.js";
export { WorkspaceToolbar } from "./components/WorkspaceToolbar.js";

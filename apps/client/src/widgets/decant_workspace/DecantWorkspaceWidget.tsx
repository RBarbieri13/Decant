/**
 * Decant Workspace Widget
 *
 * Main entry point for the Toby-like visual workspace.
 * Displays Spaces → Collections → Items in a Gumroad-styled UI.
 */

import type { TypeWidgetProps } from "../type_widgets/type_widget.js";
import { WorkspaceProvider } from "./context/WorkspaceContext.js";
import { SpacesSidebar } from "./components/SpacesSidebar.js";
import { CollectionsPanel } from "./components/CollectionsPanel.js";
import { WorkspaceToolbar } from "./components/WorkspaceToolbar.js";
import { useDecantNotes } from "./hooks/useDecantNotes.js";

// Import styles
import "./styles/gumroad-variables.css";
import "./styles/workspace.css";

/**
 * Inner component that uses the hook within the provider
 */
function WorkspaceContent() {
    return (
        <div className="decant-workspace gum-bg">
            <SpacesSidebar />
            <main className="workspace-main">
                <WorkspaceToolbar />
                <CollectionsPanel />
            </main>
        </div>
    );
}

/**
 * Main Decant Workspace Widget
 */
export default function DecantWorkspaceWidget({ note }: TypeWidgetProps) {
    const { fetchSpaces } = useDecantNotes();

    return (
        <WorkspaceProvider
            rootNoteId={note.noteId}
            onFetchSpaces={fetchSpaces}
        >
            <WorkspaceContent />
        </WorkspaceProvider>
    );
}

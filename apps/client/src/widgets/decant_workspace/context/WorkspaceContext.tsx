/**
 * Workspace Context Provider
 *
 * Manages global state for the Decant Workspace widget.
 */

import { createContext } from "preact";
import { useContext, useReducer, useCallback, useMemo } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type {
    WorkspaceState,
    WorkspaceAction,
    WorkspaceContextValue,
    DecantSpace,
    DecantCollection
} from "../types/workspace.types.js";

/**
 * Initial workspace state
 */
const initialState: WorkspaceState = {
    spaces: [],
    selectedSpaceId: null,
    selectedCollectionId: null,
    viewMode: 'grid',
    searchQuery: '',
    isLoading: true,
    error: null
};

/**
 * Workspace state reducer
 */
function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
    switch (action.type) {
        case 'SET_SPACES':
            return {
                ...state,
                spaces: action.payload,
                isLoading: false,
                error: null
            };

        case 'SELECT_SPACE':
            return {
                ...state,
                selectedSpaceId: action.payload,
                selectedCollectionId: null // Reset collection when space changes
            };

        case 'SELECT_COLLECTION':
            return {
                ...state,
                selectedCollectionId: action.payload
            };

        case 'SET_VIEW_MODE':
            return {
                ...state,
                viewMode: action.payload
            };

        case 'SET_SEARCH_QUERY':
            return {
                ...state,
                searchQuery: action.payload
            };

        case 'SET_LOADING':
            return {
                ...state,
                isLoading: action.payload
            };

        case 'SET_ERROR':
            return {
                ...state,
                error: action.payload,
                isLoading: false
            };

        case 'REFRESH':
            return {
                ...state,
                isLoading: true,
                error: null
            };

        default:
            return state;
    }
}

/**
 * Create the context
 */
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Props for WorkspaceProvider
 */
interface WorkspaceProviderProps {
    children: ComponentChildren;
    rootNoteId: string;
    onFetchSpaces: () => Promise<DecantSpace[]>;
}

/**
 * Workspace Provider Component
 */
export function WorkspaceProvider({
    children,
    rootNoteId,
    onFetchSpaces
}: WorkspaceProviderProps) {
    const [state, dispatch] = useReducer(workspaceReducer, initialState);

    /**
     * Fetch spaces from the backend
     */
    const refetch = useCallback(async () => {
        dispatch({ type: 'SET_LOADING', payload: true });

        try {
            const spaces = await onFetchSpaces();
            dispatch({ type: 'SET_SPACES', payload: spaces });

            // Auto-select first space if none selected
            if (!state.selectedSpaceId && spaces.length > 0) {
                dispatch({ type: 'SELECT_SPACE', payload: spaces[0].noteId });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load spaces';
            dispatch({ type: 'SET_ERROR', payload: message });
        }
    }, [onFetchSpaces, state.selectedSpaceId]);

    /**
     * Get the currently selected space
     */
    const selectedSpace = useMemo((): DecantSpace | null => {
        if (!state.selectedSpaceId) return null;
        return state.spaces.find(s => s.noteId === state.selectedSpaceId) || null;
    }, [state.spaces, state.selectedSpaceId]);

    /**
     * Get the currently selected collection
     */
    const selectedCollection = useMemo((): DecantCollection | null => {
        if (!selectedSpace || !state.selectedCollectionId) return null;
        return selectedSpace.collections.find(c => c.noteId === state.selectedCollectionId) || null;
    }, [selectedSpace, state.selectedCollectionId]);

    /**
     * Context value
     */
    const contextValue = useMemo((): WorkspaceContextValue => ({
        state,
        dispatch,
        refetch,
        selectedSpace,
        selectedCollection
    }), [state, dispatch, refetch, selectedSpace, selectedCollection]);

    return (
        <WorkspaceContext.Provider value={contextValue}>
            {children}
        </WorkspaceContext.Provider>
    );
}

/**
 * Hook to access the workspace context
 */
export function useWorkspace(): WorkspaceContextValue {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}

/**
 * Hook to access just the workspace state
 */
export function useWorkspaceState(): WorkspaceState {
    return useWorkspace().state;
}

/**
 * Hook to access workspace actions
 */
export function useWorkspaceActions() {
    const { dispatch, refetch } = useWorkspace();

    return {
        selectSpace: (spaceId: string | null) =>
            dispatch({ type: 'SELECT_SPACE', payload: spaceId }),

        selectCollection: (collectionId: string | null) =>
            dispatch({ type: 'SELECT_COLLECTION', payload: collectionId }),

        setViewMode: (mode: WorkspaceState['viewMode']) =>
            dispatch({ type: 'SET_VIEW_MODE', payload: mode }),

        setSearchQuery: (query: string) =>
            dispatch({ type: 'SET_SEARCH_QUERY', payload: query }),

        refresh: refetch
    };
}

export default WorkspaceContext;

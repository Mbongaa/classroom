import { createContext, useContext, useReducer, ReactNode } from "react";

// State type
export type State = {
  captionsEnabled: boolean;
  captionsLanguage: string;
};

// Action type
export type Action =
  | { type: "SET_CAPTIONS_ENABLED"; payload: boolean }
  | { type: "SET_CAPTIONS_LANGUAGE"; payload: string }
  | { type: "TOGGLE_CAPTIONS" };

// Initial state
const initialState: State = {
  captionsEnabled: false,
  captionsLanguage: "en", // Default to English
};

// Reducer function
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "SET_CAPTIONS_ENABLED":
      return { ...state, captionsEnabled: action.payload };
    case "SET_CAPTIONS_LANGUAGE":
      // When language changes, also enable captions
      return {
        ...state,
        captionsLanguage: action.payload,
        captionsEnabled: true
      };
    case "TOGGLE_CAPTIONS":
      return { ...state, captionsEnabled: !state.captionsEnabled };
    default:
      return state;
  }
};

// Context
export const PartyStateContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
} | null>(null);

// Provider component
export const PartyStateProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <PartyStateContext.Provider value={{ state, dispatch }}>
      {children}
    </PartyStateContext.Provider>
  );
};

// Custom hook for using the context
export const usePartyState = () => {
  const context = useContext(PartyStateContext);
  if (!context) {
    throw new Error("usePartyState must be used within a PartyStateProvider");
  }
  return context;
};
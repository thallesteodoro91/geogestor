import { createContext, useContext } from 'react';

export interface AppIdentity {
  name: string;
  email: string;
  company: string;
}

interface AppSessionContextValue {
  identity: AppIdentity | null;
  lock: () => Promise<void>;
}

const AppSessionContext = createContext<AppSessionContextValue>({
  identity: null,
  lock: async () => undefined
});

export const AppSessionProvider = AppSessionContext.Provider;

export function useAppSession() {
  return useContext(AppSessionContext);
}

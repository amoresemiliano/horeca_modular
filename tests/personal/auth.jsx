import { createContext, useContext } from 'react';
export const TestAuth = createContext(null);
export const useAuth = () => useContext(TestAuth);

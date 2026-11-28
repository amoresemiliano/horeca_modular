import {createContext,useContext} from 'react';
export const FixtureAuth=createContext(null);
export const useAuth=()=>useContext(FixtureAuth);

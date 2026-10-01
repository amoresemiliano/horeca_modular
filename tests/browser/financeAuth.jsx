import {createContext,useContext} from 'react';
export const FinanceAuth=createContext(null);
export const useAuth=()=>useContext(FinanceAuth);

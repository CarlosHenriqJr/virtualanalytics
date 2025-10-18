import React, { createContext, useContext, useState } from 'react';
import { mockMatches } from '../data/mockData';

const MatchesContext = createContext();

export const useMatches = () => {
  const context = useContext(MatchesContext);
  if (!context) {
    throw new Error('useMatches must be used within MatchesProvider');
  }
  return context;
};

export const MatchesProvider = ({ children }) => {
  const [matches, setMatches] = useState(mockMatches);

  return (
    <MatchesContext.Provider value={{ matches, setMatches }}>
      {children}
    </MatchesContext.Provider>
  );
};

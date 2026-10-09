import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from './theme';

type ThemeContextType = {
  theme: typeof lightTheme;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType>({ theme: lightTheme, isDark: false });

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme();
  const [scheme, setScheme] = useState(systemScheme ?? 'light');

  const theme = useMemo(
    () => (scheme === 'dark' ? darkTheme : lightTheme),
    [scheme]
  );

  const isDark = scheme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );

};

export const useTheme = () => {
  return useContext(ThemeContext);
};

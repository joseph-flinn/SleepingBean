export const lightTheme = {
  colors: {
    background: '#03110d',
    card: '#032017',
    border: 'rgba(218, 181, 137, 0.2)',
    tabActive: 'rgba(234, 210, 172, 0.08)',
    tabHover: 'rgba(216, 181, 137, 0.05)',
    text: '#c3b597',
    textSecondary: '#EAD2AC',
    textMuted: '#D8B589',
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radii: { sm: 4, md: 8, lg: 16 },
  typography: {
    title: { fontSize: 24, fontWeight: '700' },
    body: { fontSize: 16, fontWeight: '400' },
    caption: { fontSize: 12, fontWeight: '400' },
  },
  shadowElevation: '0 20px 40px rgba(0, 0, 0, 0.4)',
};

export type AppTheme = typeof lightTheme;

export const darkTheme = {
  ...lightTheme,
  colors: {
    background: '#03110d',
    card: '#032017',
    border: 'rgba(216, 181, 137, 0.1)',
    tabActive: 'rgba(234, 210, 172, 0.08)',
    tabHover: 'rgba(216, 181, 137, 0.05)',
    text: '#c3b597',
    textSecondary: '#EAD2AC',
    textMuted: '#D8B589',
  }
};

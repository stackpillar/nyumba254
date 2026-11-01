export type ThemeName = 'emerald' | 'sandstone' | 'midnight';

export type Theme = {
  name: ThemeName;
  label: string;
  dark: boolean;
  green: string;
  greenLight: string;
  greenMid: string;
  greenDark: string;
  gold: string;
  goldLight: string;
  text: string;
  text2: string;
  text3: string;
  border: string;
  surface: string;
  card: string;
  red: string;
  redLight: string;
  amber: string;
  amberLight: string;
};

// Values copied from the website's dashboard.css and nk-shared.css so the app matches the site.
export const THEMES: Record<ThemeName, Theme> = {
  emerald: {
    name: 'emerald', label: 'Emerald', dark: false,
    green: '#0F6E56', greenLight: '#E1F5EE', greenMid: '#1D9E75', greenDark: '#085041',
    gold: '#BA7517', goldLight: '#FAEEDA',
    text: '#1a1a18', text2: '#4a4a46', text3: '#6b6a64',
    border: '#e0ded8', surface: '#f7f6f2', card: '#ffffff',
    red: '#C53030', redLight: '#FFF5F5', amber: '#7a4f00', amberLight: '#FFF7E6',
  },
  sandstone: {
    name: 'sandstone', label: 'Sandstone', dark: false,
    green: '#8a5a2c', greenLight: '#f4e9da', greenMid: '#b17a3f', greenDark: '#5f3c17',
    gold: '#b8860b', goldLight: '#faf1de',
    text: '#2b241c', text2: '#5c5142', text3: '#756c58',
    border: '#e6d9c2', surface: '#faf5ea', card: '#fffdf8',
    red: '#b5432f', redLight: '#f7e3dc', amber: '#c2790f', amberLight: '#f7ecd6',
  },
  midnight: {
    name: 'midnight', label: 'Midnight', dark: true,
    green: '#22c58f', greenLight: '#0f2a22', greenMid: '#2ee6a8', greenDark: '#0a4636',
    gold: '#e0a638', goldLight: '#2b2214',
    text: '#eef1ee', text2: '#c3c8c3', text3: '#8b928c',
    border: '#2c332f', surface: '#121613', card: '#191f1b',
    red: '#ef6455', redLight: '#3a1a17', amber: '#f2b23c', amberLight: '#332911',
  },
};

export const RADIUS = 10;
export const RADIUS_LG = 16;
export const FONT = {
  serif: 'PlayfairDisplay_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemi: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
};

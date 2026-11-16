module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: { extend: {
    colors: { wine: { DEFAULT: '#722F37', deep: '#8B1E24' }, gold: { DEFAULT: '#D4AF37', light: '#F3E5AB' }, cream: '#FDFBF7', espresso: '#1C1917', fir: '#1E4620' },
    fontFamily: { serif: ['"Frank Ruhl Libre"', 'serif'], sans: ['Heebo', 'system-ui', 'sans-serif'], latin: ['"Playfair Display"', '"Frank Ruhl Libre"', 'serif'] },
  } },
};

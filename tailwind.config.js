module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: { extend: {
    colors: { wine: { DEFAULT: '#722F37', deep: '#8B1E24' }, gold: { DEFAULT: '#D4AF37', light: '#F3E5AB' }, cream: '#FDFBF7', espresso: '#1C1917', fir: '#1E4620' },
    fontFamily: { serif: ['Rubik', 'Heebo', 'sans-serif'], sans: ['Heebo', 'system-ui', 'sans-serif'], hand: ['"Amatic SC"', 'Rubik', 'cursive'], latin: ['"Playfair Display"', 'Rubik', 'serif'] },
  } },
};

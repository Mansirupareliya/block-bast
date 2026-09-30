// Every game shown on the hub. Shared by Home (the grid) and Settings
// (the Favorites list).
export const GAMES = [
  {
    id: 'memorymatch',
    name: 'Matchmaker',
    category: 'MEMORY',
    accent: '#FFB800',
    gradientColors: ['#FFD52E', '#FFB800', '#F29900'],
    image: require('../assets/matchmaker_logo.jpg'),
    cardImage: require('../assets/matchmaker_card.png'), // full card art, 600x734
    cardAspect: 600 / 734,
  },
  {
    id: 'tictactoe',
    name: 'Tic-Tac-Toe',
    category: 'STRATEGY',
    accent: '#EE2244',
    gradientColors: ['#FF7070', '#EE2244', '#AA0022'],
    image: require('../assets/tictactoe_logo.jpg'),
    cardImage: require('../assets/tictactoe_card.png'), // full card art, 600x719
    cardAspect: 600 / 719,
  },
  {
    id: 'blockblast',
    name: 'Block Puzzle',
    category: 'PUZZLE',
    accent: '#1E80F0',
    gradientColors: ['#60B8FF', '#1E80F0', '#0A55CC'],
    image: require('../assets/blockblast_logo_v2.jpg'),
    cardImage: require('../assets/blockblast_card.png'), // full card art, 600x772
    cardAspect: 600 / 772,
  },
  {
    id: 'boxpusher',
    name: 'Box Pusher',
    category: 'PUZZLE',
    accent: '#5B8DEF',
    gradientColors: ['#6FA0FF', '#48598C', '#141A2B'],
    image: require('../assets/boxpusher_logo.jpg'),
    cardImage: require('../assets/boxpusher_card.png'), // full card art, 600x716
    cardAspect: 600 / 716,
  },
  {
    id: 'dogsblocks',
    name: 'Dogs Blocks',
    category: 'PUZZLE',
    accent: '#C68642',
    gradientColors: ['#F0C080', '#E8A045', '#C68642'],
    image: require('../assets/dogsblocks_logo.jpg'),
    disabled: true, // temporarily taken out of rotation — flip back on when ready
  },
];

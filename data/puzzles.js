const PUZZLES = [
  {
    id: 'L1-P01',
    act: 'Teach',
    layer: 1,
    terrain: [
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','river', 'ground','ground'],
      ['ground','ground','river', 'ground','ground'],
      ['ground','ground','ground','ground','ground']
    ],
    spirit_start: [0, 1],
    goal: [4, 1],
    available_chars: ['木'],
    overrides: []
  },
  {
    id: 'L1-P02',
    act: 'Teach',
    layer: 1,
    terrain: [
      ['ground','ground','ground','ground','ground'],
      ['ground','thorns','thorns','ground','ground'],
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','ground','ground','ground']
    ],
    spirit_start: [0, 1],
    goal: [4, 1],
    available_chars: ['火'],
    overrides: []
  },
  {
    id: 'L1-P03',
    act: 'Choose',
    layer: 1,
    terrain: [
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','dark',  'ground','ground'],
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','ground','ground','ground']
    ],
    spirit_start: [0, 1],
    goal: [4, 1],
    available_chars: ['日', '月'],
    overrides: []
  },
  {
    id: 'L1-P04',
    act: 'Choose',
    layer: 1,
    terrain: [
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','river', 'ground','ground'],
      ['ground','ground','river', 'ground','ground'],
      ['ground','ground','ground','ground','ground']
    ],
    spirit_start: [0, 1],
    goal: [4, 1],
    available_chars: ['木', '山', '水'],
    overrides: []
  },
  {
    id: 'L1-P05',
    act: 'Choose',
    layer: 1,
    terrain: [
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','thorns','ground','ground'],
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','ground','ground','ground']
    ],
    spirit_start: [0, 1],
    goal: [4, 1],
    available_chars: ['火', '刀', '手', '雨'],
    overrides: []
  },
  {
    id: 'L1-P06',
    act: 'Choose',
    layer: 1,
    terrain: [
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','dark',  'dark',  'ground'],
      ['ground','ground','ground','ground','ground'],
      ['ground','ground','ground','ground','ground']
    ],
    spirit_start: [0, 1],
    goal: [4, 1],
    available_chars: ['日', '目', '月'],
    overrides: []
  }
];

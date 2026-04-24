export const colors = {
  ink: {
    aubergineDeep: '#2A1332',
    aubergine: '#3B1F47',
    aubergineLift: '#4B2B58',
    aubergineHair: '#5C3A69',
  },
  paper: {
    bone: '#F0E8D8',
    boneMuted: '#C9C0AE',
    boneFaint: '#8F8877',
  },
  ochre: {
    gold: '#C79A3A',
    goldDeep: '#8E6C20',
  },
  nightmare: {
    vermilion: '#B23A3A',
    vermilionDeep: '#6A1E1E',
  },
  hope: {
    sage: '#7A9A7A',
    sageDeep: '#3E5A3E',
  },
} as const;

export type Colors = typeof colors;

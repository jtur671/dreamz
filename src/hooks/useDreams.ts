import { useContext } from 'react';
import { DreamContext } from '../context/DreamContext';

export function useDreams() {
  return useContext(DreamContext);
}

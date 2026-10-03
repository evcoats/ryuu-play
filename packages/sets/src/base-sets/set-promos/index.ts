import { Card } from '@ptcg/common';
import { Mew } from './mew';
import { Mewtwo } from './mewtwo';

// Wizards Black Star Promos. Only the cards that appear in archived WotC-era
// tournament lists are implemented; numbering follows the English promo set.
export const setPromos: Card[] = [
  new Mew(),      // #8 (identical text to #9)
  new Mewtwo(),   // #3 "Movie Promo" (identical text to #14)
];

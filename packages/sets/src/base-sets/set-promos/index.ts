import { Card } from '@ptcg/common';
import { ArcaninePR6 } from './arcanine';
import { ComputerErrorPR16 } from './computer-error';
import { CoolPorygonPR15 } from './cool-porygon';
import { DragonitePR5 } from './dragonite';
import { EeveePR11 } from './eevee';
import { ElectabuzzPR2 } from './electabuzz';
import { JigglypuffPR7 } from './jigglypuff';
import { MeowthPR10 } from './meowth';
import { Mew } from './mew';
import { Mewtwo } from './mewtwo';
import { MewtwoPR12 } from './mewtwo-pr12';
import { PikachuPR1 } from './pikachu-pr1';
import { PikachuPR4 } from './pikachu-pr4';
import { VenusaurPR13 } from './venusaur';

// Wizards Black Star Promos #1-#16, every promo legal in the July 22, 2000 format.
// Numbering follows the English promo set. CardManager requires unique fullNames,
// so the printings added after Mewtwo PR / Mew PR carry their number ('Pikachu PR1').
// The engine's Card has no set-number field; the number lives in the fullName.
export const setPromos: Card[] = [
  new PikachuPR1(),        // #1
  new ElectabuzzPR2(),     // #2
  new Mewtwo(),            // #3 "Movie Promo"; #14 is an identical reprint (no separate class)
  new PikachuPR4(),        // #4
  new DragonitePR5(),      // #5
  new ArcaninePR6(),       // #6
  new JigglypuffPR7(),     // #7
  new Mew(),               // #8; #9 is an identical reprint (no separate class)
  new MeowthPR10(),        // #10
  new EeveePR11(),         // #11
  new MewtwoPR12(),        // #12
  new VenusaurPR13(),      // #13
  new CoolPorygonPR15(),   // #15
  new ComputerErrorPR16(), // #16
];

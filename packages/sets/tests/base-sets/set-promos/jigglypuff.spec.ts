import {
  AttackAction,
  CardType,
  Simulator,
} from "@ptcg/common";

import { JigglypuffPR7 } from "../../../src/base-sets/set-promos/jigglypuff";
import { setPromos } from "../../../src/base-sets/set-promos";
import { Pluspower } from "../../../src/base-sets/set-base/pluspower";
import { Hitmonchan } from "../../../src/base-sets/set-base/hitmonchan";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

describe('Jigglypuff PR7', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new JigglypuffPR7() ], [ CardType.COLORLESS, CardType.COLORLESS, CardType.COLORLESS ]);
  });

  it('Should be registered as promo #7', () => {
    expect(setPromos.some(c => c.fullName === 'Jigglypuff PR7')).toBe(true);
  });

  describe('First Aid', () => {
    it('Should remove 1 damage counter from Jigglypuff', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      player.active.damage = 30;
      sim.dispatch(new AttackAction(1, 'First Aid'));
      expect(player.active.damage).toEqual(20);
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should do nothing to an undamaged Jigglypuff', () => {
      const { player } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'First Aid'));
      expect(player.active.damage).toEqual(0);
    });
  });

  describe('Double-edge', () => {
    it('Should do 40 damage and 20 to itself', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Double-edge'));
      expect(opponent.active.damage).toEqual(40);
      expect(player.active.damage).toEqual(20);
    });

    it('Should apply Weakness and Resistance to the Defending Pokemon only', () => {
      const weak = new TestPokemon();
      weak.weakness = [ { type: CardType.COLORLESS } ];
      TestUtils.setDefending(sim, [ weak ]);
      const { player, opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Double-edge'));
      expect(opponent.active.damage).toEqual(80);
      expect(player.active.damage).toEqual(20);
    });

    it('Should apply Resistance', () => {
      const resistant = new TestPokemon();
      resistant.resistance = [ { type: CardType.COLORLESS, value: -30 } ];
      TestUtils.setDefending(sim, [ resistant ]);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Double-edge'));
      expect(opponent.active.damage).toEqual(10);
    });

    it('Should not add PlusPower to the damage Jigglypuff does to itself', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      player.active.trainers.cards = [ new Pluspower() ];
      sim.dispatch(new AttackAction(1, 'Double-edge'));
      expect(opponent.active.damage).toEqual(50);
      expect(player.active.damage).toEqual(20);
    });

    it('Should knock Jigglypuff out when it has 30 or more damage', () => {
      TestUtils.setDefending(sim, [ new Hitmonchan() ]);
      const { player, discard } = TestUtils.getAll(sim);
      player.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      player.active.damage = 30;
      sim.dispatch(new AttackAction(1, 'Double-edge'));
      expect(discard.cards.some(c => c instanceof JigglypuffPR7)).toBe(true);
    });
  });
});

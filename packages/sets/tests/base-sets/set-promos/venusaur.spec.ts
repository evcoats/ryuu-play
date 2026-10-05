import {
  AttackAction,
  CardType,
  GameMessage,
  PassTurnAction,
  PokemonSlot,
  Simulator,
  SpecialCondition,
  UseAbilityAction,
} from "@ptcg/common";

import { VenusaurPR13 } from "../../../src/base-sets/set-promos/venusaur";
import { setPromos } from "../../../src/base-sets/set-promos";
import { Grimer } from "../../../src/base-sets/set-fossil/grimer";
import { Muk } from "../../../src/base-sets/set-fossil/muk";
import { Pluspower } from "../../../src/base-sets/set-base/pluspower";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

describe('Venusaur PR13', () => {
  let sim: Simulator;
  const grass4 = [ CardType.GRASS, CardType.GRASS, CardType.GRASS, CardType.GRASS ];

  const errorOf = (fn: () => void): string => {
    try {
      fn();
    } catch (error) {
      return TestUtils.getErrorMessage(error);
    }
    return '';
  };

  it('Should be registered as promo #13', () => {
    expect(setPromos.some(c => c.fullName === 'Venusaur PR13')).toBe(true);
  });

  describe('Solar Power', () => {
    beforeEach(() => {
      sim = TestUtils.createTestSimulator();
      const { player, opponent } = TestUtils.getAll(sim);
      player.bench[0] = TestUtils.pokemonSlot([ new VenusaurPR13() ]);
      player.active.specialConditions = [ SpecialCondition.ASLEEP, SpecialCondition.POISONED ];
      opponent.active.specialConditions = [ SpecialCondition.CONFUSED, SpecialCondition.POISONED ];
    });

    const use = (slot?: PokemonSlot) => {
      const { player } = TestUtils.getAll(sim);
      sim.dispatch(new UseAbilityAction(1, 'Solar Power', TestUtils.target(sim, slot || player.bench[0])));
    };

    it('Should cure both Active Pokemon of Asleep, Confused, Paralyzed and Poisoned', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      use();
      expect(player.active.specialConditions).toEqual([]);
      expect(opponent.active.specialConditions).toEqual([]);
    });

    it('Should cure Paralysis', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      player.active.specialConditions = [ SpecialCondition.PARALYZED ];
      opponent.active.specialConditions = [ SpecialCondition.PARALYZED ];
      use();
      expect(player.active.specialConditions).toEqual([]);
      expect(opponent.active.specialConditions).toEqual([]);
    });

    it('Should not touch damage counters or Benched Pokemon', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      player.active.damage = 20;
      opponent.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      opponent.bench[0].specialConditions = [ SpecialCondition.POISONED ];
      use();
      expect(player.active.damage).toEqual(20);
      expect(opponent.bench[0].specialConditions).toEqual([ SpecialCondition.POISONED ]);
    });

    it('Should be usable once per turn', () => {
      use();
      TestUtils.getAll(sim).opponent.active.specialConditions = [ SpecialCondition.ASLEEP ];
      expect(errorOf(() => use())).toEqual(GameMessage.POWER_ALREADY_USED);
    });

    it('Should be usable again next turn', () => {
      use();
      sim.dispatch(new PassTurnAction(1));
      sim.dispatch(new PassTurnAction(2));
      const { opponent } = TestUtils.getAll(sim);
      opponent.active.specialConditions = [ SpecialCondition.ASLEEP ];
      use();
      expect(opponent.active.specialConditions).toEqual([]);
    });

    it('Should not be usable while Venusaur is Asleep, Confused or Paralyzed', () => {
      for (const condition of [ SpecialCondition.ASLEEP, SpecialCondition.CONFUSED, SpecialCondition.PARALYZED ]) {
        sim = TestUtils.createTestSimulator();
        TestUtils.setActive(sim, [ new VenusaurPR13() ]);
        const { player, opponent } = TestUtils.getAll(sim);
        player.active.specialConditions = [ condition ];
        opponent.active.specialConditions = [ SpecialCondition.POISONED ];
        expect(errorOf(() => use(player.active))).toEqual(GameMessage.CANNOT_USE_POWER);
      }
    });

    it('Should be usable while Venusaur is Poisoned, curing itself', () => {
      sim = TestUtils.createTestSimulator();
      TestUtils.setActive(sim, [ new VenusaurPR13() ]);
      const { player } = TestUtils.getAll(sim);
      player.active.specialConditions = [ SpecialCondition.POISONED ];
      use(player.active);
      expect(player.active.specialConditions).toEqual([]);
    });

    it('Should not be usable when there is nothing to cure', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      player.active.specialConditions = [];
      opponent.active.specialConditions = [];
      expect(errorOf(() => use())).toEqual(GameMessage.CANNOT_USE_POWER);
    });

    it('Should be blocked by Muk\'s Toxic Gas', () => {
      TestUtils.getAll(sim).opponent.bench[0] = TestUtils.pokemonSlot([ new Grimer(), new Muk() ]);
      expect(errorOf(() => use())).toEqual(GameMessage.BLOCKED_BY_ABILITY);
    });
  });

  describe('Mega Drain', () => {
    beforeEach(() => {
      sim = TestUtils.createTestSimulator();
      TestUtils.setActive(sim, [ new VenusaurPR13() ], grass4);
      TestUtils.getAll(sim).player.active.damage = 60;
    });

    it('Should do 40 damage and heal half of it', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Mega Drain'));
      expect(opponent.active.damage).toEqual(40);
      expect(player.active.damage).toEqual(40);
    });

    it('Should heal half the damage after Weakness', () => {
      const weak = new TestPokemon();
      weak.weakness = [ { type: CardType.GRASS } ];
      TestUtils.setDefending(sim, [ weak ]);
      const { player, opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Mega Drain'));
      expect(opponent.active.damage).toEqual(80);
      expect(player.active.damage).toEqual(20);
    });

    it('Should round the heal up to the nearest 10 (Resistance: 10 done, 10 healed)', () => {
      const resistant = new TestPokemon();
      resistant.resistance = [ { type: CardType.GRASS, value: -30 } ];
      TestUtils.setDefending(sim, [ resistant ]);
      const { player, opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Mega Drain'));
      expect(opponent.active.damage).toEqual(10);
      expect(player.active.damage).toEqual(50);
    });

    it('Should count PlusPower as damage done (50 done, 30 healed)', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      player.active.trainers.cards = [ new Pluspower() ];
      sim.dispatch(new AttackAction(1, 'Mega Drain'));
      expect(opponent.active.damage).toEqual(50);
      expect(player.active.damage).toEqual(30);
    });

    it('Should remove all counters when Venusaur has fewer', () => {
      const { player } = TestUtils.getAll(sim);
      player.active.damage = 10;
      sim.dispatch(new AttackAction(1, 'Mega Drain'));
      expect(player.active.damage).toEqual(0);
    });

    it('Should heal nothing when no damage is done', () => {
      const resistant = new TestPokemon();
      resistant.resistance = [ { type: CardType.GRASS, value: -30 }, { type: CardType.GRASS, value: -30 } ];
      TestUtils.setDefending(sim, [ resistant ]);
      const { player, opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Mega Drain'));
      expect(opponent.active.damage).toEqual(0);
      expect(player.active.damage).toEqual(60);
    });
  });
});

import {
  AttackAction,
  BotFlipMode,
  BotShuffleMode,
  CardType,
  PassTurnAction,
  PokemonCard,
  Simulator,
  SpecialCondition,
} from "@ptcg/common";

import { PikachuPR1 } from "../../../src/base-sets/set-promos/pikachu-pr1";
import { setPromos } from "../../../src/base-sets/set-promos";
import { Hitmonchan } from "../../../src/base-sets/set-base/hitmonchan";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

function typed(weakness: CardType[] = [], resistance: CardType[] = []): PokemonCard {
  const card = new TestPokemon();
  card.weakness = weakness.map(type => ({ type }));
  card.resistance = resistance.map(type => ({ type, value: -30 }));
  return card;
}

describe('Pikachu PR1', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new PikachuPR1() ], [ CardType.LIGHTNING, CardType.LIGHTNING ]);
    TestUtils.setDefending(sim, [ new Hitmonchan() ], [ CardType.FIGHTING ]);
  });

  it('Should be registered as promo #1 with a unique full name', () => {
    const card = setPromos.find(c => c.fullName === 'Pikachu PR1') as PikachuPR1;
    expect(card instanceof PikachuPR1).toBe(true);
    expect(card.hp).toEqual(60);
    expect(card.name).toEqual('Pikachu');
    const names = setPromos.map(c => c.fullName);
    expect(new Set(names).size).toEqual(names.length);
  });

  describe('Thundershock', () => {
    it('Should do 20 damage and Paralyze on heads', () => {
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Thundershock'));
      expect(opponent.active.damage).toEqual(20);
      expect(opponent.active.specialConditions).toEqual([ SpecialCondition.PARALYZED ]);
    });

    it('Should do 20 damage and not Paralyze on tails', () => {
      sim = TestUtils.createTestSimulator({ flipMode: BotFlipMode.ALL_TAILS, shuffleMode: BotShuffleMode.REVERSE });
      TestUtils.setActive(sim, [ new PikachuPR1() ], [ CardType.LIGHTNING, CardType.LIGHTNING ]);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Thundershock'));
      expect(opponent.active.damage).toEqual(20);
      expect(opponent.active.specialConditions).toEqual([]);
    });

    it('Should apply Weakness', () => {
      TestUtils.setDefending(sim, [ typed([ CardType.LIGHTNING ]) ]);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Thundershock'));
      expect(opponent.active.damage).toEqual(40);
    });

    it('Should apply Resistance', () => {
      TestUtils.setDefending(sim, [ typed([], [ CardType.LIGHTNING ]) ]);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Thundershock'));
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should need two Lightning Energy', () => {
      TestUtils.setActive(sim, [ new PikachuPR1() ], [ CardType.LIGHTNING, CardType.COLORLESS ]);
      expect(() => sim.dispatch(new AttackAction(1, 'Thundershock'))).toThrow();
    });
  });

  describe('Growl', () => {
    it('Should do no damage itself', () => {
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Growl'));
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should reduce the Defending Pokemon attack by 10 after Weakness', () => {
      const { player } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Growl'));
      // Jab 20, x2 for Fighting Weakness = 40, then -10
      sim.dispatch(new AttackAction(2, 'Jab'));
      expect(player.active.damage).toEqual(30);
    });

    it('Should not reduce an attack by a different Pokemon', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      opponent.bench[0] = TestUtils.pokemonSlot([ new Hitmonchan() ], [ CardType.FIGHTING ]);
      sim.dispatch(new AttackAction(1, 'Growl'));
      opponent.switchPokemon(opponent.bench[0]);
      sim.dispatch(new AttackAction(2, 'Jab'));
      expect(player.active.damage).toEqual(40);
    });

    it('Should end when the Defending Pokemon is benched', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      opponent.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      sim.dispatch(new AttackAction(1, 'Growl'));
      const defending = opponent.active;
      opponent.switchPokemon(opponent.bench[0]);
      opponent.switchPokemon(defending);
      expect(opponent.active).toBe(defending);
      sim.dispatch(new AttackAction(2, 'Jab'));
      expect(player.active.damage).toEqual(40);
    });

    it('Should end when Pikachu is benched', () => {
      const { player } = TestUtils.getAll(sim);
      player.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      sim.dispatch(new AttackAction(1, 'Growl'));
      const pikachu = player.active;
      player.switchPokemon(player.bench[0]);
      player.switchPokemon(pikachu);
      expect(player.active).toBe(pikachu);
      sim.dispatch(new AttackAction(2, 'Jab'));
      expect(player.active.damage).toEqual(40);
    });

    it('Should only last for the opponent\'s next turn', () => {
      const { player } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Growl'));
      sim.dispatch(new PassTurnAction(2));
      sim.dispatch(new PassTurnAction(1));
      sim.dispatch(new AttackAction(2, 'Jab'));
      expect(player.active.damage).toEqual(40);
    });
  });
});

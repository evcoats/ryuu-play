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

import { ElectabuzzPR2 } from "../../../src/base-sets/set-promos/electabuzz";
import { PikachuPR1 } from "../../../src/base-sets/set-promos/pikachu-pr1";
import { setPromos } from "../../../src/base-sets/set-promos";
import { Hitmonchan } from "../../../src/base-sets/set-base/hitmonchan";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

function attacker(damage: number, cardTypes: CardType[] = []): PokemonCard {
  const card = new TestPokemon();
  card.cardTypes = cardTypes;
  card.attacks = [ { name: 'Test attack', cost: [], damage: String(damage), text: '' } ];
  return card;
}

describe('Electabuzz PR2', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new ElectabuzzPR2() ], [ CardType.LIGHTNING, CardType.COLORLESS ]);
    TestUtils.setDefending(sim, [ new Hitmonchan() ], [ CardType.FIGHTING, CardType.FIGHTING, CardType.FIGHTING ]);
  });

  it('Should be registered as promo #2', () => {
    expect(setPromos.some(c => c.fullName === 'Electabuzz PR2')).toBe(true);
  });

  describe('Quick Attack', () => {
    it('Should do 30 damage on heads', () => {
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Quick Attack'));
      expect(opponent.active.damage).toEqual(30);
    });

    it('Should do 10 damage on tails', () => {
      sim = TestUtils.createTestSimulator({ flipMode: BotFlipMode.ALL_TAILS, shuffleMode: BotShuffleMode.REVERSE });
      TestUtils.setActive(sim, [ new ElectabuzzPR2() ], [ CardType.LIGHTNING, CardType.COLORLESS ]);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Quick Attack'));
      expect(opponent.active.damage).toEqual(10);
    });

    it('Should apply Weakness to the total', () => {
      const defending = new TestPokemon();
      defending.weakness = [ { type: CardType.LIGHTNING } ];
      TestUtils.setDefending(sim, [ defending ]);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Quick Attack'));
      expect(opponent.active.damage).toEqual(60);
    });
  });

  describe('Light Screen', () => {
    it('Should do no damage itself', () => {
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Light Screen'));
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should halve damage after Weakness', () => {
      const { player } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Light Screen'));
      // Special Punch 40, x2 for Weakness = 80, halved = 40
      sim.dispatch(new AttackAction(2, 'Special Punch'));
      expect(player.active.damage).toEqual(40);
    });

    it('Should halve after Weakness, not before (30 x2 = 60 -> 30, not 15 -> 10 x2 = 20)', () => {
      TestUtils.setDefending(sim, [ attacker(30, [ CardType.FIGHTING ]) ]);
      const { player } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Light Screen'));
      sim.dispatch(new AttackAction(2, 'Test attack'));
      expect(player.active.damage).toEqual(30);
    });

    it('Should round down to the nearest 10', () => {
      TestUtils.setDefending(sim, [ attacker(30) ]);
      const { player } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Light Screen'));
      sim.dispatch(new AttackAction(2, 'Test attack'));
      expect(player.active.damage).toEqual(10);
    });

    it('Should protect against any attacking Pokemon, not just the Defending one', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      opponent.bench[0] = TestUtils.pokemonSlot([ attacker(40) ]);
      sim.dispatch(new AttackAction(1, 'Light Screen'));
      opponent.switchPokemon(opponent.bench[0]);
      sim.dispatch(new AttackAction(2, 'Test attack'));
      expect(player.active.damage).toEqual(20);
    });

    it('Should still let other effects of the attack happen', () => {
      TestUtils.setDefending(sim, [ new PikachuPR1() ], [ CardType.LIGHTNING, CardType.LIGHTNING ]);
      const { player } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Light Screen'));
      sim.dispatch(new AttackAction(2, 'Thundershock'));
      expect(player.active.damage).toEqual(10);
      expect(player.active.specialConditions).toContain(SpecialCondition.PARALYZED);
    });

    it('Should end when Electabuzz is benched', () => {
      const { player } = TestUtils.getAll(sim);
      player.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      sim.dispatch(new AttackAction(1, 'Light Screen'));
      const electabuzz = player.active;
      player.switchPokemon(player.bench[0]);
      player.switchPokemon(electabuzz);
      expect(player.active).toBe(electabuzz);
      // Jab 20 x2 = 40, not halved to 20
      sim.dispatch(new AttackAction(2, 'Jab'));
      expect(player.active.damage).toEqual(40);
    });

    it('Should only last for the opponent\'s next turn', () => {
      const { player } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Light Screen'));
      sim.dispatch(new PassTurnAction(2));
      sim.dispatch(new PassTurnAction(1));
      sim.dispatch(new AttackAction(2, 'Jab'));
      expect(player.active.damage).toEqual(40);
    });
  });
});

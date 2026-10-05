import {
  AttackAction,
  BotFlipMode,
  BotShuffleMode,
  CardType,
  ChooseEnergyPrompt,
  GameMessage,
  ResolvePromptAction,
  Simulator,
} from "@ptcg/common";

import { ArcaninePR6 } from "../../../src/base-sets/set-promos/arcanine";
import { setPromos } from "../../../src/base-sets/set-promos";
import { FireEnergy } from "../../../src/base-sets/set-base/fire-energy";
import { DoubleColorlessEnergy } from "../../../src/base-sets/set-base/double-colorless-energy";
import { RainbowEnergy } from "../../../src/base-sets/set-team-rocket/rainbow-energy";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

describe('Arcanine PR6', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new ArcaninePR6() ]);
    TestUtils.getAll(sim).player.active.energies.cards = [ new FireEnergy(), new FireEnergy(), new FireEnergy() ];
  });

  const lastEnergyPrompt = (): ChooseEnergyPrompt => {
    const { prompts } = TestUtils.getAll(sim);
    return prompts[prompts.length - 1] as ChooseEnergyPrompt;
  };

  const errorOf = (fn: () => void): string => {
    try {
      fn();
    } catch (error) {
      return TestUtils.getErrorMessage(error);
    }
    return '';
  };

  it('Should be registered as promo #6', () => {
    expect(setPromos.some(c => c.fullName === 'Arcanine PR6')).toBe(true);
  });

  describe('Quick Attack', () => {
    it('Should do 30 damage on heads', () => {
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Quick Attack'));
      expect(opponent.active.damage).toEqual(30);
    });

    it('Should do 10 damage on tails', () => {
      sim = TestUtils.createTestSimulator({ flipMode: BotFlipMode.ALL_TAILS, shuffleMode: BotShuffleMode.REVERSE });
      TestUtils.setActive(sim, [ new ArcaninePR6() ], [ CardType.FIRE, CardType.COLORLESS ]);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Quick Attack'));
      expect(opponent.active.damage).toEqual(10);
    });

    it('Should not discard Energy', () => {
      const { player } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Quick Attack'));
      expect(player.active.energies.cards.length).toEqual(3);
    });
  });

  describe('Flames of Rage', () => {
    it('Should discard exactly 2 Fire Energy cards and do 40 damage', () => {
      const { player, opponent, discard } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Flames of Rage'));

      const prompt = lastEnergyPrompt();
      expect(prompt instanceof ChooseEnergyPrompt).toBe(true);
      expect(prompt.message).toEqual(GameMessage.CHOOSE_ENERGIES_TO_DISCARD);
      expect(prompt.cost).toEqual([ CardType.FIRE, CardType.FIRE ]);
      expect(prompt.options.allowCancel).toBe(false);

      sim.dispatch(new ResolvePromptAction(prompt.id, prompt.energy.slice(0, 2)));
      expect(player.active.energies.cards.length).toEqual(1);
      expect(discard.cards.length).toEqual(2);
      expect(opponent.active.damage).toEqual(40);
    });

    it('Should not accept discarding only 1 Fire Energy', () => {
      sim.dispatch(new AttackAction(1, 'Flames of Rage'));
      const prompt = lastEnergyPrompt();
      expect(prompt.validate(prompt.energy.slice(0, 1))).toBe(false);
      expect(prompt.validate(prompt.energy.slice(0, 2))).toBe(true);
    });

    it('Should not accept discarding a Double Colorless Energy in place of a Fire', () => {
      const { player } = TestUtils.getAll(sim);
      player.active.energies.cards.push(new DoubleColorlessEnergy());
      sim.dispatch(new AttackAction(1, 'Flames of Rage'));
      const prompt = lastEnergyPrompt();
      const dce = prompt.energy.find(e => e.card instanceof DoubleColorlessEnergy)!;
      const fire = prompt.energy.find(e => e.card instanceof FireEnergy)!;
      expect(prompt.validate([ fire, dce ])).toBe(false);
    });

    it('Should not be usable without 2 Fire Energy attached', () => {
      const { player } = TestUtils.getAll(sim);
      player.active.energies.cards = [ new FireEnergy(), new DoubleColorlessEnergy() ];
      expect(errorOf(() => sim.dispatch(new AttackAction(1, 'Flames of Rage')))).toEqual(GameMessage.NOT_ENOUGH_ENERGY);
    });

    it('Should accept Rainbow Energy as one of the Fire Energy (as Arcanine BS Flamethrower)', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      const rainbow = new RainbowEnergy();
      player.active.energies.cards = [ new FireEnergy(), rainbow ];
      sim.dispatch(new AttackAction(1, 'Flames of Rage'));
      const prompt = lastEnergyPrompt();
      sim.dispatch(new ResolvePromptAction(prompt.id, prompt.energy));
      expect(player.active.energies.cards).toEqual([]);
      expect(opponent.active.damage).toEqual(40);
    });

    it('Should add 10 damage for each damage counter on Arcanine', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      player.active.damage = 30;
      sim.dispatch(new AttackAction(1, 'Flames of Rage'));
      const prompt = lastEnergyPrompt();
      sim.dispatch(new ResolvePromptAction(prompt.id, prompt.energy.slice(0, 2)));
      expect(opponent.active.damage).toEqual(70);
    });

    it('Should apply Weakness to the total', () => {
      const weak = new TestPokemon();
      weak.weakness = [ { type: CardType.FIRE } ];
      TestUtils.setDefending(sim, [ weak ]);
      const { player, opponent } = TestUtils.getAll(sim);
      player.active.damage = 20;
      sim.dispatch(new AttackAction(1, 'Flames of Rage'));
      const prompt = lastEnergyPrompt();
      sim.dispatch(new ResolvePromptAction(prompt.id, prompt.energy.slice(0, 2)));
      expect(opponent.active.damage).toEqual(120);
    });
  });
});

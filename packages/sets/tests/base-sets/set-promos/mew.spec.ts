import {
  AttackAction,
  CardType,
  ChoosePokemonPrompt,
  PlayerType,
  ResolvePromptAction,
  Simulator,
  SlotType,
  SpecialCondition
} from "@ptcg/common";

import { Mew } from "../../../src/base-sets/set-promos/mew";
import { Jigglypuff } from "../../../src/base-sets/set-jungle/jigglypuff";
import { Wigglytuff } from "../../../src/base-sets/set-jungle/wigglytuff";
import { Squirtle } from "../../../src/base-sets/set-base/squirtle";
import { Wartortle } from "../../../src/base-sets/set-base/wartortle";
import { Blastoise } from "../../../src/base-sets/set-base/blastoise";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

describe('Mew PR', () => {
  let sim: Simulator;
  const OPP_ACTIVE = { player: PlayerType.TOP_PLAYER, slot: SlotType.ACTIVE, index: 0 };

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new Mew() ], [ CardType.PSYCHIC, CardType.PSYCHIC ]);
  });

  it('Should do no damage with Psywave when the defender has no Energy', () => {
    const { opponent } = TestUtils.getAll(sim);
    sim.dispatch(new AttackAction(1, 'Psywave'));
    expect(opponent.active.damage).toEqual(0);
  });

  it('Should do 10 damage per Energy CARD with Psywave', () => {
    const { opponent } = TestUtils.getAll(sim);
    TestUtils.setDefending(sim, [ new TestPokemon() ], [ CardType.WATER, CardType.WATER, CardType.WATER ]);
    sim.dispatch(new AttackAction(1, 'Psywave'));
    expect(opponent.active.damage).toEqual(30);
  });

  it('Should do nothing with Devolution Beam when nothing is evolved', () => {
    const { prompts } = TestUtils.getAll(sim);
    sim.dispatch(new AttackAction(1, 'Devolution Beam'));
    expect(prompts.filter(p => p instanceof ChoosePokemonPrompt).length).toEqual(0);
  });

  it('Should return the top Evolution card to its own player hand', () => {
    const { opponent, prompts } = TestUtils.getAll(sim);
    const jigglypuff = new Jigglypuff();
    const wigglytuff = new Wigglytuff();
    TestUtils.setDefending(sim, [ jigglypuff, wigglytuff ]);

    sim.dispatch(new AttackAction(1, 'Devolution Beam'));
    const prompt = prompts[prompts.length - 1] as ChoosePokemonPrompt;
    expect(prompt instanceof ChoosePokemonPrompt).toBe(true);
    sim.dispatch(new ResolvePromptAction(prompt.id, [ opponent.active ]));

    expect(opponent.active.pokemons.cards).toEqual([ jigglypuff ]);
    expect(opponent.hand.cards).toContain(wigglytuff);
  });

  it('Should peel only the highest Stage off a Stage 2', () => {
    const { opponent, prompts } = TestUtils.getAll(sim);
    const squirtle = new Squirtle();
    const wartortle = new Wartortle();
    const blastoise = new Blastoise();
    TestUtils.setDefending(sim, [ squirtle, wartortle, blastoise ]);

    sim.dispatch(new AttackAction(1, 'Devolution Beam'));
    const prompt = prompts[prompts.length - 1] as ChoosePokemonPrompt;
    sim.dispatch(new ResolvePromptAction(prompt.id, [ opponent.active ]));

    expect(opponent.active.pokemons.cards).toEqual([ squirtle, wartortle ]);
    expect(opponent.hand.cards).toContain(blastoise);
  });

  it('Should clear Special Conditions but keep damage', () => {
    const { opponent, prompts } = TestUtils.getAll(sim);
    TestUtils.setDefending(sim, [ new Jigglypuff(), new Wigglytuff() ]);
    opponent.active.specialConditions = [ SpecialCondition.ASLEEP, SpecialCondition.POISONED ];
    opponent.active.damage = 30;

    sim.dispatch(new AttackAction(1, 'Devolution Beam'));
    const prompt = prompts[prompts.length - 1] as ChoosePokemonPrompt;
    sim.dispatch(new ResolvePromptAction(prompt.id, [ opponent.active ]));

    expect(opponent.active.specialConditions).toEqual([]);
    expect(opponent.active.damage).toEqual(30);
  });

  it('Should block Pokemon with nothing to devolve', () => {
    const { prompts } = TestUtils.getAll(sim);
    TestUtils.setDefending(sim, [ new Jigglypuff(), new Wigglytuff() ]);

    sim.dispatch(new AttackAction(1, 'Devolution Beam'));
    const prompt = prompts[prompts.length - 1] as ChoosePokemonPrompt;
    // Mew itself is a Basic, so the attacker slot must be in the blocked list
    const blocked = prompt.options.blocked;
    expect(blocked.some(b => b.player === PlayerType.BOTTOM_PLAYER && b.slot === SlotType.ACTIVE)).toBe(true);
    expect(blocked.some(b => b.player === PlayerType.TOP_PLAYER && b.slot === SlotType.ACTIVE)).toBe(false);
    void OPP_ACTIVE;
  });
});

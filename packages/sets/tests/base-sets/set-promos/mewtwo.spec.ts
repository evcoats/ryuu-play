import {
  AttackAction,
  CardType,
  AttachEnergyPrompt,
  ResolvePromptAction,
  Simulator,
  SlotType,
  PlayerType
} from "@ptcg/common";

import { Mewtwo } from "../../../src/base-sets/set-promos/mewtwo";
import { RainbowEnergy } from "../../../src/base-sets/set-team-rocket/rainbow-energy";
import { FullHealEnergy } from "../../../src/base-sets/set-team-rocket/full-heal-energy";
import { ProfessorOak } from "../../../src/base-sets/set-base/professor-oak";
import { TestEnergy } from "../../test-cards/test-energy";
import { TestUtils } from "../../test-utils";

describe('Mewtwo PR', () => {
  let sim: Simulator;
  const ACTIVE = { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.ACTIVE, index: 0 };

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();

    TestUtils.setActive(sim, [ new Mewtwo() ], [ CardType.PSYCHIC, CardType.PSYCHIC, CardType.PSYCHIC ]);
  });

  it('Should do 40 damage with Psyburn', () => {
    const { opponent } = TestUtils.getAll(sim);
    sim.dispatch(new AttackAction(1, 'Psyburn'));
    expect(opponent.active.damage).toEqual(40);
  });

  it('Should not prompt for Energy Absorption with an empty discard pile', () => {
    const { prompts } = TestUtils.getAll(sim);
    sim.dispatch(new AttackAction(1, 'Energy Absorption'));
    expect(prompts.filter(p => p instanceof AttachEnergyPrompt).length).toEqual(0);
  });

  it('Should attach up to 2 Energy from the discard pile with Energy Absorption', () => {
    const { player, discard, prompts } = TestUtils.getAll(sim);
    const first = new TestEnergy(CardType.PSYCHIC);
    const second = new TestEnergy(CardType.PSYCHIC);
    const third = new TestEnergy(CardType.PSYCHIC);
    discard.cards.push(first, second, third);

    sim.dispatch(new AttackAction(1, 'Energy Absorption'));
    const prompt = prompts[prompts.length - 1] as AttachEnergyPrompt;
    expect(prompt instanceof AttachEnergyPrompt).toBe(true);
    expect(prompt.options.max).toEqual(2);

    sim.dispatch(new ResolvePromptAction(prompt.id, [
      { to: ACTIVE, card: first },
      { to: ACTIVE, card: second }
    ]));

    expect(player.active.energies.cards).toContain(first);
    expect(player.active.energies.cards).toContain(second);
    expect(discard.cards).toEqual([ third ]);
  });

  it('Should refuse a third Energy card', () => {
    const { discard, prompts } = TestUtils.getAll(sim);
    const cards = [ new TestEnergy(CardType.PSYCHIC), new TestEnergy(CardType.PSYCHIC), new TestEnergy(CardType.PSYCHIC) ];
    discard.cards.push(...cards);

    sim.dispatch(new AttackAction(1, 'Energy Absorption'));
    const prompt = prompts[prompts.length - 1] as AttachEnergyPrompt;
    expect(prompt.validate(cards.map(card => ({ to: ACTIVE, card })))).toBe(false);
  });

  it('Should not take a Trainer out of the discard pile', () => {
    const { discard, prompts } = TestUtils.getAll(sim);
    const oak = new ProfessorOak();
    discard.cards.push(oak, new TestEnergy(CardType.PSYCHIC));

    sim.dispatch(new AttackAction(1, 'Energy Absorption'));
    const prompt = prompts[prompts.length - 1] as AttachEnergyPrompt;
    expect(prompt.validate([ { to: ACTIVE, card: oak } ])).toBe(false);
  });

  it('Should keep the Energy on Mewtwo even when the Bench is asked for', () => {
    const { player, discard, prompts } = TestUtils.getAll(sim);
    const energy = new TestEnergy(CardType.PSYCHIC);
    discard.cards.push(energy);

    sim.dispatch(new AttackAction(1, 'Energy Absorption'));
    const prompt = prompts[prompts.length - 1] as AttachEnergyPrompt;
    const bench = { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.BENCH, index: 0 };
    sim.dispatch(new ResolvePromptAction(prompt.id, [ { to: bench, card: energy } ]));

    expect(player.active.energies.cards).toContain(energy);
    expect(player.bench[0].energies.cards).toEqual([]);
  });

  it('Should not trigger Rainbow Energy damage, which only applies from hand', () => {
    const { player, discard, prompts } = TestUtils.getAll(sim);
    const rainbow = new RainbowEnergy();
    discard.cards.push(rainbow);

    sim.dispatch(new AttackAction(1, 'Energy Absorption'));
    const prompt = prompts[prompts.length - 1] as AttachEnergyPrompt;
    sim.dispatch(new ResolvePromptAction(prompt.id, [ { to: ACTIVE, card: rainbow } ]));

    expect(player.active.energies.cards).toContain(rainbow);
    expect(player.active.damage).toEqual(0);
  });

  it('Should not trigger Full Heal Energy, which only applies from hand', () => {
    const { player, discard, prompts } = TestUtils.getAll(sim);
    const fullHeal = new FullHealEnergy();
    discard.cards.push(fullHeal);
    player.active.specialConditions = [ 'CONFUSED' as any ];

    sim.dispatch(new AttackAction(1, 'Energy Absorption'));
    const prompt = prompts[prompts.length - 1] as AttachEnergyPrompt;
    sim.dispatch(new ResolvePromptAction(prompt.id, [ { to: ACTIVE, card: fullHeal } ]));

    expect(player.active.energies.cards).toContain(fullHeal);
    expect(player.active.specialConditions.length).toEqual(1);
  });
});

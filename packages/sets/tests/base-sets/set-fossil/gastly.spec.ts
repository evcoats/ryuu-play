import {
  AttackAction,
  CardType,
  ChooseCardsPrompt,
  ResolvePromptAction,
  Simulator,
} from "@ptcg/common";

import { Gastly } from "../../../src/base-sets/set-fossil/gastly";
import { TestEnergy } from "../../test-cards/test-energy";
import { TestUtils } from "../../test-utils";

// Energy Conversion: Gastly does 10 damage to itself whether or not the discard holds Energy (engine audit, metagame-rl log #493).
describe('Gastly FO', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new Gastly() ], [ CardType.PSYCHIC, CardType.PSYCHIC ]);
  });

  it('Should do 10 damage to itself with an empty discard pile, with no prompt', () => {
    const { player, opponent, prompts } = TestUtils.getAll(sim);
    sim.dispatch(new AttackAction(1, 'Energy Conversion'));
    expect(prompts.filter(p => p instanceof ChooseCardsPrompt).length).toEqual(0);
    expect(player.active.damage).toEqual(10);
    expect(opponent.active.damage).toEqual(0);
  });

  it('Should put up to 2 Energy cards into the hand and do 10 damage to itself', () => {
    const { player, discard, prompts } = TestUtils.getAll(sim);
    const first = new TestEnergy(CardType.PSYCHIC);
    const second = new TestEnergy(CardType.PSYCHIC);
    const third = new TestEnergy(CardType.PSYCHIC);
    discard.cards.push(first, second, third);

    sim.dispatch(new AttackAction(1, 'Energy Conversion'));
    const prompt = prompts[prompts.length - 1] as ChooseCardsPrompt;
    expect(prompt instanceof ChooseCardsPrompt).toBe(true);
    expect(prompt.options.max).toEqual(2);

    sim.dispatch(new ResolvePromptAction(prompt.id, [ first, second ]));
    expect(player.hand.cards).toContain(first);
    expect(player.hand.cards).toContain(second);
    expect(discard.cards).toContain(third);
    expect(player.active.damage).toEqual(10);
  });
});

import { CardType, GameError, GameMessage, Simulator, UsePowerEffect } from "@ptcg/common";

import { DarkDragonair } from "../../../src/base-sets/set-team-rocket/dark-dragonair";
import { TestUtils } from "../../test-utils";

describe('Dark Dragonair TR', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new DarkDragonair() ], [ CardType.COLORLESS ]);
  });

  it('Should use Evolutionary Light only once during a turn', () => {
    // The once-per-turn marker was checked but never set: the Power could be used, finding nothing and
    // shuffling the deck, any number of times in a turn
    const { player, prompts } = TestUtils.getAll(sim);
    const dragonair = player.active.getPokemonCard() as DarkDragonair;
    player.deck.cards = TestUtils.makeTestCards(5);
    const before = prompts.length;
    sim.store.reduceEffect(sim.store.state, new UsePowerEffect(player, dragonair.powers[0], dragonair));
    expect(prompts.length).toEqual(before + 1);
    let error: any;
    try {
      sim.store.reduceEffect(sim.store.state, new UsePowerEffect(player, dragonair.powers[0], dragonair));
    } catch (e) {
      error = e;
    }
    expect(error instanceof GameError).toBe(true);
    expect(TestUtils.getErrorMessage(error)).toEqual(GameMessage.POWER_ALREADY_USED);
  });
});

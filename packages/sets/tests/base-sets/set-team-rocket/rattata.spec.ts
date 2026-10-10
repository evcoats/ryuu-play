import { CardType, GameError, GameMessage, Simulator, UsePowerEffect } from "@ptcg/common";

import { Rattata } from "../../../src/base-sets/set-team-rocket/rattata";
import { TestUtils } from "../../test-utils";

describe('Rattata TR', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new Rattata() ], [ CardType.COLORLESS ]);
  });

  it('Should not use Trickery with an empty deck (nothing to switch the Prize with)', () => {
    const { player } = TestUtils.getAll(sim);
    const rattata = player.active.getPokemonCard() as Rattata;
    player.deck.cards = [];
    let error: any;
    try {
      sim.store.reduceEffect(sim.store.state, new UsePowerEffect(player, rattata.powers[0], rattata));
    } catch (e) {
      error = e;
    }
    expect(error instanceof GameError).toBe(true);
    expect(TestUtils.getErrorMessage(error)).toEqual(GameMessage.CANNOT_USE_POWER);
    expect(player.prizes.every(p => p.cards.every(c => c !== undefined))).toBe(true);
  });

  it('Should offer the Prize choice when the deck has a card', () => {
    const { player, prompts } = TestUtils.getAll(sim);
    const rattata = player.active.getPokemonCard() as Rattata;
    player.deck.cards = TestUtils.makeTestCards(1);
    const before = prompts.length;
    sim.store.reduceEffect(sim.store.state, new UsePowerEffect(player, rattata.powers[0], rattata));
    expect(prompts.length).toEqual(before + 1);
  });
});

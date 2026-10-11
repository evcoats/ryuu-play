import { CardType, CheckPokemonTypeEffect, GameError, GameMessage, ResolvePromptAction, Simulator, UsePowerEffect } from "@ptcg/common";

import { Venomoth } from "../../../src/base-sets/set-jungle/venomoth";
import { Venonat } from "../../../src/base-sets/set-jungle/venonat";
import { Hitmonchan } from "../../../src/base-sets/set-base/hitmonchan";
import { Charmander } from "../../../src/base-sets/set-base/charmander";
import { TestUtils } from "../../test-utils";

describe('Venomoth JU', () => {
  let sim: Simulator;
  let venomoth: Venomoth;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new Hitmonchan() ], [ CardType.FIGHTING ]);
    TestUtils.setDefending(sim, [ new Charmander() ]);
    const { player } = TestUtils.getAll(sim);
    venomoth = new Venomoth();
    player.bench[0].pokemons.cards = [ new Venonat(), venomoth ];
  });

  const typeOf = (slot: any) => {
    const effect = new CheckPokemonTypeEffect(slot);
    sim.store.reduceEffect(sim.store.state, effect);
    return effect.cardTypes;
  };

  it('Should change the type of Venomoth itself, once during a turn', () => {
    // Shift changed the Active Pokemon's type, and its once-per-turn marker was never set
    const { player } = TestUtils.getAll(sim);
    sim.store.reduceEffect(sim.store.state, new UsePowerEffect(player, venomoth.powers[0], venomoth));
    const prompt = TestUtils.lastPrompt(sim) as any;
    sim.dispatch(new ResolvePromptAction(prompt.id, 0));
    expect(typeOf(player.bench[0])).not.toEqual([ CardType.GRASS ]);
    expect(typeOf(player.active)).toEqual([ CardType.FIGHTING ]);
    let error: any;
    try {
      sim.store.reduceEffect(sim.store.state, new UsePowerEffect(player, venomoth.powers[0], venomoth));
    } catch (e) {
      error = e;
    }
    expect(error instanceof GameError).toBe(true);
    expect(TestUtils.getErrorMessage(error)).toEqual(GameMessage.POWER_ALREADY_USED);
  });
});

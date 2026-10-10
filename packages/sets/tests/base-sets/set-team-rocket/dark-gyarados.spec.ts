import { CardType, GamePhase, KnockOutEffect, Simulator, SpecialCondition } from "@ptcg/common";

import { DarkGyarados } from "../../../src/base-sets/set-team-rocket/dark-gyarados";
import { TestUtils } from "../../test-utils";

describe('Dark Gyarados TR', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new DarkGyarados() ], [ CardType.WATER ]);
  });

  it('Should let Final Beam simply not happen when knocked out while Asleep, Confused or Paralyzed', () => {
    // It used to throw, which aborted the opponent's attack that knocked it out
    const { player, opponent } = TestUtils.getAll(sim);
    TestUtils.setActivePlayer(sim, opponent);
    sim.store.state.phase = GamePhase.ATTACK;
    for (const condition of [ SpecialCondition.ASLEEP, SpecialCondition.CONFUSED, SpecialCondition.PARALYZED ]) {
      player.active.specialConditions = [ condition ];
      expect(() => sim.store.reduceEffect(sim.store.state, new KnockOutEffect(player, player.active))).not.toThrow();
    }
  });
});

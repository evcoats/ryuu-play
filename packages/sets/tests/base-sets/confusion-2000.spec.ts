import {
  AttackAction,
  BotFlipMode,
  BotShuffleMode,
  CardType,
  CoinFlipPrompt,
  RetreatAction,
  Rules,
  Simulator,
  SpecialCondition,
} from "@ptcg/common";

import { Defender } from "../../src/base-sets/set-base/defender";
import { Pluspower } from "../../src/base-sets/set-base/pluspower";
import { MrMime } from "../../src/base-sets/set-jungle/mr-mime";
import { DarkDugtrio } from "../../src/base-sets/set-team-rocket/dark-dugtrio";
import { DarkPrimeape } from "../../src/base-sets/set-team-rocket/dark-primeape";
import { TestPokemon } from "../test-cards/test-pokemon";
import { TestUtils } from "../test-utils";

// Confusion under Rules.baseEraConfusion (the 2000 rules), with the cards whose rulings involve it.
function confusedSim(baseEraConfusion: boolean, flipResults: boolean[]): Simulator {
  const sim = TestUtils.createTestSimulator({ flipMode: BotFlipMode.ALL_HEADS, shuffleMode: BotShuffleMode.REVERSE });
  TestUtils.setFlipResults(sim, flipResults);
  // Object.assign, so the spec also type-checks against a common build from before the flag
  sim.store.state.rules = Object.assign(new Rules(), { baseEraConfusion });
  return sim;
}

function confuse(sim: Simulator) {
  sim.store.state.players[0].active.specialConditions = [ SpecialCondition.CONFUSED ];
}

const flips = (sim: Simulator) => sim.store.state.prompts.filter(p => p instanceof CoinFlipPrompt).length;

describe('Confusion, 2000 rules', () => {
  it('Should let Defender reduce the damage it does to itself (April 6, 2000)', () => {
    const sim = confusedSim(true, [ false ]);
    TestUtils.setActive(sim, [ new TestPokemon() ], [], [ new Defender() ]);
    confuse(sim);
    const { player } = TestUtils.getAll(sim);
    sim.dispatch(new AttackAction(1, 'Test attack'));
    expect(player.active.damage).toBe(0);
  });

  it('Should not add PlusPower to the damage it does to itself', () => {
    const sim = confusedSim(true, [ false ]);
    TestUtils.setActive(sim, [ new TestPokemon() ], [], [ new Pluspower() ]);
    confuse(sim);
    const { player } = TestUtils.getAll(sim);
    sim.dispatch(new AttackAction(1, 'Test attack'));
    expect(player.active.damage).toBe(20);
  });

  it('Should knock out a Confused Mr. Mime by Weakness (Mar 30, 2000)', () => {
    const sim = confusedSim(true, [ false ]);
    const mime = new MrMime();
    TestUtils.setActive(sim, [ mime ], [ CardType.PSYCHIC, CardType.COLORLESS ]);
    confuse(sim);
    const { player } = TestUtils.getAll(sim);
    sim.dispatch(new AttackAction(1, 'Meditate'));
    expect(player.discard.cards).toContain(mime);
  });

  it('Should make Dark Primeape do 50 to itself with Frenzy (April 27, 2000)', () => {
    const sim = confusedSim(true, [ false ]);
    TestUtils.setActive(sim, [ new DarkPrimeape() ], [ CardType.FIGHTING, CardType.FIGHTING ]);
    confuse(sim);
    const { player, opponent } = TestUtils.getAll(sim);
    const primeape = player.active;
    sim.dispatch(new AttackAction(1, 'Frenzied Attack'));
    expect(primeape.damage).toBe(50);
    expect(opponent.active.damage).toBe(0);
  });

  it('Should keep the later rules by default (30, Defender and Frenzy not applied)', () => {
    const sim = confusedSim(false, [ false ]);
    TestUtils.setActive(sim, [ new DarkPrimeape() ], [ CardType.FIGHTING, CardType.FIGHTING ], [ new Defender() ]);
    confuse(sim);
    const { player } = TestUtils.getAll(sim);
    const primeape = player.active;
    sim.dispatch(new AttackAction(1, 'Frenzied Attack'));
    expect(primeape.damage).toBe(30);
  });

  describe('Dark Dugtrio TR Sinkhole', () => {
    function sinkholeSim(baseEraConfusion: boolean, flipResults: boolean[]): Simulator {
      const sim = confusedSim(baseEraConfusion, flipResults);
      TestUtils.setDefending(sim, [ new DarkDugtrio() ]);
      sim.store.state.players[0].bench[0].pokemons.cards = [ new TestPokemon() ];
      sim.store.state.turn = 1; // retreatedTurn starts at 0
      return sim;
    }

    it('Should damage the Pokemon that retreated, not the new Active, on a free retreat', () => {
      const sim = sinkholeSim(false, [ false ]);
      const { player } = TestUtils.getAll(sim);
      const retreating = player.active;
      sim.dispatch(new RetreatAction(1, 0));
      expect(player.bench[0]).toBe(retreating);
      expect(retreating.damage).toBe(20);
      expect(player.active.damage).toBe(0);
    });

    it('Should do nothing on heads', () => {
      const sim = sinkholeSim(false, [ true ]);
      const { player } = TestUtils.getAll(sim);
      sim.dispatch(new RetreatAction(1, 0));
      expect(player.bench[0].damage).toBe(0);
      expect(player.active.damage).toBe(0);
    });

    it('Should not flip when a Confused Pokemon fails to retreat (April 27, 2000)', () => {
      const sim = sinkholeSim(true, [ false, false ]);
      confuse(sim);
      const { player } = TestUtils.getAll(sim);
      const confused = player.active;
      sim.dispatch(new RetreatAction(1, 0));
      expect(player.active).toBe(confused);
      expect(confused.damage).toBe(0);
      expect(flips(sim)).toBe(1);
    });

    it('Should flip after a Confused Pokemon retreats', () => {
      const sim = sinkholeSim(true, [ true, false ]);
      confuse(sim);
      const { player } = TestUtils.getAll(sim);
      const confused = player.active;
      sim.dispatch(new RetreatAction(1, 0));
      expect(player.bench[0]).toBe(confused);
      expect(confused.damage).toBe(20);
      expect(flips(sim)).toBe(2);
    });
  });
});

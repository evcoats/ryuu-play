import {
  AttachEnergyPrompt,
  CardType,
  PlayerType,
  ResolvePromptAction,
  Simulator,
  SlotType,
  UsePowerEffect,
} from "@ptcg/common";

import { Blastoise } from "../../../src/base-sets/set-base/blastoise";
import { Squirtle } from "../../../src/base-sets/set-base/squirtle";
import { WaterEnergy } from "../../../src/base-sets/set-base/water-energy";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

// Rain Dance attaches Water Energy to your Water Pokémon only (engine audit, metagame-rl log #493).
describe('Blastoise BS', () => {
  let sim: Simulator;
  const ACTIVE = { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.ACTIVE, index: 0 };
  const BENCH_0 = { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.BENCH, index: 0 };
  const BENCH_1 = { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.BENCH, index: 1 };

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new Blastoise() ]);
    const { player } = TestUtils.getAll(sim);
    player.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);   // no type: not a Water Pokémon
    player.bench[1] = TestUtils.pokemonSlot([ new Squirtle() ]);
  });

  const rainDance = () => {
    const { player, prompts } = TestUtils.getAll(sim);
    const blastoise = player.active.getPokemonCard() as Blastoise;
    sim.store.reduceEffect(sim.store.state, new UsePowerEffect(player, blastoise.powers[0], blastoise));
    const prompt = prompts[prompts.length - 1];
    return prompt instanceof AttachEnergyPrompt ? prompt : undefined;
  };

  it('Should block every non-Water Pokémon as a Rain Dance target', () => {
    const { player } = TestUtils.getAll(sim);
    player.hand.cards = [ new WaterEnergy() ];
    const prompt = rainDance()!;
    expect(prompt).toBeDefined();
    expect(prompt.options.blockedTo).toContain(jasmine.objectContaining(BENCH_0));
    expect(prompt.options.blockedTo).not.toContain(jasmine.objectContaining(ACTIVE));
    expect(prompt.options.blockedTo).not.toContain(jasmine.objectContaining(BENCH_1));
  });

  it('Should attach Water Energy to a Water Pokémon', () => {
    const { player } = TestUtils.getAll(sim);
    const water = new WaterEnergy();
    player.hand.cards = [ water ];
    const prompt = rainDance()!;
    sim.dispatch(new ResolvePromptAction(prompt.id, [ { to: BENCH_1, card: water } ]));
    expect(player.bench[1].energies.cards).toContain(water);
    expect(player.hand.cards).not.toContain(water);
  });

  it('Should not attach to a non-Water Pokémon even if the answer names it', () => {
    const { player } = TestUtils.getAll(sim);
    const water = new WaterEnergy();
    player.hand.cards = [ water ];
    const prompt = rainDance()!;
    sim.dispatch(new ResolvePromptAction(prompt.id, [ { to: BENCH_0, card: water } ]));
    expect(player.bench[0].energies.cards).not.toContain(water);
    expect(player.hand.cards).toContain(water);
  });

  it('Should still treat Blastoise itself as a Water target', () => {
    const { player } = TestUtils.getAll(sim);
    expect(player.active.getPokemonCard()!.cardTypes).toEqual([ CardType.WATER ]);
    const water = new WaterEnergy();
    player.hand.cards = [ water ];
    const prompt = rainDance()!;
    sim.dispatch(new ResolvePromptAction(prompt.id, [ { to: ACTIVE, card: water } ]));
    expect(player.active.energies.cards).toContain(water);
  });
});

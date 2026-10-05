import {
  AttackAction,
  CardType,
  GameMessage,
  PokemonCard,
  ResolvePromptAction,
  Simulator
} from "@ptcg/common";
import { Clefable } from "../../../src/base-sets/set-jungle/clefable";
import { Clefairy } from "../../../src/base-sets/set-base/clefairy";

import { TestUtils } from "../../test-utils";

describe('Clefable JU', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new Clefable() ], [ CardType.COLORLESS, CardType.COLORLESS, CardType.COLORLESS ]);
  });

  it('Metronome cannot copy Metronome (no endless copy loop)', () => {
    const { opponent, player, prompts } = TestUtils.getAll(sim);
    opponent.active.pokemons.cards = [ new Clefable() ];
    const defending = opponent.active.getPokemonCard() as PokemonCard;

    sim.dispatch(new AttackAction(1, 'Metronome'));

    expect(prompts.length).toEqual(1);
    expect(prompts[0]).toEqual(jasmine.objectContaining({
      type: 'Choose attack',
      playerId: player.id,
      message: GameMessage.CHOOSE_ATTACK_TO_COPY,
      options: jasmine.objectContaining({ blocked: [ { index: 0, name: 'Metronome' } ] })
    }));
    expect(prompts[0].validate(defending.attacks[0], sim.store.state)).toBeFalse();   // Metronome
    expect(prompts[0].validate(defending.attacks[1], sim.store.state)).toBeTrue();    // Minimize

    sim.dispatch(new ResolvePromptAction(prompts[0].id, defending.attacks[1]));
    expect(TestUtils.isPlayerTurn(sim, opponent)).toBeTrue();
  });

  it('Metronome copies a Clefairy\'s other attack but not its Metronome', () => {
    const { opponent, prompts } = TestUtils.getAll(sim);
    opponent.active.pokemons.cards = [ new Clefairy() ];
    const defending = opponent.active.getPokemonCard() as PokemonCard;
    const metronome = defending.attacks.find(a => a.name === 'Metronome')!;
    const other = defending.attacks.find(a => a.name !== 'Metronome')!;

    sim.dispatch(new AttackAction(1, 'Metronome'));

    expect(prompts.length).toEqual(1);
    expect(prompts[0].validate(metronome, sim.store.state)).toBeFalse();
    expect(prompts[0].validate(other, sim.store.state)).toBeTrue();
  });

  it('Metronome against a Pokemon whose only attack is Metronome does nothing', () => {
    const { opponent, prompts } = TestUtils.getAll(sim);
    opponent.active.pokemons.cards = [ new Clefable() ];
    const defending = opponent.active.getPokemonCard() as PokemonCard;
    defending.attacks = defending.attacks.filter(a => a.name === 'Metronome')!;

    sim.dispatch(new AttackAction(1, 'Metronome'));

    expect(prompts.length).toEqual(0);
    expect(TestUtils.isPlayerTurn(sim, opponent)).toBeTrue();
    expect(opponent.active.damage).toEqual(0);
  });
});

import {
  CardType,
  CheckTableStateEffect,
  GameError,
  GameMessage,
  PlayCardAction,
  PlayerType,
  Simulator,
  SlotType,
  SpecialCondition,
  UseAbilityAction
} from "@ptcg/common";

import { Omanyte } from "../../../src/base-sets/set-fossil/omanyte";
import { Omastar } from "../../../src/base-sets/set-fossil/omastar";
import { Ditto } from "../../../src/base-sets/set-fossil/ditto";
import { Grimer } from "../../../src/base-sets/set-fossil/grimer";
import { Muk } from "../../../src/base-sets/set-fossil/muk";
import { setFossil } from "../../../src/base-sets/set-fossil";
import { TestUtils } from "../../test-utils";

// Clairvoyance: "Your opponent plays with his or her hand face up." Like all Pokemon Powers it
// works only while Omanyte is in play, and cards drawn meanwhile are face up too (Fossil FAQ, in
// the WotC Rulings Compendium under CLAIRVOYANCE). A Ditto copying Omanyte has it too (Fossil FAQ,
// under TRANSFORM: Ditto copies Pokemon Powers).
describe('Omanyte FO', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new Omanyte() ], [ CardType.WATER ]);
    const { player, opponent } = TestUtils.getAll(sim);
    player.hand.cards = TestUtils.makeTestCards(3);
    opponent.hand.cards = TestUtils.makeTestCards(3);
  });

  const check = () => sim.store.reduceEffect(sim.store.state, new CheckTableStateEffect());

  it('Should be registered in the Fossil set', () => {
    expect(setFossil.some(card => card.fullName === 'Omanyte FO')).toBe(true);
  });

  it('Should not be a Power the player uses', () => {
    const { player } = TestUtils.getAll(sim);
    expect(player.active.getPokemonCard()!.powers[0].useWhenInPlay).toBeFalsy();
    let error: any;
    try {
      sim.dispatch(new UseAbilityAction(1, 'Clairvoyance', { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.ACTIVE, index: 0 }));
    } catch (e) {
      error = e;
    }
    expect(error instanceof GameError).toBe(true);
    expect(TestUtils.getErrorMessage(error)).toEqual(GameMessage.CANNOT_USE_POWER);
  });

  it('Should turn the opponent hand face up after any action, and not the owner hand', () => {
    const { player, opponent } = TestUtils.getAll(sim);
    expect(opponent.hand.isPublic).toBe(false);
    player.hand.cards = TestUtils.makeEnergies([ CardType.WATER ]);
    sim.store.state.turn = 1;
    sim.dispatch(new PlayCardAction(1, 0, { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.ACTIVE, index: 0 }));
    expect(player.active.energies.cards.length).toEqual(2);
    expect(opponent.hand.isPublic).toBe(true);
    expect(player.hand.isPublic).toBe(false);
  });

  it('Should work from the Bench', () => {
    const { player, opponent } = TestUtils.getAll(sim);
    player.bench[2].pokemons.cards = [ player.active.pokemons.cards.pop()! ];
    check();
    expect(opponent.hand.isPublic).toBe(true);
  });

  it('Should stop working while Asleep, Confused or Paralyzed, and work again after', () => {
    const { player, opponent } = TestUtils.getAll(sim);
    for (const condition of [ SpecialCondition.ASLEEP, SpecialCondition.CONFUSED, SpecialCondition.PARALYZED ]) {
      player.active.specialConditions = [ condition ];
      check();
      expect(opponent.hand.isPublic).toBe(false);
      player.active.specialConditions = [];
      check();
      expect(opponent.hand.isPublic).toBe(true);
    }
    player.active.specialConditions = [ SpecialCondition.POISONED ];
    check();
    expect(opponent.hand.isPublic).toBe(true);
  });

  it('Should stop working while Muk Toxic Gas is in play', () => {
    const { opponent } = TestUtils.getAll(sim);
    opponent.bench[0].pokemons.cards = [ new Grimer(), new Muk() ];
    check();
    expect(opponent.hand.isPublic).toBe(false);
  });

  it('Should turn the hand back down once Omanyte leaves play', () => {
    const { player, opponent } = TestUtils.getAll(sim);
    check();
    expect(opponent.hand.isPublic).toBe(true);
    player.discard.cards = player.active.pokemons.cards.splice(0);
    check();
    expect(opponent.hand.isPublic).toBe(false);
  });

  it('Should stop working once Omanyte evolves into Omastar', () => {
    const { player, opponent } = TestUtils.getAll(sim);
    player.active.pokemons.cards.push(new Omastar());
    check();
    expect(opponent.hand.isPublic).toBe(false);
  });

  it('Should turn the hand back down as soon as Omanyte is Knocked Out, before the Prizes are taken', () => {
    const { player, opponent } = TestUtils.getAll(sim);
    check();
    expect(opponent.hand.isPublic).toBe(true);
    player.bench[0].pokemons.cards = [ new Grimer() ];
    player.active.damage = 40;
    player.hand.cards = TestUtils.makeEnergies([ CardType.WATER ]);
    sim.store.state.turn = 1;
    sim.dispatch(new PlayCardAction(1, 0, { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.ACTIVE, index: 0 }));
    expect(sim.store.state.prompts.some(p => p.result === undefined && p.playerId === opponent.id)).toBe(true);
    expect(opponent.hand.isPublic).toBe(false);
  });

  it('Should work for a Ditto FO copying Omanyte, while Ditto is a copy', () => {
    const { player, opponent } = TestUtils.getAll(sim);
    TestUtils.setActive(sim, [ new Ditto() ], [ CardType.WATER ]);
    TestUtils.setDefending(sim, [ new Omanyte() ]);
    check();
    expect(opponent.hand.isPublic).toBe(true);
    expect(player.hand.isPublic).toBe(true);
    player.active.specialConditions = [ SpecialCondition.ASLEEP ];
    check();
    expect(opponent.hand.isPublic).toBe(false);
    player.active.specialConditions = [];
    player.bench[0].pokemons.cards = [ player.active.pokemons.cards.pop()! ];
    player.active.pokemons.cards = [ new Grimer() ];
    check();
    expect(opponent.hand.isPublic).toBe(false);
  });

  it('Should turn both hands face up when both players have Omanyte in play', () => {
    const { player, opponent } = TestUtils.getAll(sim);
    TestUtils.setDefending(sim, [ new Omanyte() ]);
    check();
    expect(opponent.hand.isPublic).toBe(true);
    expect(player.hand.isPublic).toBe(true);
  });
});

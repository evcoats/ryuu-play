import {
  AttackAction,
  ChooseCardsPrompt,
  GameMessage,
  PlayCardAction,
  ResolvePromptAction,
  Simulator,
  SuperType,
  TrainerType,
} from "@ptcg/common";

import { ComputerErrorPR16 } from "../../../src/base-sets/set-promos/computer-error";
import { setPromos } from "../../../src/base-sets/set-promos";
import { TestUtils } from "../../test-utils";

describe('Computer Error PR16', () => {
  let sim: Simulator;
  let card: ComputerErrorPR16;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    card = new ComputerErrorPR16();
    TestUtils.getAll(sim).player.hand.cards = [ card ];
  });

  const play = () => {
    const { player } = TestUtils.getAll(sim);
    sim.dispatch(new PlayCardAction(1, player.hand.cards.indexOf(card), TestUtils.target(sim)));
  };

  const pending = (playerId: number) =>
    TestUtils.getAll(sim).prompts.filter(p => p instanceof ChooseCardsPrompt && p.playerId === playerId
      && p.result === undefined) as ChooseCardsPrompt[];

  const draw = (playerId: number, count: number) => {
    const prompt = pending(playerId)[0];
    sim.dispatch(new ResolvePromptAction(prompt.id, prompt.cards.cards.slice(0, count)));
  };

  it('Should be a registered Trainer (Rocket\'s Secret Machine, played as an Item)', () => {
    expect(setPromos.some(c => c.fullName === 'Computer Error PR16')).toBe(true);
    expect(card.superType).toEqual(SuperType.TRAINER);
    expect(card.trainerType).toEqual(TrainerType.ITEM);
  });

  it('Should let you draw up to 5, then the opponent up to 5, then end the turn', () => {
    const { state, player, opponent } = TestUtils.getAll(sim);
    const playerTop = player.deck.cards.slice(0, 3);
    const opponentTop = opponent.deck.cards.slice(0, 5);

    play();
    expect(pending(opponent.id).length).toEqual(0);
    const mine = pending(player.id)[0];
    expect(mine.options.min).toEqual(0);
    expect(mine.options.max).toEqual(5);
    expect(mine.options.isSecret).toBe(true);
    expect(mine.options.allowCancel).toBe(false);

    draw(player.id, 3);
    expect(player.hand.cards).toEqual(playerTop);
    expect(state.activePlayer).toEqual(0);

    const theirs = pending(opponent.id)[0];
    expect(theirs.options.max).toEqual(5);
    draw(opponent.id, 5);

    // Opponent: 5 drawn by Computer Error + 1 for the start of their turn
    expect(opponent.hand.cards.slice(0, 5)).toEqual(opponentTop);
    expect(opponent.hand.cards.length).toEqual(6);
    expect(state.activePlayer).toEqual(1);
    expect(player.discard.cards).toEqual([ card ]);
  });

  it('Should allow both players to draw nothing, and still end the turn', () => {
    const { state, player, opponent } = TestUtils.getAll(sim);
    play();
    draw(player.id, 0);
    draw(opponent.id, 0);
    expect(player.hand.cards).toEqual([]);
    expect(opponent.hand.cards.length).toEqual(1);
    expect(state.activePlayer).toEqual(1);
  });

  it('Should not let you attack afterwards', () => {
    const { player, opponent } = TestUtils.getAll(sim);
    play();
    draw(player.id, 1);
    draw(opponent.id, 1);
    let message = '';
    try {
      sim.dispatch(new AttackAction(1, 'Test attack'));
    } catch (error) {
      message = TestUtils.getErrorMessage(error);
    }
    expect(message).toEqual(GameMessage.NOT_YOUR_TURN);
  });

  it('Should cap the draw at the cards left in the deck', () => {
    const { player, opponent } = TestUtils.getAll(sim);
    player.deck.cards = player.deck.cards.slice(0, 2);
    play();
    expect(pending(player.id)[0].options.max).toEqual(2);
    draw(player.id, 2);
    expect(player.hand.cards.length).toEqual(2);
    expect(player.deck.cards.length).toEqual(0);
    draw(opponent.id, 0);
  });

  it('Should skip a player whose deck is empty', () => {
    const { state, player, opponent } = TestUtils.getAll(sim);
    player.deck.cards = [];
    play();
    expect(pending(player.id).length).toEqual(0);
    draw(opponent.id, 2);
    expect(opponent.hand.cards.length).toEqual(3);
    expect(state.activePlayer).toEqual(1);
  });

  it('Should end the turn immediately when neither player has a deck, discarding itself', () => {
    const { state, player, opponent } = TestUtils.getAll(sim);
    player.deck.cards = [];
    opponent.deck.cards = [];
    play();
    expect(player.discard.cards).toEqual([ card ]);
    expect(player.hand.cards).toEqual([]);
    // The opponent cannot draw for their turn and loses; either way the turn is over
    expect(state.activePlayer).toEqual(1);
  });
});

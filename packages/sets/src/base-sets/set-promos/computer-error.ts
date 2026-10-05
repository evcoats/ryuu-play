import {
  Card,
  CardList,
  ChooseCardsPrompt,
  Effect,
  EndTurnEffect,
  GameMessage,
  Player,
  State,
  StateUtils,
  StoreLike,
  TrainerCard,
  TrainerEffect,
  TrainerType,
} from '@ptcg/common';

// "Draw up to 5": the same secret top-of-deck ChooseCardsPrompt that Delcatty RS's
// Energy Draw uses - the number of cards picked is the number drawn, which cards
// they are does not matter (the deck is drawn from the top).
function* drawUpTo(next: Function, store: StoreLike, state: State, player: Player, count: number): IterableIterator<State> {
  const deckTop = new CardList();
  deckTop.cards = player.deck.top(count);
  if (deckTop.cards.length === 0) {
    return state;
  }

  let cards: Card[] = [];
  yield store.prompt(
    state,
    new ChooseCardsPrompt(
      player.id,
      GameMessage.CHOOSE_CARD_TO_HAND,
      deckTop,
      {},
      { min: 0, max: deckTop.cards.length, allowCancel: false, isSecret: true }
    ),
    selected => {
      cards = selected || [];
      next();
    }
  );

  player.deck.moveTo(player.hand, Math.min(cards.length, deckTop.cards.length));
  return state;
}

function* playCard(next: Function, store: StoreLike, state: State, effect: TrainerEffect): IterableIterator<State> {
  const player = effect.player;
  const opponent = StateUtils.getOpponent(state, player);

  // Discard it now rather than after the effect: the turn ends inside this effect
  // (immediately, if neither deck has cards), and the card must not still be in hand.
  effect.preventDefault = true;
  player.hand.moveCardTo(effect.trainerCard, player.discard);

  yield* drawUpTo(next, store, state, player, 5);
  yield* drawUpTo(next, store, state, opponent, 5);

  // "Your turn is over now (you don't get to attack)."
  return store.reduceEffect(state, new EndTurnEffect(player));
}

// Wizards Black Star Promo #16 (Rocket's Secret Machine).
export class ComputerErrorPR16 extends TrainerCard {
  public trainerType: TrainerType = TrainerType.ITEM;

  public set: string = 'PR';

  public name: string = 'Computer Error';

  public fullName: string = 'Computer Error PR16';

  public text: string =
    'You may draw up to 5 cards, then your opponent may draw up to 5 cards. Your turn is over now (you don\'t get ' +
    'to attack).';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const generator = playCard(() => generator.next(), store, state, effect);
      return generator.next().value;
    }

    return state;
  }
}

import { Card } from './card/card';
import { SuperType } from './card/card-types';
import { Effect } from './effects/effect';
import { EndTurnEffect } from './effects/game-phase-effects';
import { PassTurnAction } from './actions/game-actions';
import { GameError } from '../game-error';
import { GameLog, GameMessage } from '../game-message';
import { Player } from './state/player';
import { State, GamePhase } from './state/state';
import { Store } from './store';
import { StoreLike } from './store-like';

class OrderCard extends Card {
  set = 'TEST';
  name: string;
  fullName: string;

  constructor(public superType: SuperType, name: string, private visits: Card[]) {
    super();
    this.name = name;
    this.fullName = name;
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    this.visits.push(this);
    return state;
  }
}

class FailingCard extends Card {
  set = 'TEST';
  superType = SuperType.POKEMON;
  name = 'Failing';
  fullName = 'Failing';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof EndTurnEffect) {
      store.log(state, GameLog.LOG_BANNED_BY_ARBITER, { name: 'during the illegal action' });
      throw new GameError(GameMessage.ILLEGAL_ACTION);
    }
    return state;
  }
}

function referenceOrder(cards: Card[]): Card[] {
  return cards.slice().sort((c1, c2) => (c2.superType - c1.superType) || c1.fullName.localeCompare(c2.fullName));
}

describe('Store', () => {
  let store: Store;
  let state: State;
  let player: Player;
  let opponent: Player;
  let visits: Card[];

  beforeEach(() => {
    store = new Store({ onStateChange: () => {} });
    state = store.state;
    player = new Player();
    opponent = new Player();
    player.id = 1;
    opponent.id = 2;
    state.players = [player, opponent];
    state.phase = GamePhase.PLAYER_TURN;
    visits = [];
  });

  describe('propagateEffect', () => {

    const propagate = () => {
      visits.length = 0;
      store.reduceEffect(state, { type: 'TEST', preventDefault: true });
      return visits.slice();
    };

    it('should visit cards by super type, then name, like a stable sort', () => {
      const a = new OrderCard(SuperType.POKEMON, 'Bulbasaur', visits);
      const b = new OrderCard(SuperType.ENERGY, 'Water Energy', visits);
      const c = new OrderCard(SuperType.TRAINER, 'Bill', visits);
      const d = new OrderCard(SuperType.POKEMON, 'Abra', visits);
      player.hand.cards = [a, b];
      opponent.deck.cards = [c, d];

      expect(propagate()).toEqual(referenceOrder([a, b, c, d]));
      expect(propagate()).toEqual([b, c, d, a]);
    });

    it('should keep copies of the same card in zone order as they move', () => {
      const first = new OrderCard(SuperType.POKEMON, 'Pikachu', visits);
      const second = new OrderCard(SuperType.POKEMON, 'Pikachu', visits);
      player.hand.cards = [first];
      player.deck.cards = [second];
      expect(propagate()).toEqual([first, second]);

      // Hand is collected before the deck, so moving the cards swaps their order.
      player.hand.cards = [second];
      player.deck.cards = [first];
      expect(propagate()).toEqual([second, first]);

      // The stadium is collected before the deck.
      player.hand.cards = [];
      player.stadium.cards = [first];
      player.deck.cards = [second];
      expect(propagate()).toEqual([first, second]);
    });

    it('should include a card that enters the game later', () => {
      const a = new OrderCard(SuperType.POKEMON, 'Mew', visits);
      const b = new OrderCard(SuperType.ENERGY, 'Psychic Energy', visits);
      player.hand.cards = [a, b];
      expect(propagate()).toEqual([b, a]);

      const c = new OrderCard(SuperType.TRAINER, 'Gust of Wind', visits);
      const d = new OrderCard(SuperType.POKEMON, 'Mew', visits);
      opponent.discard.cards = [d, c];
      const all = [a, b, d, c];
      expect(propagate()).toEqual(referenceOrder(all));
      expect(propagate()).toEqual([b, c, a, d]);
    });

    it('should visit no cards when nothing is in play', () => {
      expect(propagate()).toEqual([]);
    });
  });

  describe('rollback of an illegal action', () => {

    it('should restore the log without entries from the failed action', () => {
      store.log(state, GameLog.LOG_BANNED_BY_ARBITER, { name: 'before' });
      const before = state.logs.slice();
      player.hand.cards = [new FailingCard()];

      expect(() => store.dispatch(new PassTurnAction(1))).toThrow();

      expect(store.state.logs).toEqual(before);
      expect(store.state.logs[0]).toBe(before[0]);
    });

    it('should keep logging after a rollback', () => {
      player.hand.cards = [new FailingCard()];
      expect(() => store.dispatch(new PassTurnAction(1))).toThrow();

      store.log(store.state, GameLog.LOG_BANNED_BY_ARBITER, { name: 'after' });
      expect(store.state.logs.length).toEqual(1);
      expect(store.state.logs[0].params).toEqual({ name: 'after' });
    });

    it('should not share the log array between the restored state and the old one', () => {
      store.log(state, GameLog.LOG_BANNED_BY_ARBITER, { name: 'before' });
      player.hand.cards = [new FailingCard()];
      expect(() => store.dispatch(new PassTurnAction(1))).toThrow();

      expect(store.state).not.toBe(state);
      expect(store.state.logs).not.toBe(state.logs);
      expect(store.state.logs.length).toEqual(1);
    });
  });
});

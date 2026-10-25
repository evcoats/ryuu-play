import { AttackAction, RetreatAction } from '../actions/game-actions';
import { ResolvePromptAction } from '../actions/resolve-prompt-action';
import { CardType, SpecialCondition } from '../card/card-types';
import { EnergyCard } from '../card/energy-card';
import { PokemonCard } from '../card/pokemon-card';
import { Resistance, Weakness } from '../card/pokemon-types';
import { GameError } from '../../game-error';
import { GameMessage } from '../../game-message';
import { ChooseEnergyPrompt } from '../prompts/choose-energy-prompt';
import { CoinFlipPrompt } from '../prompts/coin-flip-prompt';
import { CardList } from '../state/card-list';
import { Player } from '../state/player';
import { PokemonSlot } from '../state/pokemon-slot';
import { Rules } from '../state/rules';
import { GamePhase, State } from '../state/state';
import { Store } from '../store';

class Mon extends PokemonCard {
  set = 'TEST';
  name = 'Mon';
  fullName = 'Mon TEST';
  hp = 100;
  attacks = [ { name: 'Hit', cost: [], damage: '10', text: '' } ];
  constructor(cardTypes: CardType[] = [], weakness: Weakness[] = [], resistance: Resistance[] = [], retreat: CardType[] = []) {
    super();
    this.cardTypes = cardTypes;
    this.weakness = weakness;
    this.resistance = resistance;
    this.retreat = retreat;
  }
}

class Energy extends EnergyCard {
  set = 'TEST';
  name = 'Energy';
  fullName = 'Energy TEST';
  provides = [ CardType.COLORLESS ];
}

function makePlayer(id: number, active: PokemonCard): Player {
  const player = new Player();
  player.id = id;
  player.name = 'P' + id;
  player.active = new PokemonSlot();
  player.active.pokemons.cards.push(active);
  for (let i = 0; i < 5; i++) {
    player.bench.push(new PokemonSlot());
  }
  player.bench[0].pokemons.cards.push(new Mon());
  for (let i = 0; i < 6; i++) {
    const prize = new CardList();
    prize.cards.push(new Mon());
    player.prizes.push(prize);
  }
  for (let i = 0; i < 10; i++) {
    player.deck.cards.push(new Mon());
  }
  return player;
}

// Player 1's turn, its Active Confused (unless `confused` is false), with `energy` Energy attached.
function setup(active: Mon, baseEraConfusion: boolean, energy = 0, confused = true): Store {
  const store = new Store({ onStateChange() {} });
  const state = new State();
  state.rules = new Rules({ baseEraConfusion });
  state.players = [ makePlayer(1, active), makePlayer(2, new Mon()) ];
  state.phase = GamePhase.PLAYER_TURN;
  state.activePlayer = 0;
  state.turn = 3;
  if (confused) {
    state.players[0].active.specialConditions.push(SpecialCondition.CONFUSED);
  }
  for (let i = 0; i < energy; i++) {
    state.players[0].active.energies.cards.push(new Energy());
  }
  store.state = state;
  return store;
}

// Dispatches `action`, then answers its prompts: coin flips from `flips` in order, Energy for a
// Retreat Cost from the first cards. Returns how many coins were flipped.
function play(store: Store, action: any, flips: boolean[] = []): number {
  store.dispatch(action);
  let flipped = 0;
  for (;;) {
    const prompt = store.state.prompts.find(p => p.result === undefined);
    if (prompt === undefined) {
      return flipped;
    }
    if (prompt instanceof CoinFlipPrompt) {
      store.dispatch(new ResolvePromptAction(prompt.id, flips[flipped++]));
    } else if (prompt instanceof ChooseEnergyPrompt) {
      store.dispatch(new ResolvePromptAction(prompt.id, prompt.energy.slice(0, prompt.cost.length)));
    } else {
      throw new Error('unexpected prompt ' + prompt.type);
    }
  }
}

const psychic = () => new Mon([ CardType.PSYCHIC ], [ { type: CardType.PSYCHIC } ]);

describe('Confusion', () => {
  it('Should be the later rules by default', () => {
    expect(new Rules().baseEraConfusion).toBe(false);
  });

  describe('later rules (default)', () => {
    it('Should do 30 damage to itself on tails, with no Weakness', () => {
      const store = setup(psychic(), false);
      const [ me, opp ] = store.state.players;
      play(store, new AttackAction(1, 'Hit'), [ false ]);
      expect(me.active.damage).toBe(30);
      expect(opp.active.damage).toBe(0);
    });

    it('Should retreat with no coin flip', () => {
      const store = setup(new Mon([], [], [], [ CardType.COLORLESS ]), false, 1);
      const [ me ] = store.state.players;
      const confused = me.active;
      expect(play(store, new RetreatAction(1, 0))).toBe(0);
      expect(me.bench[0]).toBe(confused);
    });
  });

  describe('Base-era rules (Rules.baseEraConfusion)', () => {
    it('Should attack normally on heads', () => {
      const store = setup(new Mon(), true);
      const [ me, opp ] = store.state.players;
      play(store, new AttackAction(1, 'Hit'), [ true ]);
      expect(me.active.damage).toBe(0);
      expect(opp.active.damage).toBe(10);
    });

    it('Should do 20 damage to itself on tails', () => {
      const store = setup(new Mon(), true);
      const [ me, opp ] = store.state.players;
      play(store, new AttackAction(1, 'Hit'), [ false ]);
      expect(me.active.damage).toBe(20);
      expect(opp.active.damage).toBe(0);
    });

    it('Should apply its own Weakness (Kadabra: 40, April 6, 2000)', () => {
      const store = setup(psychic(), true);
      const [ me ] = store.state.players;
      play(store, new AttackAction(1, 'Hit'), [ false ]);
      expect(me.active.damage).toBe(40);
    });

    it('Should apply its own Resistance (Aerodactyl: no damage, May 11, 2000)', () => {
      const store = setup(new Mon([ CardType.FIGHTING ], [], [ { type: CardType.FIGHTING, value: -30 } ]), true);
      const [ me ] = store.state.players;
      play(store, new AttackAction(1, 'Hit'), [ false ]);
      expect(me.active.damage).toBe(0);
    });

    it('Should retreat on heads after paying the Retreat Cost', () => {
      const store = setup(new Mon([], [], [], [ CardType.COLORLESS ]), true, 1);
      const [ me ] = store.state.players;
      const confused = me.active;
      expect(play(store, new RetreatAction(1, 0), [ true ])).toBe(1);
      expect(me.bench[0]).toBe(confused);
      expect(confused.energies.cards.length).toBe(0);
      expect(confused.specialConditions).not.toContain(SpecialCondition.CONFUSED);
    });

    it('Should stay Active on tails, Energy paid, and not try again that turn (April 13, 2000)', () => {
      const store = setup(new Mon([], [], [], [ CardType.COLORLESS ]), true, 2);
      const [ me ] = store.state.players;
      const confused = me.active;
      expect(play(store, new RetreatAction(1, 0), [ false ])).toBe(1);
      expect(me.active).toBe(confused);
      expect(confused.energies.cards.length).toBe(1);
      expect(me.discard.cards.length).toBe(1);
      expect(confused.specialConditions).toContain(SpecialCondition.CONFUSED);

      let message = '';
      try {
        store.dispatch(new RetreatAction(1, 0));
      } catch (error) {
        message = error instanceof GameError ? error.message : '';
      }
      expect(message).toBe(GameMessage.RETREAT_ALREADY_USED);
    });

    it('Should flip for a free retreat too', () => {
      const store = setup(new Mon(), true);
      const [ me ] = store.state.players;
      const confused = me.active;
      expect(play(store, new RetreatAction(1, 0), [ false ])).toBe(1);
      expect(me.active).toBe(confused);
    });

    it('Should not flip to retreat a Pokemon that is not Confused', () => {
      const store = setup(new Mon(), true, 0, false);
      const [ me ] = store.state.players;
      const active = me.active;
      expect(play(store, new RetreatAction(1, 0))).toBe(0);
      expect(me.bench[0]).toBe(active);
    });
  });
});

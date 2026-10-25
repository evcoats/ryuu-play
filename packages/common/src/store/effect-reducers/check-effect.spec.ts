import { PokemonCard } from '../card/pokemon-card';
import { ResolvePromptAction } from '../actions/resolve-prompt-action';
import { ChoosePokemonPrompt } from '../prompts/choose-pokemon-prompt';
import { ChoosePrizePrompt } from '../prompts/choose-prize-prompt';
import { CardList } from '../state/card-list';
import { Player } from '../state/player';
import { PokemonSlot } from '../state/pokemon-slot';
import { State, GamePhase, GameWinner } from '../state/state';
import { GameLog } from '../../game-message';
import { Store } from '../store';
import { checkState } from './check-effect';

class TestPokemon extends PokemonCard {
  set = 'TEST';
  name = 'Test Pokemon';
  fullName = 'Test Pokemon TEST';
  hp = 50;
}

interface Side {
  prizes: number;      // Prizes left
  knockedOut: boolean; // the Active has damage >= HP
  benched: boolean;    // one Pokemon on the Bench
}

function makePlayer(id: number, side: Side): Player {
  const player = new Player();
  player.id = id;
  player.name = 'P' + id;
  player.active = new PokemonSlot();
  player.active.pokemons.cards.push(new TestPokemon());
  player.active.damage = side.knockedOut ? 50 : 0;
  for (let i = 0; i < 5; i++) {
    player.bench.push(new PokemonSlot());
  }
  if (side.benched) {
    player.bench[2].pokemons.cards.push(new TestPokemon());
  }
  for (let i = 0; i < 6; i++) {
    const prize = new CardList();
    if (i < side.prizes) {
      prize.cards.push(new TestPokemon());
    }
    player.prizes.push(prize);
  }
  return player;
}

// Runs the check after an attack and answers every prompt it opens: Prizes from the left,
// a new Active from the Bench. Returns the prompts asked, in order.
function knockOut(store: Store, a: Side, b: Side): (ChoosePrizePrompt | ChoosePokemonPrompt)[] {
  const state = store.state;
  state.players = [makePlayer(1, a), makePlayer(2, b)];
  state.phase = GamePhase.ATTACK;
  checkState(store, state);

  const asked: (ChoosePrizePrompt | ChoosePokemonPrompt)[] = [];
  for (;;) {
    const prompt = state.prompts.find(p => p.result === undefined);
    if (prompt === undefined) {
      return asked;
    }
    const player = state.players.find(p => p.id === prompt.playerId) as Player;
    let result: any;
    if (prompt instanceof ChoosePrizePrompt) {
      result = player.prizes.filter(p => p.cards.length > 0).slice(0, prompt.options.count);
    } else if (prompt instanceof ChoosePokemonPrompt) {
      result = [ player.bench.find(s => s.pokemons.cards.length > 0) ];
    } else {
      throw new Error('unexpected prompt ' + prompt.type);
    }
    asked.push(prompt);
    store.dispatch(new ResolvePromptAction(prompt.id, result));
  }
}

const promotions = (asked: any[]) => asked.filter(p => p instanceof ChoosePokemonPrompt).map(p => p.playerId);
const logged = (state: State) => state.logs.map(l => l.message);

describe('checkState knock outs', () => {
  let store: Store;

  beforeEach(() => {
    store = new Store({ onStateChange: () => {} });
  });

  it('ends the game on the last Prize without asking the knocked-out player for a new Active', () => {
    const asked = knockOut(store,
      { prizes: 1, knockedOut: false, benched: false },
      { prizes: 6, knockedOut: true, benched: true });
    const state = store.state;

    expect(asked.map(p => p.type)).toEqual([ 'Choose prize' ]);
    expect(state.phase).toBe(GamePhase.FINISHED);
    expect(state.winner).toBe(GameWinner.PLAYER_1);
    expect(logged(state)).toContain(GameLog.LOG_PLAYER_NO_PRIZE_CARD);
    expect(logged(state)).not.toContain(GameLog.LOG_PLAYER_NO_ACTIVE_POKEMON);
    expect(logged(state)).toContain(GameLog.LOG_GAME_FINISHED_WINNER);
  });

  it('still asks for a new Active when Prizes remain', () => {
    const asked = knockOut(store,
      { prizes: 2, knockedOut: false, benched: false },
      { prizes: 6, knockedOut: true, benched: true });
    const state = store.state;

    expect(asked.map(p => p.type)).toEqual([ 'Choose prize', 'Choose pokemon' ]);
    expect(promotions(asked)).toEqual([ 2 ]);
    expect(state.phase).toBe(GamePhase.ATTACK);
    expect(state.players[1].active.pokemons.cards.length).toBe(1);
  });

  it('both take their last Prize: the player who can replace their Active wins (Fossil FAQ)', () => {
    const asked = knockOut(store,
      { prizes: 1, knockedOut: true, benched: true },
      { prizes: 1, knockedOut: true, benched: false });

    expect(promotions(asked)).toEqual([]);
    expect(store.state.winner).toBe(GameWinner.PLAYER_1);
  });

  it('last Prize, but no Pokemon left to replace your own Active: a draw (Sep 13, 2001 WotC Chat, Q30)', () => {
    const asked = knockOut(store,
      { prizes: 1, knockedOut: true, benched: false },
      { prizes: 6, knockedOut: true, benched: true });

    expect(promotions(asked)).toEqual([]);
    expect(store.state.winner).toBe(GameWinner.DRAW);
  });

  it('no new Active is asked for when the opponent has no Pokemon left', () => {
    const asked = knockOut(store,
      { prizes: 6, knockedOut: true, benched: true },
      { prizes: 6, knockedOut: true, benched: false });

    expect(promotions(asked)).toEqual([]);
    expect(store.state.winner).toBe(GameWinner.PLAYER_1);
  });

  // Every combination of Prizes left (1 or 2), knocked-out Active and Bench for both players.
  // The winner is the one of the rules as they were applied before (promote whoever can, then
  // check), and a new Active is asked for only when the game goes on.
  it('keeps the winner of promote-then-check in every case', () => {
    const sides: Side[] = [];
    for (const prizes of [1, 2]) {
      for (const knockedOut of [false, true]) {
        for (const benched of [false, true]) {
          sides.push({ prizes, knockedOut, benched });
        }
      }
    }
    for (const a of sides) {
      for (const b of sides) {
        store = new Store({ onStateChange: () => {} });
        const asked = knockOut(store, a, b);
        const state = store.state;

        // Reference: Prizes taken for the opponent's knocked-out Active, then promotion.
        const prizesLeft = [a.prizes - (b.knockedOut ? 1 : 0), b.prizes - (a.knockedOut ? 1 : 0)];
        const noPokemon = [a.knockedOut && !a.benched, b.knockedOut && !b.benched];
        const points = [
          (prizesLeft[0] === 0 ? 1 : 0) + (noPokemon[1] ? 1 : 0),
          (prizesLeft[1] === 0 ? 1 : 0) + (noPokemon[0] ? 1 : 0)
        ];
        const ends = points[0] + points[1] > 0;
        const winner = !ends ? GameWinner.NONE
          : points[0] > points[1] ? GameWinner.PLAYER_1
            : points[1] > points[0] ? GameWinner.PLAYER_2 : GameWinner.DRAW;
        const promoting = ends ? [] : [a, b].map((s, i) => s.knockedOut && s.benched ? i + 1 : 0).filter(id => id > 0);

        const label = JSON.stringify({ a, b });
        expect(state.phase).withContext(label).toBe(ends ? GamePhase.FINISHED : GamePhase.ATTACK);
        expect(state.winner).withContext(label).toBe(winner);
        expect(promotions(asked).sort()).withContext(label).toEqual(promoting);
      }
    }
  });

});

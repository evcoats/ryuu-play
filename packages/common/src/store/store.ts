import { Action } from './actions/action';
import { AbortGameAction } from './actions/abort-game-action';
import { AppendLogAction } from './actions/append-log-action';
import { Card } from './card/card';
import { ChangeAvatarAction } from './actions/change-avatar-action';
import { Effect } from './effects/effect';
import { GameError } from '../game-error';
import { GameMessage, GameLog } from '../game-message';
import { Prompt } from './prompts/prompt';
import { ReorderHandAction, ReorderBenchAction } from './actions/reorder-actions';
import { ResolvePromptAction } from './actions/resolve-prompt-action';
import { State } from './state/state';
import { StateLog, StateLogParam } from './state/state-log';
import { StoreHandler } from './store-handler';
import { StoreLike } from './store-like';
import { generateId, deepClone } from '../utils';
import { attackReducer } from './effect-reducers/attack-effect';
import { playCardReducer } from './reducers/play-card-reducer';
import { playEnergyReducer } from './effect-reducers/play-energy-effect';
import { playPokemonReducer } from './effect-reducers/play-pokemon-effect';
import { playTrainerReducer } from './effect-reducers/play-trainer-effect';
import { playerTurnReducer } from './reducers/player-turn-reducer';
import { gamePhaseReducer } from './effect-reducers/game-phase-effect';
import { gameReducer } from './effect-reducers/game-effect';
import { checkState, checkStateReducer } from './effect-reducers/check-effect';
import { playerStateReducer} from './reducers/player-state-reducer';
import { retreatReducer } from './effect-reducers/retreat-effect';
import { setupPhaseReducer } from './reducers/setup-reducer';
import { abortGameReducer } from './reducers/abort-game-reducer';

interface PromptItem {
  ids: number[];
  then: (results: any) => void;
  isArray: boolean;
}

export class Store implements StoreLike {

  public state: State = new State();
  private promptItems: PromptItem[] = [];
  private waitItems: (() => void)[] = [];
  private logId: number = 0;
  private cardRanks: Map<Card, number> | undefined;

  constructor(private handler: StoreHandler) { }

  public dispatch(action: Action): State {
    let state = this.state;

    if (action instanceof AbortGameAction) {
      state = abortGameReducer(this, state, action);
      this.handler.onStateChange(state);
      return state;
    }

    if (action instanceof ReorderHandAction
      || action instanceof ReorderBenchAction
      || action instanceof ChangeAvatarAction) {
      state = playerStateReducer(this, state, action);
      this.handler.onStateChange(state);
      return state;
    }

    if (action instanceof ResolvePromptAction) {
      state = this.reducePrompt(state, action);
      if (this.promptItems.length === 0) {
        state = checkState(this, state);
      }
      this.handler.onStateChange(state);
      return state;
    }

    if (action instanceof AppendLogAction) {
      this.log(state, action.message, action.params, action.id);
      this.handler.onStateChange(state);
      return state;
    }

    if (state.prompts.some(p => p.result === undefined)) {
      throw new GameError(GameMessage.ACTION_IN_PROGRESS);
    }

    state = this.reduce(state, action);

    return state;
  }

  public reduceEffect(state: State, effect: Effect): State {
    state = this.propagateEffect(state, effect);

    if (effect.preventDefault === true) {
      return state;
    }

    state = gamePhaseReducer(this, state, effect);
    state = playEnergyReducer(this, state, effect);
    state = playPokemonReducer(this, state, effect);
    state = playTrainerReducer(this, state, effect);
    state = retreatReducer(this, state, effect);
    state = gameReducer(this, state, effect);
    state = attackReducer(this, state, effect);
    state = checkStateReducer(this, state, effect);

    return state;
  }

  public prompt(state: State, prompts: Prompt<any>[] | Prompt<any>, then: (results: any) => void): State {
    let isArray = true;

    if (!(prompts instanceof Array)) {
      isArray = false;
      prompts = [prompts];
    }

    for (let i = 0; i < prompts.length; i++) {
      const id = generateId(state.prompts);
      prompts[i].id = id;
      state.prompts.push(prompts[i]);
    }

    const promptItem: PromptItem = {
      ids: prompts.map(prompt => prompt.id),
      then: then,
      isArray
    };

    this.promptItems.push(promptItem);
    return state;
  }

  public waitPrompt(state: State, callback: () => void): State {
    this.waitItems.push(callback);
    return state;
  }

  public log(state: State, message: GameLog, params?: StateLogParam, client?: number): void {
    const log = new StateLog(message, params, client);
    log.id = ++this.logId;
    state.logs.push(log);
  }

  private reducePrompt(state: State, action: ResolvePromptAction): State {
    // Resolve prompts actions
    const prompt = state.prompts.find(item => item.id === action.id);
    const promptItem = this.promptItems.find(item => item.ids.indexOf(action.id) !== -1);

    if (prompt === undefined || promptItem === undefined) {
      throw new GameError(GameMessage.ILLEGAL_ACTION);
    }

    if (prompt.result !== undefined) {
      throw new GameError(GameMessage.PROMPT_ALREADY_RESOLVED);
    }

    try {
      prompt.result = action.result;

      const results = promptItem.ids.map(id => {
        const p = state.prompts.find(item => item.id === id);
        return p === undefined ? undefined : p.result;
      });

      if (action.log !== undefined) {
        this.log(state, action.log.message, action.log.params, action.log.client);
      }

      if (results.every(result => result !== undefined)) {
        const itemIndex = this.promptItems.indexOf(promptItem);
        promptItem.then(promptItem.isArray ? results : results[0]);
        this.promptItems.splice(itemIndex, 1);
      }

      this.resolveWaitItems();
    } catch (storeError) {
      // Illegal action
      prompt.result = undefined;
      throw storeError;
    }

    return state;
  }

  private resolveWaitItems(): void {
    while (this.promptItems.length === 0 && this.waitItems.length > 0) {
      const waitItem = this.waitItems.pop();
      if (waitItem !== undefined) {
        waitItem();
      }
    }
  }

  public hasPrompts(): boolean {
    return this.promptItems.length > 0;
  }

  private reduce(state: State, action: Action): State {
    // The log only grows, and existing entries are never modified, so the backup keeps
    // the current entries by reference instead of deep-cloning the whole history.
    const logs = state.logs;
    state.logs = [];
    const stateBackup: State = deepClone(state, [ Card ]);
    state.logs = logs;
    stateBackup.logs = logs.slice();
    this.promptItems.length = 0;

    try {
      state = setupPhaseReducer(this, state, action);
      state = playCardReducer(this, state, action);
      state = playerTurnReducer(this, state, action);

      this.resolveWaitItems();
      if (this.promptItems.length === 0) {
        state = checkState(this, state);
      }
    } catch (storeError) {
      // Illegal action
      this.state = stateBackup;
      this.promptItems.length = 0;
      throw storeError;
    }

    this.handler.onStateChange(state);
    return state;
  }

  private propagateEffect(state: State, effect: Effect): State {
    // Cards that keep Card's no-op reduceEffect (most basic Energy, vanilla Pokemon) are
    // left out: asking them changes nothing, and they are a third of the cards in a game.
    const cards: Card[] = [];
    const collect = (list: Card[]) => {
      for (const c of list) {
        if (c.reduceEffect !== Card.prototype.reduceEffect) {
          cards.push(c);
        }
      }
    };
    for (const player of state.players) {
      collect(player.stadium.cards);
      collect(player.supporter.cards);
      collect(player.active.trainers.cards);
      collect(player.active.energies.cards);
      collect(player.active.pokemons.cards);
      for (const bench of player.bench) {
        collect(bench.trainers.cards);
        collect(bench.energies.cards);
        collect(bench.pokemons.cards);
      }
      for (const prize of player.prizes) {
        collect(prize.cards);
      }
      collect(player.hand.cards);
      collect(player.deck.cards);
      collect(player.discard.cards);
    }
    for (const c of this.sortCards(cards)) {
      state = c.reduceEffect(this, state, effect);
    }
    return state;
  }

  // Same order as a stable sort by superType (descending), then fullName:
  // a counting sort on a precomputed rank, which keeps the collection order
  // within a rank. The ranks are rebuilt whenever a card not seen before
  // shows up, so cards entering the game mid-way are handled.
  private sortCards(cards: Card[]): Card[] {
    const n = cards.length;
    const keys = new Int32Array(n);
    let ranks = this.cardRanks;
    let maxRank = -1;
    for (let i = 0; i < n; i++) {
      const rank = ranks === undefined ? undefined : ranks.get(cards[i]);
      if (rank === undefined) {
        ranks = this.buildCardRanks(cards);
        maxRank = -1;
        i = -1;
        continue;
      }
      keys[i] = rank;
      if (rank > maxRank) {
        maxRank = rank;
      }
    }
    const counts = new Int32Array(maxRank + 2);
    for (let i = 0; i < n; i++) {
      counts[keys[i] + 1]++;
    }
    for (let r = 1; r < counts.length; r++) {
      counts[r] += counts[r - 1];
    }
    const sorted: Card[] = new Array(n);
    for (let i = 0; i < n; i++) {
      sorted[counts[keys[i]]++] = cards[i];
    }
    return sorted;
  }

  private buildCardRanks(cards: Card[]): Map<Card, number> {
    const known = this.cardRanks === undefined ? [] : Array.from(this.cardRanks.keys());
    const all = Array.from(new Set([ ...known, ...cards ]));
    const compare = (c1: Card, c2: Card) => (c2.superType - c1.superType) || c1.fullName.localeCompare(c2.fullName);
    all.sort(compare);
    const ranks = new Map<Card, number>();
    let rank = 0;
    all.forEach((c, i) => {
      if (i > 0 && compare(all[i - 1], c) !== 0) {
        rank++;
      }
      ranks.set(c, rank);
    });
    this.cardRanks = ranks;
    return ranks;
  }
}

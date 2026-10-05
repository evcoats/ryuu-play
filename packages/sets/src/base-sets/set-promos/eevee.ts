import {
  Card,
  CardType,
  CheckPokemonPlayedTurnEffect,
  ChooseCardsPrompt,
  ConfirmPrompt,
  Effect,
  EvolveEffect,
  GameError,
  GameMessage,
  Player,
  PokemonCard,
  PokemonSlot,
  PowerEffect,
  PowerType,
  ShuffleDeckPrompt,
  SpecialCondition,
  Stage,
  State,
  StateUtils,
  StoreLike,
  SuperType,
} from '@ptcg/common';

// Chain Reaction is a triggered Pokemon Power. The printed English text says
// "when a Pokemon evolves" - any Pokemon, either player's (the Japanese text
// limits it to your own; the English printing is what is implemented here, and
// the trigger fires on the opponent's evolutions as well). It is offered to
// Eevee's owner through a ConfirmPrompt whenever an EvolveEffect is reduced for
// any Pokemon other than this Eevee itself. The evolution from the deck is itself
// an EvolveEffect, so it can set off another Eevee's Chain Reaction in turn.

function canUseChainReaction(store: StoreLike, state: State, self: EeveePR11, owner: Player, slot: PokemonSlot): boolean {
  if (slot.getPokemonCard() !== self) {
    return false;
  }

  if (slot.specialConditions.includes(SpecialCondition.ASLEEP)
    || slot.specialConditions.includes(SpecialCondition.CONFUSED)
    || slot.specialConditions.includes(SpecialCondition.PARALYZED)) {
    return false;
  }

  if (owner.deck.cards.length === 0) {
    return false;
  }

  // "This counts as evolving Eevee": the normal evolution timing rule applies, so an
  // Eevee put into play this turn (or on the first turn) cannot be evolved by it.
  const playedTurnEffect = new CheckPokemonPlayedTurnEffect(owner, slot);
  store.reduceEffect(state, playedTurnEffect);
  if (playedTurnEffect.pokemonPlayedTurn >= state.turn) {
    return false;
  }

  // Muk's Toxic Gas, Goop Gas Attack, ...
  try {
    store.reduceEffect(state, new PowerEffect(owner, self.powers[0], self));
  } catch {
    return false;
  }

  return true;
}

function* useChainReaction(
  next: Function,
  store: StoreLike,
  state: State,
  self: EeveePR11,
  owner: Player,
  trigger: EvolveEffect
): IterableIterator<State> {
  let wantToUse = false;
  yield store.prompt(state, new ConfirmPrompt(owner.id, GameMessage.WANT_TO_USE_ABILITY), result => {
    wantToUse = result;
    next();
  });

  if (!wantToUse) {
    return state;
  }

  // Re-check: the triggering evolution must actually have happened, and Eevee must
  // still be able to use its Power.
  const slot = StateUtils.findPokemonSlot(state, self);
  if (trigger.target.getPokemonCard() !== trigger.pokemonCard
    || slot === undefined
    || !canUseChainReaction(store, state, self, owner, slot)) {
    return state;
  }

  let cards: Card[] = [];
  yield store.prompt(
    state,
    new ChooseCardsPrompt(
      owner.id,
      GameMessage.CHOOSE_CARD_TO_EVOLVE,
      owner.deck,
      { superType: SuperType.POKEMON, evolvesFrom: 'Eevee' },
      { min: 0, max: 1, allowCancel: false }
    ),
    selected => {
      cards = selected || [];
      next();
    }
  );

  const evolution = cards[0] as PokemonCard | undefined;
  if (evolution !== undefined
    && owner.deck.cards.includes(evolution)
    && evolution.evolvesFrom === 'Eevee'
    && evolution.stage === Stage.STAGE_1) {
    // EvolveEffect takes the card from the hand, so pass it through the hand.
    owner.deck.moveCardTo(evolution, owner.hand);
    try {
      store.reduceEffect(state, new EvolveEffect(owner, slot, evolution));
    } catch (error) {
      // The evolution was blocked (e.g. Aerodactyl's Prehistoric Power). Blocking
      // happens before the card moves, so the card goes back and the deck is still
      // shuffled; anything other than a rules refusal is a real bug.
      if (!(error instanceof GameError)) {
        throw error;
      }
    }
    if (owner.hand.cards.includes(evolution)) {
      owner.hand.moveCardTo(evolution, owner.deck);
    }
  }

  return store.prompt(state, new ShuffleDeckPrompt(owner.id), order => {
    owner.deck.applyOrder(order);
  });
}

// Wizards Black Star Promo #11.
export class EeveePR11 extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public cardTypes: CardType[] = [CardType.COLORLESS];

  public hp: number = 30;

  public powers = [
    {
      name: 'Chain Reaction',
      powerType: PowerType.POKEPOWER,
      text:
        'This power can only be used when a Pokémon evolves. Search your deck for a card that evolves from Eevee ' +
        'and attach it to Eevee. This counts as evolving Eevee. Shuffle your deck afterward. This power can\'t be ' +
        'used if Eevee is Asleep, Confused, or Paralyzed.'
    },
  ];

  public attacks = [
    {
      name: 'Bite',
      cost: [CardType.COLORLESS],
      damage: '20',
      text: ''
    },
  ];

  public weakness = [
    { type: CardType.FIGHTING }
  ];

  public resistance = [
    { type: CardType.PSYCHIC, value: -30 }
  ];

  public retreat = [];

  public set: string = 'PR';

  public name: string = 'Eevee';

  public fullName: string = 'Eevee PR11';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof EvolveEffect) {
      const slot = StateUtils.findPokemonSlot(state, this);

      // Eevee must be in play, and it is not this Eevee that is evolving
      if (slot === undefined || slot === effect.target) {
        return state;
      }

      const owner = StateUtils.findOwner(state, slot);
      if (!canUseChainReaction(store, state, this, owner, slot)) {
        return state;
      }

      // The prompt resolves after the triggering evolution has been applied
      const generator = useChainReaction(() => generator.next(), store, state, this, owner, effect);
      return generator.next().value;
    }

    return state;
  }
}

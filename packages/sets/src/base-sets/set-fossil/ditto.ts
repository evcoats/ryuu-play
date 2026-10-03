import {
  AfterCheckProvidedEnergyEffect,
  Attack,
  CardType,
  CheckHpEffect,
  CheckPokemonStatsEffect,
  CheckPokemonTypeEffect,
  CheckRetreatCostEffect,
  ChooseAttackPrompt,
  Effect,
  GameError,
  GameMessage,
  PokemonCard,
  PokemonSlot,
  Power,
  PowerEffect,
  PowerType,
  SpecialCondition,
  Stage,
  State,
  StateUtils,
  StoreLike,
  UseAttackEffect,
  UsePowerEffect,
} from '@ptcg/common';

// Transform asks the store whether its Power is blocked, and the store propagates that
// question through every card in play - Ditto included - so the question would ask itself
// forever. A nested lookup reports "not transformed" instead, which every caller handles.
let resolvingTransform = false;

function getTransformedPokemonCard(self: Ditto, store: StoreLike, state: State, target: PokemonSlot): PokemonCard | undefined {
  if (resolvingTransform) {
    return undefined;
  }
  resolvingTransform = true;
  try {
    return findTransformedPokemonCard(self, store, state, target);
  } finally {
    resolvingTransform = false;
  }
}

function findTransformedPokemonCard(self: Ditto, store: StoreLike, state: State, target: PokemonSlot): PokemonCard | undefined {
  const power: Power = { powerType: PowerType.POKEPOWER, name: 'Transform', text: '' };
  const player = StateUtils.findOwner(state, target);
  const opponent = StateUtils.getOpponent(state, player);

  if (player.active !== target || target.getPokemonCard() !== self) {
    return undefined;
  }

  if (player.active.specialConditions.includes(SpecialCondition.ASLEEP)
    || player.active.specialConditions.includes(SpecialCondition.CONFUSED)
    || player.active.specialConditions.includes(SpecialCondition.PARALYZED)) {
    return undefined;
  }

  const defending = opponent.active.getPokemonCard();
  if (!defending) {
    return undefined;
  }

  // Try to reduce PowerEffect, to check if something is blocking our ability
  try {
    const powerEffect = new PowerEffect(player, power, self);
    store.reduceEffect(state, powerEffect);
  } catch {
    return undefined;
  }

  return defending;
}

export class Ditto extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public cardTypes: CardType[] = [CardType.COLORLESS];

  public hp: number = 50;

  public powers = [
    {
      name: 'Transform',
      powerType: PowerType.POKEPOWER,
      useWhenInPlay: true,
      text:
        'If Ditto is your Active Pokémon, treat it as if it were the same card as the Defending Pokémon, including ' +
        'type, Hit Points, Weakness, and so on, except Ditto can\'t evolve, always has this Pokémon Power, and you ' +
        'may treat any Energy attached to Ditto as Energy of any type. Ditto isn\'t a copy of any other Pokémon ' +
        'while Ditto is Asleep, Confused, or Paralyzed.'
    },
  ];

  public weakness = [
    { type: CardType.FIGHTING }
  ];

  public resistance = [
    { type: CardType.PSYCHIC, value: -30 }
  ];

  public retreat = [CardType.COLORLESS];

  public set: string = 'FO';

  public name: string = 'Ditto';

  public fullName: string = 'Ditto FO';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {

    // HP of the Defending Pokemon
    if (effect instanceof CheckHpEffect && effect.target.pokemons.cards.includes(this)) {
      const defending = getTransformedPokemonCard(this, store, state, effect.target);
      if (!defending) {
        return state;
      }
      effect.hp += defending.hp - this.hp;
      return state;
    }

    // Retreat Costs
    if (effect instanceof CheckRetreatCostEffect && effect.player.active.pokemons.cards.includes(this)) {
      const defending = getTransformedPokemonCard(this, store, state, effect.player.active);
      if (!defending) {
        return state;
      }

      // Defending has less retreat
      if (defending.retreat.length < this.retreat.length) {
        // Decrease the effect.cost by that amount of energies
        effect.cost.length = Math.max(0, effect.cost.length - (this.retreat.length - defending.retreat.length));
      } else {
        // defending has equal or greater retreat cost
        for (let i = this.retreat.length; i < defending.retreat.length; i++) {
          // Add that many energies to the retreat cost
          effect.cost.push(defending.retreat[i]);
        }
      }
      return state;
    }

    // Card types
    if (effect instanceof CheckPokemonTypeEffect && effect.target.pokemons.cards.includes(this)) {
      const defending = getTransformedPokemonCard(this, store, state, effect.target);
      if (!defending) {
        return state;
      }
      effect.cardTypes = defending.cardTypes.slice();
      return state;
    }

    // Weakness and Resistance
    if (effect instanceof CheckPokemonStatsEffect && effect.target.pokemons.cards.includes(this)) {
      const defending = getTransformedPokemonCard(this, store, state, effect.target);
      if (!defending) {
        return state;
      }
      effect.resistance = defending.resistance.map(r => ({ type: r.type, value: r.value }));
      effect.weakness = defending.weakness.map(r => ({ type: r.type, value: r.value }));
      return state;
    }

    // Transform attached Energies to Rainbow
    if (effect instanceof AfterCheckProvidedEnergyEffect && effect.source.pokemons.cards.includes(this)) {
      const defending = getTransformedPokemonCard(this, store, state, effect.source);
      if (!defending) {
        return state;
      }
      effect.energyMap.forEach(item => {
        item.provides = StateUtils.rainbowEnergy();
      });
    }

    // Allow to copy Attacks and Powers
    if (effect instanceof PowerEffect && effect.power === this.powers[0]) {
      const player = effect.player;

      const pokemonCard = getTransformedPokemonCard(this, store, state, effect.player.active);
      if (pokemonCard === undefined) {
        throw new GameError(GameMessage.CANNOT_USE_POWER);
      }

      return store.prompt(
        state,
        new ChooseAttackPrompt(player.id, GameMessage.CHOOSE_ATTACK_TO_COPY, [pokemonCard], {
          allowCancel: true,
          enableAbility: { useWhenInPlay: true }
        }),
        result => {
          if (result === null) {
            return;
          }
          if (pokemonCard.attacks.includes(result as Attack)) {
            const attack = result as Attack;
            const attackEffect = new UseAttackEffect(player, attack);
            store.reduceEffect(state, attackEffect);
          }
          if (pokemonCard.powers.includes(result as Power)) {
            const power = result as Power;
            const powerEffect = new UsePowerEffect(player, power, this);
            store.reduceEffect(state, powerEffect);
          }
        }
      );
    }

    // Copy passive Pokemon Powers.
    //
    // Every card in the game sees every effect, so the card Ditto is copying is already
    // being asked about this one - it just does not recognise Ditto's slot as its own.
    // Standing it in Ditto's slot for the length of the call makes its own
    // `cards.includes(this)` / `getPokemonCard() === this` guards resolve the way the
    // card text says they should ("treat it as if it were the same card").
    return this.delegateToCopiedCard(store, state, effect);
  }

  private delegating: boolean = false;

  private delegateToCopiedCard(store: StoreLike, state: State, effect: Effect): State {
    if (this.delegating) {
      return state;
    }
    this.delegating = true;
    try {
      for (const player of state.players) {
        const slot = player.active;
        const index = slot.pokemons.cards.indexOf(this);
        if (index === -1) {
          continue;
        }

        // Only effects aimed at Ditto's own slot. An effect a card recognises some other
        // way - an attack it owns, a Power it owns - already reaches the copied card
        // where it really stands, and forwarding it here would apply it a second time.
        // Ditto always copies the Defending Pokemon, so that card is always in play.
        const aimedHere = (effect as { target?: unknown }).target === slot
          || (effect as { source?: unknown }).source === slot;
        if (!aimedHere) {
          continue;
        }

        const copied = getTransformedPokemonCard(this, store, state, slot);
        if (copied === undefined) {
          continue;
        }

        // Swap rather than insert: the slot keeps exactly one top card, so nothing else
        // walking the board sees a Pokemon that is not there.
        slot.pokemons.cards[index] = copied;
        try {
          state = copied.reduceEffect(store, state, effect);
        } finally {
          slot.pokemons.cards[index] = this;
        }
      }
    } finally {
      this.delegating = false;
    }
    return state;
  }
}

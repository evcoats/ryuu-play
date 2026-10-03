import {
  AttackEffect,
  CardTarget,
  CardType,
  ChoosePokemonPrompt,
  Effect,
  GameMessage,
  PlayerType,
  PokemonCard,
  PokemonSlot,
  SlotType,
  Stage,
  State,
  StateUtils,
  StoreLike,
} from '@ptcg/common';

function* useDevolutionBeam(next: Function, store: StoreLike, state: State, effect: AttackEffect): IterableIterator<State> {
  const player = effect.player;

  // Only Pokemon with an Evolution card on top of them can be devolved
  const blocked: CardTarget[] = [];
  let hasEvolvedPokemon: boolean = false;
  const collect = (pokemonSlot: PokemonSlot, card: PokemonCard, target: CardTarget) => {
    if (pokemonSlot.getPokemons().length <= 1) {
      blocked.push(target);
    } else {
      hasEvolvedPokemon = true;
    }
  };
  player.forEachPokemon(PlayerType.BOTTOM_PLAYER, collect);
  StateUtils.getOpponent(state, player).forEachPokemon(PlayerType.TOP_PLAYER, collect);

  if (hasEvolvedPokemon === false) {
    return state;
  }

  let targets: PokemonSlot[] = [];
  yield store.prompt(
    state,
    new ChoosePokemonPrompt(
      player.id,
      GameMessage.CHOOSE_POKEMON_TO_PICK_UP,
      PlayerType.ANY,
      [SlotType.ACTIVE, SlotType.BENCH],
      { allowCancel: false, min: 1, max: 1, blocked }
    ),
    results => {
      targets = results || [];
      next();
    }
  );

  if (targets.length === 0) {
    return state;
  }

  const pokemonSlot = targets[0];
  const pokemons = pokemonSlot.getPokemons();
  if (pokemons.length <= 1) {
    return state;
  }

  // Return the highest Stage Evolution card to its own player's hand
  const owner = StateUtils.findOwner(state, pokemonSlot);
  const topCard = pokemons[pokemons.length - 1];
  pokemonSlot.pokemons.moveCardTo(topCard, owner.hand);

  // "just as if you had evolved it" - all conditions and attack effects go away
  pokemonSlot.clearEffects();

  return state;
}

export class Mew extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public cardTypes: CardType[] = [CardType.PSYCHIC];

  public hp: number = 50;

  public attacks = [
    {
      name: 'Psywave',
      cost: [CardType.PSYCHIC],
      damage: '10×',
      text: 'Does 10 damage times the number of Energy cards attached to the Defending Pokémon.'
    },
    {
      name: 'Devolution Beam',
      cost: [CardType.PSYCHIC, CardType.PSYCHIC],
      damage: '',
      text:
        'Choose an evolved Pokémon (your own or your opponent\'s). Return the highest Stage Evolution card on ' +
        'that Pokémon to its player\'s hand. That Pokémon is no longer Asleep, Confused, Paralyzed, or Poisoned, ' +
        'or anything else that might be the result of an attack (just as if you had evolved it).'
    },
  ];

  public weakness = [
    { type: CardType.PSYCHIC }
  ];

  public retreat = [CardType.COLORLESS];

  public set: string = 'PR';

  public name: string = 'Mew';

  public fullName: string = 'Mew PR';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof AttackEffect && effect.attack === this.attacks[0]) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);
      effect.damage = opponent.active.energies.cards.length * 10;
      return state;
    }

    if (effect instanceof AttackEffect && effect.attack === this.attacks[1]) {
      const generator = useDevolutionBeam(() => generator.next(), store, state, effect);
      return generator.next().value;
    }

    return state;
  }
}

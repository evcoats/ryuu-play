import {
  AttackEffect,
  CardType,
  CoinFlipPrompt,
  Effect,
  EnergyCard,
  EnergyType,
  GameMessage,
  MoveEnergyPrompt,
  PlayerType,
  PokemonCard,
  PokemonSlot,
  SlotType,
  Stage,
  State,
  StateUtils,
  StoreLike,
  SuperType,
} from '@ptcg/common';

import { commonAttacks } from '../../common';

function* useEnergyControl(next: Function, store: StoreLike, state: State, effect: AttackEffect): IterableIterator<State> {
  const player = effect.player;
  const opponent = StateUtils.getOpponent(state, player);

  let heads = false;
  yield store.prompt(state, new CoinFlipPrompt(player.id, GameMessage.COIN_FLIP), result => {
    heads = result;
    next();
  });

  if (!heads) {
    return state;
  }

  const slots: PokemonSlot[] = [ opponent.active, ...opponent.bench ].filter(s => s.pokemons.cards.length > 0);
  const hasBasicEnergy = slots.some(s => s.energies.cards.some(e => e.energyType === EnergyType.BASIC));
  if (slots.length < 2 || !hasBasicEnergy) {
    return state;
  }

  return store.prompt(
    state,
    new MoveEnergyPrompt(
      player.id,
      GameMessage.MOVE_ENERGY_CARDS,
      PlayerType.TOP_PLAYER,
      [SlotType.ACTIVE, SlotType.BENCH],
      { superType: SuperType.ENERGY, energyType: EnergyType.BASIC },
      { allowCancel: false, min: 1, max: 1 }
    ),
    transfers => {
      // MoveEnergyPrompt.validate does not police max, source/target ownership or
      // from !== to, so the card does it: one basic Energy card, opponent's Pokemon
      // to another of the opponent's Pokemon.
      for (const transfer of (transfers || []).slice(0, 1)) {
        const source = StateUtils.getTarget(state, player, transfer.from);
        const target = StateUtils.getTarget(state, player, transfer.to);
        const card = transfer.card as EnergyCard;
        if (source === target
          || !slots.includes(source)
          || !slots.includes(target)
          || !source.energies.cards.includes(card)
          || card.energyType !== EnergyType.BASIC) {
          continue;
        }
        source.moveCardTo(card, target.energies);
      }
    }
  );
}

// Wizards Black Star Promo #12.
export class MewtwoPR12 extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public cardTypes: CardType[] = [CardType.PSYCHIC];

  public hp: number = 60;

  public attacks = [
    {
      name: 'Energy Control',
      cost: [CardType.PSYCHIC],
      damage: '',
      text:
        'Flip a coin. If heads, choose a basic Energy card attached to 1 of your opponent\'s Pokémon and attach it ' +
        'to another of your opponent\'s Pokémon of your choice.'
    },
    {
      name: 'Telekinesis',
      cost: [CardType.PSYCHIC, CardType.PSYCHIC, CardType.PSYCHIC],
      damage: '',
      text:
        'Choose 1 of your opponent\'s Pokémon. This attack does 30 damage to that Pokémon. Don\'t apply Weakness ' +
        'and Resistance for this attack. (Any other effects that would happen after applying Weakness and ' +
        'Resistance still happen.)'
    },
  ];

  public weakness = [
    { type: CardType.PSYCHIC }
  ];

  public retreat = [CardType.COLORLESS, CardType.COLORLESS];

  public set: string = 'PR';

  public name: string = 'Mewtwo';

  public fullName: string = 'Mewtwo PR12';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof AttackEffect && effect.attack === this.attacks[0]) {
      const generator = useEnergyControl(() => generator.next(), store, state, effect);
      return generator.next().value;
    }

    if (effect instanceof AttackEffect && effect.attack === this.attacks[1]) {
      // W/R off for the whole attack; effects after W/R (PlusPower on the Defending
      // Pokemon, Defender, ...) still apply because they act on PutDamageEffect.
      effect.ignoreWeakness = true;
      effect.ignoreResistance = true;
      effect.damage = 0;
      const damageOpponentPokemon = commonAttacks.damageOpponentPokemon(this, store, state, effect);
      return damageOpponentPokemon.use(effect, 30, [SlotType.ACTIVE, SlotType.BENCH], { min: 1, max: 1 });
    }

    return state;
  }
}

import {
  AttackEffect,
  CardType,
  Effect,
  GamePhase,
  PokemonCard,
  PutDamageEffect,
  SpecialCondition,
  Stage,
  State,
  StateUtils,
  StoreLike,
} from '@ptcg/common';

import { commonAttacks, commonMarkers } from '../../common';

// Wizards Black Star Promo #1.
export class PikachuPR1 extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public cardTypes: CardType[] = [CardType.LIGHTNING];

  public hp: number = 60;

  public attacks = [
    {
      name: 'Growl',
      cost: [CardType.COLORLESS],
      damage: '',
      text:
        'If the Defending Pokémon attacks Pikachu during your opponent\'s next turn, any damage done by the attack ' +
        'is reduced by 10 (after applying Weakness and Resistance). (Benching either Pokémon ends this effect.)'
    },
    {
      name: 'Thundershock',
      cost: [CardType.LIGHTNING, CardType.LIGHTNING],
      damage: '20',
      text: 'Flip a coin. If heads, the Defending Pokémon is now Paralyzed.'
    },
  ];

  public weakness = [
    { type: CardType.FIGHTING }
  ];

  public retreat = [CardType.COLORLESS];

  public set: string = 'PR';

  public name: string = 'Pikachu';

  public fullName: string = 'Pikachu PR1';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Same mechanism as Persian JU's Pounce: both Pokemon carry the marker, and
    // benching (switchPokemon -> clearEffects) or evolving either one removes it.
    const opponentNextTurn = commonMarkers.duringOpponentNextTurn(this, store, state, effect);

    if (effect instanceof AttackEffect && effect.attack === this.attacks[0]) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);
      opponentNextTurn.setMarker(effect, player.active);
      opponentNextTurn.setMarker(effect, opponent.active);
      return state;
    }

    if (effect instanceof PutDamageEffect
      && opponentNextTurn.hasMarker(effect, effect.source)
      && opponentNextTurn.hasMarker(effect, effect.target)
      && effect.target.pokemons.cards.includes(this)
      && state.phase === GamePhase.ATTACK) {
      effect.damage = Math.max(0, effect.damage - 10);
      return state;
    }

    if (effect instanceof AttackEffect && effect.attack === this.attacks[1]) {
      const flipSpecialConditions = commonAttacks.flipSpecialConditions(this, store, state, effect);
      return flipSpecialConditions.use(effect, [SpecialCondition.PARALYZED]);
    }

    return state;
  }
}

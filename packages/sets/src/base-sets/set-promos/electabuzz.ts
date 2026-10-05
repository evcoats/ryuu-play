import {
  AttackEffect,
  CardType,
  CoinFlipPrompt,
  Effect,
  GameMessage,
  GamePhase,
  PokemonCard,
  PutDamageEffect,
  Stage,
  State,
  StateUtils,
  StoreLike,
} from '@ptcg/common';

import { commonMarkers } from '../../common';

// Wizards Black Star Promo #2.
export class ElectabuzzPR2 extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public cardTypes: CardType[] = [CardType.LIGHTNING];

  public hp: number = 60;

  public attacks = [
    {
      name: 'Light Screen',
      cost: [CardType.LIGHTNING],
      damage: '',
      text:
        'Whenever an attack does damage to Electabuzz (after applying Weakness and Resistance) during your ' +
        'opponent\'s next turn, that attack only does half the damage to Electabuzz (rounded down to the nearest ' +
        '10). (Any other effects of attacks still happen.)'
    },
    {
      name: 'Quick Attack',
      cost: [CardType.COLORLESS, CardType.COLORLESS],
      damage: '10+',
      text:
        'Flip a coin. If heads, this attack does 10 damage plus 20 more damage; if tails, this attack does 10 ' +
        'damage.'
    },
  ];

  public weakness = [
    { type: CardType.FIGHTING }
  ];

  public retreat = [CardType.COLORLESS, CardType.COLORLESS];

  public set: string = 'PR';

  public name: string = 'Electabuzz';

  public fullName: string = 'Electabuzz PR2';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // The marker sits on Electabuzz's slot only (any attacker is affected). It is
    // removed at the end of the opponent's next turn, or earlier by clearEffects
    // when Electabuzz is benched or evolves - Base-era rule that effects of attacks
    // on a Pokemon end when it leaves the Active spot.
    const opponentNextTurn = commonMarkers.duringOpponentNextTurn(this, store, state, effect);

    if (effect instanceof AttackEffect && effect.attack === this.attacks[0]) {
      opponentNextTurn.setMarker(effect, effect.player.active);
      return state;
    }

    if (effect instanceof PutDamageEffect
      && opponentNextTurn.hasMarker(effect, effect.target)
      && effect.target.pokemons.cards.includes(this)
      && StateUtils.findOwner(state, effect.target) !== effect.player
      && state.phase === GamePhase.ATTACK) {
      // Half, rounded down to the nearest 10 (same arithmetic as Kabuto Armor)
      effect.damage = Math.floor(effect.damage / 20) * 10;
      return state;
    }

    if (effect instanceof AttackEffect && effect.attack === this.attacks[1]) {
      const player = effect.player;
      return store.prompt(state, new CoinFlipPrompt(player.id, GameMessage.COIN_FLIP), result => {
        if (result === true) {
          effect.damage += 20;
        }
      });
    }

    return state;
  }
}

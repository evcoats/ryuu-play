import {
  AttackEffect,
  CardType,
  DealDamageEffect,
  Effect,
  HealTargetEffect,
  PokemonCard,
  Stage,
  State,
  StoreLike,
} from '@ptcg/common';

// Wizards Black Star Promo #7.
export class JigglypuffPR7 extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public cardTypes: CardType[] = [CardType.COLORLESS];

  public hp: number = 50;

  public attacks = [
    {
      name: 'First Aid',
      cost: [CardType.COLORLESS],
      damage: '',
      text: 'Remove 1 damage counter from Jigglypuff.'
    },
    {
      name: 'Double-edge',
      cost: [CardType.COLORLESS, CardType.COLORLESS, CardType.COLORLESS],
      damage: '40',
      text: 'Jigglypuff does 20 damage to itself.'
    },
  ];

  public weakness = [
    { type: CardType.FIGHTING }
  ];

  public resistance = [
    { type: CardType.PSYCHIC, value: -30 }
  ];

  public retreat = [CardType.COLORLESS];

  public set: string = 'PR';

  public name: string = 'Jigglypuff';

  public fullName: string = 'Jigglypuff PR7';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof AttackEffect && effect.attack === this.attacks[0]) {
      const player = effect.player;
      const healEffect = new HealTargetEffect(effect, 10);
      healEffect.target = player.active;
      return store.reduceEffect(state, healEffect);
    }

    // Self damage as Arcanine BS Take Down / Raichu BS Thunder
    if (effect instanceof AttackEffect && effect.attack === this.attacks[1]) {
      const player = effect.player;
      const dealDamage = new DealDamageEffect(effect, 20);
      dealDamage.target = player.active;
      return store.reduceEffect(state, dealDamage);
    }

    return state;
  }
}

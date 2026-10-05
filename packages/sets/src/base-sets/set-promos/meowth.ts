import {
  AttackEffect,
  CardType,
  ChoosePokemonPrompt,
  CoinFlipPrompt,
  Effect,
  GameMessage,
  PlayerType,
  PokemonCard,
  PokemonSlot,
  PutDamageEffect,
  SlotType,
  Stage,
  State,
  StateUtils,
  StoreLike,
} from '@ptcg/common';

function* useCatPunch(next: Function, store: StoreLike, state: State, effect: AttackEffect): IterableIterator<State> {
  const player = effect.player;
  const opponent = StateUtils.getOpponent(state, player);

  // Printed damage is blank: nothing happens to the Defending Pokemon unless heads
  effect.damage = 0;

  let heads = false;
  yield store.prompt(state, new CoinFlipPrompt(player.id, GameMessage.COIN_FLIP), result => {
    heads = result;
    next();
  });

  if (heads) {
    effect.damage = 20;
    return state;
  }

  const hasBench = opponent.bench.some(b => b.pokemons.cards.length > 0);
  if (!hasBench) {
    return state;
  }

  // "he or she chooses 1 of them" - the opponent makes the choice
  return store.prompt(
    state,
    new ChoosePokemonPrompt(
      opponent.id,
      GameMessage.CHOOSE_POKEMON_TO_DAMAGE,
      PlayerType.BOTTOM_PLAYER,
      [SlotType.BENCH],
      { allowCancel: false, min: 1, max: 1 }
    ),
    selected => {
      const targets: PokemonSlot[] = (selected || [])
        .filter(t => opponent.bench.includes(t) && t.pokemons.cards.length > 0);
      if (targets.length === 0) {
        return;
      }
      // Bench damage: no Weakness or Resistance
      const damageEffect = new PutDamageEffect(effect, 20);
      damageEffect.target = targets[0];
      store.reduceEffect(state, damageEffect);
    }
  );
}

// Wizards Black Star Promo #10.
export class MeowthPR10 extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public cardTypes: CardType[] = [CardType.COLORLESS];

  public hp: number = 50;

  public attacks = [
    {
      name: 'Cat Punch',
      cost: [CardType.COLORLESS, CardType.COLORLESS],
      damage: '',
      text:
        'Flip a coin. If heads, this attack does 20 damage. If tails and if your opponent has any Benched ' +
        'Pokémon, he or she chooses 1 of them and this attack does 20 damage to it. (Don\'t apply Weakness and ' +
        'Resistance for Benched Pokémon.)'
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

  public name: string = 'Meowth';

  public fullName: string = 'Meowth PR10';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof AttackEffect && effect.attack === this.attacks[0]) {
      const generator = useCatPunch(() => generator.next(), store, state, effect);
      return generator.next().value;
    }

    return state;
  }
}

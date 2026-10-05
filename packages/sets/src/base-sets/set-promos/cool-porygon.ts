import {
  AttackEffect,
  CardType,
  CheckPokemonStatsEffect,
  Effect,
  GameLog,
  GameMessage,
  PokemonCard,
  PokemonSlot,
  SelectPrompt,
  Stage,
  State,
  StateUtils,
  StoreLike,
} from '@ptcg/common';

import { changeType, commonAttacks } from '../../common';

// Each marker lives on its own Pokemon's slot, so "benching either Pokemon ends
// the effect on that Pokemon" falls out of clearEffects on switch/evolve: benching
// Cool Porygon drops its Resistance change and leaves the Defending Pokemon's
// Weakness change in place, and vice versa. There is no turn limit.
const TEXTURE_WEAKNESS_MARKER = 'TEXTURE_WEAKNESS_MARKER_';
const TEXTURE_RESISTANCE_MARKER = 'TEXTURE_RESISTANCE_MARKER_';

function* useTextureMagic(
  next: Function,
  store: StoreLike,
  state: State,
  self: CoolPorygonPR15,
  effect: AttackEffect
): IterableIterator<State> {
  const player = effect.player;
  const opponent = StateUtils.getOpponent(state, player);
  const attacking: PokemonSlot = player.active;
  const defending: PokemonSlot = opponent.active;

  const choose = function* (marker: string, slot: PokemonSlot): IterableIterator<State> {
    // "You may" - cancelling keeps the printed type
    let choice: number | null = null;
    yield store.prompt(
      state,
      new SelectPrompt(
        player.id,
        GameMessage.CHOOSE_CARD_TYPE,
        changeType.PROMPT_OPTIONS.map(p => p.message),
        { allowCancel: true }
      ),
      result => {
        choice = result;
        next();
      }
    );
    if (choice === null || changeType.PROMPT_OPTIONS[choice] === undefined) {
      return state;
    }
    const option = changeType.PROMPT_OPTIONS[choice];
    store.log(state, GameLog.LOG_PLAYER_CHANGES_TYPE_TO, { name: player.name, message: option.message });
    changeType.removeMarkersByName(marker, slot);
    slot.marker.addMarker(marker + option.value, self);
    return state;
  };

  // Cool Porygon's own Resistance (the attacker - Cool Porygon, or a Ditto copying it)
  const attackerStats = new CheckPokemonStatsEffect(attacking);
  store.reduceEffect(state, attackerStats);
  if (attackerStats.resistance.length > 0) {
    yield* choose(TEXTURE_RESISTANCE_MARKER, attacking);
  }

  // "If the Defending Pokemon has a Weakness"
  const defenderStats = new CheckPokemonStatsEffect(defending);
  store.reduceEffect(state, defenderStats);
  if (defenderStats.weakness.length > 0) {
    yield* choose(TEXTURE_WEAKNESS_MARKER, defending);
  }

  return state;
}

// Wizards Black Star Promo #15.
export class CoolPorygonPR15 extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public cardTypes: CardType[] = [CardType.COLORLESS];

  public hp: number = 50;

  public attacks = [
    {
      name: 'Texture Magic',
      cost: [CardType.COLORLESS, CardType.COLORLESS, CardType.COLORLESS],
      damage: '',
      text:
        'You may change Cool Porygon\'s Resistance to a type of your choice other than Colorless. If the Defending ' +
        'Pokémon has a Weakness, you may change it to a type of your choice other than Colorless. (Benching either ' +
        'Pokémon ends the effect on that Pokémon.)'
    },
    {
      name: '3-D Attack',
      cost: [CardType.COLORLESS, CardType.COLORLESS, CardType.COLORLESS],
      damage: '20×',
      text: 'Flip 3 coins. This attack does 20 damage times the number of heads.'
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

  public name: string = 'Cool Porygon';

  public fullName: string = 'Cool Porygon PR15';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof CheckPokemonStatsEffect) {
      const weakness = changeType.getMarkerType(this, TEXTURE_WEAKNESS_MARKER, effect.target);
      const resistance = changeType.getMarkerType(this, TEXTURE_RESISTANCE_MARKER, effect.target);
      if (weakness) {
        effect.weakness = effect.weakness.map(w => ({ type: weakness, value: w.value }));
      }
      if (resistance) {
        effect.resistance = effect.resistance.map(r => ({ type: resistance, value: r.value }));
      }
      return state;
    }

    if (effect instanceof AttackEffect && effect.attack === this.attacks[0]) {
      const generator = useTextureMagic(() => generator.next(), store, state, this, effect);
      return generator.next().value;
    }

    if (effect instanceof AttackEffect && effect.attack === this.attacks[1]) {
      const flipDamageTimes = commonAttacks.flipDamageTimes(this, store, state, effect);
      return flipDamageTimes.use(effect, 3, 20);
    }

    return state;
  }
}

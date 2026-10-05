import {
  AfterDamageEffect,
  CardType,
  Effect,
  GameError,
  GameMessage,
  HealTargetEffect,
  PokemonCard,
  PokemonSlot,
  PowerEffect,
  PowerType,
  SpecialCondition,
  Stage,
  State,
  StateUtils,
  StoreLike,
} from '@ptcg/common';

import { commonMarkers } from '../../common';

const SOLAR_POWER_CONDITIONS = [
  SpecialCondition.ASLEEP,
  SpecialCondition.CONFUSED,
  SpecialCondition.PARALYZED,
  SpecialCondition.POISONED,
];

function hasSolarPowerCondition(slot: PokemonSlot): boolean {
  return slot.specialConditions.some(sp => SOLAR_POWER_CONDITIONS.includes(sp));
}

// Wizards Black Star Promo #13.
export class VenusaurPR13 extends PokemonCard {
  public stage: Stage = Stage.STAGE_2;

  public evolvesFrom = 'Ivysaur';

  public cardTypes: CardType[] = [CardType.GRASS];

  public hp: number = 100;

  public powers = [
    {
      name: 'Solar Power',
      powerType: PowerType.POKEPOWER,
      useWhenInPlay: true,
      text:
        'Once during your turn (before your attack), you may use this power. Your Active Pokémon and the ' +
        'Defending Pokémon are no longer Asleep, Confused, Paralyzed, or Poisoned. This power can\'t be used if ' +
        'Venusaur is Asleep, Confused, or Paralyzed.'
    },
  ];

  public attacks = [
    {
      name: 'Mega Drain',
      cost: [CardType.GRASS, CardType.GRASS, CardType.GRASS, CardType.GRASS],
      damage: '40',
      text:
        'Remove a number of damage counters from Venusaur equal to half the damage done to the Defending Pokémon ' +
        '(after applying Weakness and Resistance) (rounded up to the nearest 10). If Venusaur has fewer damage ' +
        'counters than that, remove all of them.'
    },
  ];

  public weakness = [
    { type: CardType.FIRE }
  ];

  public retreat = [CardType.COLORLESS, CardType.COLORLESS];

  public set: string = 'PR';

  public name: string = 'Venusaur';

  public fullName: string = 'Venusaur PR13';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    const powerUseOnce = commonMarkers.powerUseOnce(this, store, state, effect);

    if (effect instanceof PowerEffect && effect.power === this.powers[0]) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);
      const pokemonSlot = StateUtils.findPokemonSlot(state, this);

      if (pokemonSlot === undefined
        || pokemonSlot.getPokemonCard() !== this
        || pokemonSlot.specialConditions.includes(SpecialCondition.ASLEEP)
        || pokemonSlot.specialConditions.includes(SpecialCondition.CONFUSED)
        || pokemonSlot.specialConditions.includes(SpecialCondition.PARALYZED)) {
        throw new GameError(GameMessage.CANNOT_USE_POWER);
      }

      if (powerUseOnce.hasMarker(effect)) {
        throw new GameError(GameMessage.POWER_ALREADY_USED);
      }

      // Using it with nothing to cure changes nothing, so it is refused (as Vileplume
      // JU's Heal is refused with nothing to heal) to keep the action space honest.
      if (!hasSolarPowerCondition(player.active) && !hasSolarPowerCondition(opponent.active)) {
        throw new GameError(GameMessage.CANNOT_USE_POWER);
      }

      powerUseOnce.setMarker(effect);
      for (const slot of [ player.active, opponent.active ]) {
        for (const sp of SOLAR_POWER_CONDITIONS) {
          slot.removeSpecialCondition(sp);
        }
      }
      return state;
    }

    // As Butterfree JU's Mega Drain; only damage to the Defending Pokemon counts
    if (effect instanceof AfterDamageEffect
      && effect.attack === this.attacks[0]
      && effect.target === effect.opponent.active) {
      const player = effect.player;
      const heal = Math.ceil(effect.damage / 20) * 10;
      const healEffect = new HealTargetEffect(effect.attackEffect, heal);
      healEffect.target = player.active;
      store.reduceEffect(state, healEffect);
    }

    return state;
  }
}

import {
  AttackEffect,
  CardType,
  CheckHpEffect,
  CheckTableStateEffect,
  Effect,
  Player,
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

import { commonAttacks } from '../../common';
import { Ditto } from './ditto';

export class Omanyte extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;

  public evolvesFrom = 'Mysterious Fossil';

  public cardTypes: CardType[] = [CardType.WATER];

  public hp: number = 40;

  // Clairvoyance is always on, not used: no useWhenInPlay (it was an activated power that showed
  // the opponent's hand once per use).
  public powers = [
    {
      name: 'Clairvoyance',
      powerType: PowerType.POKEPOWER,
      text:
        'Your opponent plays with his or her hand face up. This power stops working while Omanyte is Asleep, ' +
        'Confused, or Paralyzed.'
    },
  ];

  public attacks = [
    {
      name: 'Water Gun',
      cost: [CardType.WATER],
      damage: '10+',
      text:
        'Does 10 damage plus 10 more damage for each W Energy attached to Omanyte but not used to pay for this ' +
        'attack\'s Energy cost. You can\'t add more than 20 damage in this way.'
    },
  ];

  public weakness = [
    { type: CardType.GRASS }
  ];

  public retreat = [CardType.COLORLESS];

  public set: string = 'FO';

  public name: string = 'Omanyte';

  public fullName: string = 'Omanyte FO';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    const additionalEnergyDamage = commonAttacks.additionalEnergyDamage(this, store, state, effect);

    // A face-up hand is hand.isPublic (read by the server's state sanitizer and the play client).
    // The table check runs after every action, and every Omanyte FO card gets it wherever it is,
    // so the first one to see it sets both hands from the whole board: a hand turns back down as
    // soon as no working Omanyte is left in play (Fossil FAQ: only while Omanyte is in play, and
    // cards drawn meanwhile are face up too).
    if (effect instanceof CheckTableStateEffect) {
      if (tableChecked.has(effect)) {
        return state;
      }
      tableChecked.add(effect);
      for (const player of state.players) {
        const slots = [player.active, ...player.bench];
        const faceUp = slots.some(slot => clairvoyanceWorks(store, state, player, slot));
        StateUtils.getOpponent(state, player).hand.isPublic = faceUp;
      }
      return state;
    }

    if (effect instanceof AttackEffect && effect.attack === this.attacks[0]) {
      return additionalEnergyDamage.use(effect, CardType.WATER, 10, 2);
    }

    return state;
  }
}

// Table checks already handled by another Omanyte FO card.
const tableChecked = new WeakSet<Effect>();

function clairvoyanceWorks(store: StoreLike, state: State, player: Player, slot: PokemonSlot): boolean {
  const card = slot.getPokemonCard();
  // An Active Ditto FO copies the Defending Pokemon's Powers too (Fossil FAQ, under TRANSFORM).
  const defending = StateUtils.getOpponent(state, player).active.getPokemonCard();
  const omanyte = card instanceof Ditto && slot === player.active && defending instanceof Omanyte ? defending : card;
  if (!(omanyte instanceof Omanyte)
    || slot.specialConditions.includes(SpecialCondition.ASLEEP)
    || slot.specialConditions.includes(SpecialCondition.CONFUSED)
    || slot.specialConditions.includes(SpecialCondition.PARALYZED)) {
    return false;
  }
  // The table check runs before Knocked Out Pokemon are discarded, and a Knocked Out Omanyte has left play.
  if (slot.damage > 0) {
    const checkHp = new CheckHpEffect(player, slot);
    store.reduceEffect(state, checkHp);
    if (slot.damage >= checkHp.hp) {
      return false;
    }
  }
  // Try to reduce PowerEffect, to check if something is blocking our ability (Muk's Toxic Gas)
  try {
    store.reduceEffect(state, new PowerEffect(player, omanyte.powers[0], card!));
  } catch {
    return false;
  }
  return true;
}

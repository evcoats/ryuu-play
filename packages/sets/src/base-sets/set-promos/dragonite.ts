import {
  AttackEffect,
  Card,
  CardType,
  ChooseCardsPrompt,
  CoinFlipPrompt,
  Effect,
  GameError,
  GameMessage,
  PokemonCard,
  PowerEffect,
  PowerType,
  SpecialCondition,
  Stage,
  State,
  StateUtils,
  StoreLike,
} from '@ptcg/common';

import { commonMarkers } from '../../common';

// Wizards Black Star Promo #5.
export class DragonitePR5 extends PokemonCard {
  public stage: Stage = Stage.STAGE_2;

  public evolvesFrom = 'Dragonair';

  public cardTypes: CardType[] = [CardType.COLORLESS];

  public hp: number = 90;

  public powers = [
    {
      name: 'Special Delivery',
      powerType: PowerType.POKEPOWER,
      useWhenInPlay: true,
      text:
        'Once during your turn (before your attack), you may draw a card. If you do, choose a card from your hand ' +
        'and put it on top of your deck. This power can\'t be used if Dragonite is Asleep, Confused, or Paralyzed.'
    },
  ];

  public attacks = [
    {
      name: 'Supersonic Flight',
      cost: [CardType.COLORLESS, CardType.COLORLESS, CardType.COLORLESS],
      damage: '60',
      text: 'Flip a coin. If tails, this attack does nothing.'
    },
  ];

  public resistance = [
    { type: CardType.FIGHTING, value: -30 }
  ];

  public retreat = [CardType.COLORLESS, CardType.COLORLESS];

  public set: string = 'PR';

  public name: string = 'Dragonite';

  public fullName: string = 'Dragonite PR5';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Once per turn per Dragonite (the marker is keyed to this card), reset at the
    // end of the turn and when the card is played again.
    const powerUseOnce = commonMarkers.powerUseOnce(this, store, state, effect);

    if (effect instanceof PowerEffect && effect.power === this.powers[0]) {
      const player = effect.player;
      const pokemonSlot = StateUtils.findPokemonSlot(state, this);

      if (pokemonSlot === undefined
        || pokemonSlot.getPokemonCard() !== this
        || pokemonSlot.specialConditions.includes(SpecialCondition.ASLEEP)
        || pokemonSlot.specialConditions.includes(SpecialCondition.CONFUSED)
        || pokemonSlot.specialConditions.includes(SpecialCondition.PARALYZED)) {
        throw new GameError(GameMessage.CANNOT_USE_POWER);
      }

      // "If you do" - with an empty deck there is nothing to draw, so nothing happens
      if (player.deck.cards.length === 0) {
        throw new GameError(GameMessage.CANNOT_USE_POWER);
      }

      if (powerUseOnce.hasMarker(effect)) {
        throw new GameError(GameMessage.POWER_ALREADY_USED);
      }

      powerUseOnce.setMarker(effect);
      player.deck.moveTo(player.hand, 1);

      // Any card from the hand, including the one just drawn; not optional
      return store.prompt(
        state,
        new ChooseCardsPrompt(
          player.id,
          GameMessage.CHOOSE_CARD_TO_DECK,
          player.hand,
          {},
          { min: 1, max: 1, allowCancel: false }
        ),
        selected => {
          let cards: Card[] = (selected || []).filter(c => player.hand.cards.includes(c));
          if (cards.length === 0 && player.hand.cards.length > 0) {
            // A card must go back; fall back to the last card in hand (the one drawn)
            cards = [ player.hand.cards[player.hand.cards.length - 1] ];
          }
          player.hand.moveCardsToTop(cards.slice(0, 1), player.deck);
        }
      );
    }

    if (effect instanceof AttackEffect && effect.attack === this.attacks[0]) {
      const player = effect.player;
      return store.prompt(state, new CoinFlipPrompt(player.id, GameMessage.COIN_FLIP), result => {
        if (result === false) {
          effect.damage = 0;
        }
      });
    }

    return state;
  }
}

import {
  AttachEnergyPrompt,
  AttackEffect,
  CardType,
  Effect,
  EnergyCard,
  GameLog,
  GameMessage,
  PlayerType,
  PokemonCard,
  SlotType,
  Stage,
  State,
  StoreLike,
  SuperType,
} from '@ptcg/common';

export class Mewtwo extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public cardTypes: CardType[] = [CardType.PSYCHIC];

  public hp: number = 70;

  public attacks = [
    {
      name: 'Energy Absorption',
      cost: [CardType.PSYCHIC],
      damage: '',
      text: 'Choose up to 2 Energy cards from your discard pile and attach them to Mewtwo.'
    },
    {
      name: 'Psyburn',
      cost: [CardType.PSYCHIC, CardType.PSYCHIC, CardType.COLORLESS],
      damage: '40',
      text: ''
    },
  ];

  public weakness = [
    { type: CardType.PSYCHIC }
  ];

  public retreat = [CardType.COLORLESS, CardType.COLORLESS];

  public set: string = 'PR';

  public name: string = 'Mewtwo';

  public fullName: string = 'Mewtwo PR';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof AttackEffect && effect.attack === this.attacks[0]) {
      const player = effect.player;

      const hasEnergyInDiscard = player.discard.cards.some(c => c instanceof EnergyCard);
      if (!hasEnergyInDiscard) {
        return state;
      }

      return store.prompt(
        state,
        new AttachEnergyPrompt(
          player.id,
          GameMessage.ATTACH_ENERGY_TO_ACTIVE,
          player.discard,
          PlayerType.BOTTOM_PLAYER,
          [SlotType.ACTIVE],
          { superType: SuperType.ENERGY },
          { allowCancel: false, min: 0, max: 2, sameTarget: true }
        ),
        transfers => {
          transfers = transfers || [];

          // "attach them to Mewtwo" means the Pokemon that used the attack, which is
          // always the Active one - and is not necessarily this card: a Ditto copying
          // Energy Absorption is Mewtwo for as long as it is Transformed.
          // AttachEnergyPrompt.validate does not police its own slot list, so do it here.
          const slot = player.active;
          if (slot.pokemons.cards.length === 0) {
            return;
          }

          for (const transfer of transfers) {
            const energyCard = transfer.card as EnergyCard;

            // Moved straight out of the discard pile. This is deliberately NOT an
            // AttachEnergyEffect: Rainbow Energy's 10 damage and Full Heal Energy's heal
            // both read "when you attach this card from your hand", and this is not that.
            player.discard.moveCardTo(energyCard, slot.energies);

            const holder = slot.getPokemonCard();
            store.log(state, GameLog.LOG_PLAYER_ATTACHES_CARD, {
              name: player.name,
              card: energyCard.name,
              pokemon: holder ? holder.name : this.name
            });
          }
        }
      );
    }

    return state;
  }
}

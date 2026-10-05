import {
  AttachEnergyPrompt,
  AttackEffect,
  CardType,
  DiscardCardsEffect,
  Effect,
  EnergyCard,
  EnergyType,
  GameLog,
  GameMessage,
  PlayerType,
  PokemonCard,
  ShuffleDeckPrompt,
  SlotType,
  Stage,
  State,
  StoreLike,
  SuperType,
} from '@ptcg/common';

function* useRecharge(next: Function, store: StoreLike, state: State, effect: AttackEffect): IterableIterator<State> {
  const player = effect.player;

  if (player.deck.cards.length > 0) {
    // "a Lightning Energy card" is a basic Lightning Energy card; Rainbow Energy is a
    // Special Energy card and is not one, even though it provides Lightning in play.
    yield store.prompt(
      state,
      new AttachEnergyPrompt(
        player.id,
        GameMessage.ATTACH_ENERGY_TO_ACTIVE,
        player.deck,
        PlayerType.BOTTOM_PLAYER,
        [SlotType.ACTIVE],
        { superType: SuperType.ENERGY, energyType: EnergyType.BASIC, provides: [CardType.LIGHTNING] },
        { allowCancel: false, min: 0, max: 1 }
      ),
      transfers => {
        transfers = transfers || [];
        const slot = player.active;
        // "attach it to Pikachu" - the attacking Pokemon. Polices its own slot list and
        // card count, because AttachEnergyPrompt.validate does neither.
        for (const transfer of transfers.slice(0, 1)) {
          const energyCard = transfer.card as EnergyCard;
          if (!player.deck.cards.includes(energyCard)) {
            continue;
          }
          // Straight from the deck, not an AttachEnergyEffect (that means "from your hand").
          player.deck.moveCardTo(energyCard, slot.energies);
          const holder = slot.getPokemonCard();
          store.log(state, GameLog.LOG_PLAYER_ATTACHES_CARD, {
            name: player.name,
            card: energyCard.name,
            pokemon: holder ? holder.name : 'Pikachu'
          });
        }
        next();
      }
    );
  }

  return store.prompt(state, new ShuffleDeckPrompt(player.id), order => {
    player.deck.applyOrder(order);
  });
}

// Wizards Black Star Promo #4.
export class PikachuPR4 extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public cardTypes: CardType[] = [CardType.LIGHTNING];

  public hp: number = 50;

  public attacks = [
    {
      name: 'Recharge',
      cost: [CardType.LIGHTNING],
      damage: '',
      text: 'Search your deck for a Lightning Energy card and attach it to Pikachu. Shuffle your deck afterward.'
    },
    {
      name: 'Thunderbolt',
      cost: [CardType.LIGHTNING, CardType.LIGHTNING, CardType.LIGHTNING],
      damage: '50',
      text: 'Discard all Energy cards attached to Pikachu in order to use this attack.'
    },
  ];

  public weakness = [
    { type: CardType.FIGHTING }
  ];

  public retreat = [CardType.COLORLESS];

  public set: string = 'PR';

  public name: string = 'Pikachu';

  public fullName: string = 'Pikachu PR4';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof AttackEffect && effect.attack === this.attacks[0]) {
      const generator = useRecharge(() => generator.next(), store, state, effect);
      return generator.next().value;
    }

    // Same as Zapdos BS Thunderbolt
    if (effect instanceof AttackEffect && effect.attack === this.attacks[1]) {
      const player = effect.player;
      const cards = player.active.energies.cards.slice();
      const discardEnergy = new DiscardCardsEffect(effect, cards);
      discardEnergy.target = player.active;
      store.reduceEffect(state, discardEnergy);
    }

    return state;
  }
}

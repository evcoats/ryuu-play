import {
  AttackAction,
  BotFlipMode,
  BotShuffleMode,
  CardType,
  ChooseCardsPrompt,
  GameMessage,
  PassTurnAction,
  ResolvePromptAction,
  Simulator,
  SpecialCondition,
  UseAbilityAction,
} from "@ptcg/common";

import { DragonitePR5 } from "../../../src/base-sets/set-promos/dragonite";
import { setPromos } from "../../../src/base-sets/set-promos";
import { Grimer } from "../../../src/base-sets/set-fossil/grimer";
import { Muk } from "../../../src/base-sets/set-fossil/muk";
import { TestCard } from "../../test-cards/test-card";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

describe('Dragonite PR5', () => {
  let sim: Simulator;

  const colorless3 = [ CardType.COLORLESS, CardType.COLORLESS, CardType.COLORLESS ];

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new DragonitePR5() ], colorless3);
  });

  const use = (slot = TestUtils.getAll(sim).player.active) => {
    sim.dispatch(new UseAbilityAction(1, 'Special Delivery', TestUtils.target(sim, slot)));
  };

  const errorOf = (fn: () => void): string => {
    try {
      fn();
    } catch (error) {
      return TestUtils.getErrorMessage(error);
    }
    return '';
  };

  const lastChoosePrompt = (): ChooseCardsPrompt => {
    const { prompts } = TestUtils.getAll(sim);
    return prompts[prompts.length - 1] as ChooseCardsPrompt;
  };

  it('Should be registered as promo #5', () => {
    expect(setPromos.some(c => c.fullName === 'Dragonite PR5')).toBe(true);
  });

  describe('Special Delivery', () => {
    it('Should draw a card, then put a chosen card from the hand on top of the deck', () => {
      const { player, deck } = TestUtils.getAll(sim);
      const inHand = new TestCard();
      player.hand.cards = [ inHand ];
      const top = deck.cards[0];
      const deckSize = deck.cards.length;

      use();
      expect(player.hand.cards).toContain(top);
      const prompt = lastChoosePrompt();
      expect(prompt instanceof ChooseCardsPrompt).toBe(true);
      expect(prompt.cards).toBe(player.hand);
      expect(prompt.options.min).toEqual(1);
      expect(prompt.options.max).toEqual(1);
      expect(prompt.options.allowCancel).toBe(false);

      sim.dispatch(new ResolvePromptAction(prompt.id, [ inHand ]));
      expect(deck.cards[0]).toBe(inHand);
      expect(player.hand.cards).toEqual([ top ]);
      expect(deck.cards.length).toEqual(deckSize);
    });

    it('Should allow putting back the card just drawn', () => {
      const { player, deck } = TestUtils.getAll(sim);
      const top = deck.cards[0];
      use();
      sim.dispatch(new ResolvePromptAction(lastChoosePrompt().id, [ top ]));
      expect(deck.cards[0]).toBe(top);
      expect(player.hand.cards).toEqual([]);
    });

    it('Should be usable once per turn', () => {
      const { deck } = TestUtils.getAll(sim);
      use();
      sim.dispatch(new ResolvePromptAction(lastChoosePrompt().id, [ deck.cards[0] ]));
      expect(errorOf(() => use())).toEqual(GameMessage.POWER_ALREADY_USED);
    });

    it('Should be usable again on the next turn', () => {
      use();
      sim.dispatch(new ResolvePromptAction(lastChoosePrompt().id, [ TestUtils.getAll(sim).player.hand.cards[0] ]));
      sim.dispatch(new PassTurnAction(1));
      sim.dispatch(new PassTurnAction(2));
      const before = TestUtils.getAll(sim).prompts.length;
      use();
      expect(TestUtils.getAll(sim).prompts.length).toEqual(before + 1);
    });

    it('Should be usable once by each Dragonite', () => {
      const { player } = TestUtils.getAll(sim);
      player.bench[0] = TestUtils.pokemonSlot([ new DragonitePR5() ]);
      use();
      sim.dispatch(new ResolvePromptAction(lastChoosePrompt().id, [ player.hand.cards[0] ]));
      use(player.bench[0]);
      expect(lastChoosePrompt().result).toBeUndefined();
    });

    it('Should work from the Bench', () => {
      const { player } = TestUtils.getAll(sim);
      TestUtils.setActive(sim, [ new TestPokemon() ]);
      player.bench[0] = TestUtils.pokemonSlot([ new DragonitePR5() ]);
      use(player.bench[0]);
      expect(lastChoosePrompt() instanceof ChooseCardsPrompt).toBe(true);
    });

    it('Should not be usable while Asleep, Confused or Paralyzed', () => {
      for (const condition of [ SpecialCondition.ASLEEP, SpecialCondition.CONFUSED, SpecialCondition.PARALYZED ]) {
        TestUtils.getAll(sim).player.active.specialConditions = [ condition ];
        expect(errorOf(() => use())).toEqual(GameMessage.CANNOT_USE_POWER);
      }
    });

    it('Should be usable while Poisoned', () => {
      const { player } = TestUtils.getAll(sim);
      player.active.specialConditions = [ SpecialCondition.POISONED ];
      use();
      expect(lastChoosePrompt() instanceof ChooseCardsPrompt).toBe(true);
    });

    it('Should not be usable with an empty deck', () => {
      TestUtils.getAll(sim).deck.cards = [];
      expect(errorOf(() => use())).toEqual(GameMessage.CANNOT_USE_POWER);
    });

    it('Should be blocked by Muk\'s Toxic Gas', () => {
      TestUtils.getAll(sim).opponent.bench[0] = TestUtils.pokemonSlot([ new Grimer(), new Muk() ]);
      expect(errorOf(() => use())).toEqual(GameMessage.BLOCKED_BY_ABILITY);
    });

    it('Should not be usable on the opponent\'s turn', () => {
      sim.dispatch(new PassTurnAction(1));
      expect(errorOf(() => use())).toEqual(GameMessage.NOT_YOUR_TURN);
    });
  });

  describe('Supersonic Flight', () => {
    it('Should do 60 damage on heads', () => {
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Supersonic Flight'));
      expect(opponent.active.damage).toEqual(60);
    });

    it('Should do nothing on tails', () => {
      sim = TestUtils.createTestSimulator({ flipMode: BotFlipMode.ALL_TAILS, shuffleMode: BotShuffleMode.REVERSE });
      TestUtils.setActive(sim, [ new DragonitePR5() ], colorless3);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Supersonic Flight'));
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should apply Weakness and Resistance', () => {
      const weak = new TestPokemon();
      weak.weakness = [ { type: CardType.COLORLESS } ];
      TestUtils.setDefending(sim, [ weak ]);
      sim.dispatch(new AttackAction(1, 'Supersonic Flight'));
      expect(TestUtils.getAll(sim).opponent.active.damage).toEqual(120);

      sim = TestUtils.createTestSimulator();
      TestUtils.setActive(sim, [ new DragonitePR5() ], colorless3);
      const resistant = new TestPokemon();
      resistant.resistance = [ { type: CardType.COLORLESS, value: -30 } ];
      TestUtils.setDefending(sim, [ resistant ]);
      sim.dispatch(new AttackAction(1, 'Supersonic Flight'));
      expect(TestUtils.getAll(sim).opponent.active.damage).toEqual(30);
    });
  });
});

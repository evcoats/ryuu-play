import {
  AttachEnergyPrompt,
  AttackAction,
  CardType,
  PlayerType,
  ResolvePromptAction,
  Simulator,
  SlotType,
} from "@ptcg/common";

import { PikachuPR4 } from "../../../src/base-sets/set-promos/pikachu-pr4";
import { setPromos } from "../../../src/base-sets/set-promos";
import { LightningEnergy } from "../../../src/base-sets/set-base/lightning-energy";
import { FireEnergy } from "../../../src/base-sets/set-base/fire-energy";
import { DoubleColorlessEnergy } from "../../../src/base-sets/set-base/double-colorless-energy";
import { RainbowEnergy } from "../../../src/base-sets/set-team-rocket/rainbow-energy";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

describe('Pikachu PR4', () => {
  let sim: Simulator;
  const ACTIVE = { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.ACTIVE, index: 0 };
  const BENCH = { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.BENCH, index: 0 };

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new PikachuPR4() ], [ CardType.LIGHTNING, CardType.LIGHTNING, CardType.LIGHTNING ]);
  });

  const lastAttachPrompt = () => {
    const { prompts } = TestUtils.getAll(sim);
    const prompt = prompts[prompts.length - 1];
    return prompt instanceof AttachEnergyPrompt ? prompt : undefined;
  };

  it('Should be registered as promo #4, distinct from promo #1', () => {
    const card = setPromos.find(c => c.fullName === 'Pikachu PR4') as PikachuPR4;
    expect(card instanceof PikachuPR4).toBe(true);
    expect(card.hp).toEqual(50);
  });

  describe('Recharge', () => {
    it('Should attach a Lightning Energy card from the deck to Pikachu and shuffle', () => {
      const { player, deck } = TestUtils.getAll(sim);
      const lightning = new LightningEnergy();
      deck.cards.splice(20, 0, lightning);
      const deckSize = deck.cards.length;
      const bottom = deck.cards[deck.cards.length - 1];

      sim.dispatch(new AttackAction(1, 'Recharge'));
      const prompt = lastAttachPrompt()!;
      expect(prompt).toBeDefined();
      expect(prompt.cardList).toBe(deck);
      expect(prompt.slots).toEqual([ SlotType.ACTIVE ]);
      expect(prompt.options.max).toEqual(1);

      sim.dispatch(new ResolvePromptAction(prompt.id, [ { to: ACTIVE, card: lightning } ]));
      expect(player.active.energies.cards).toContain(lightning);
      expect(deck.cards).not.toContain(lightning);
      expect(deck.cards.length).toEqual(deckSize - 1);
      // REVERSE shuffle mode: the old bottom card is now on top, i.e. the deck was shuffled
      expect(deck.cards[0]).toBe(bottom);
    });

    it('Should do no damage', () => {
      const { opponent, deck } = TestUtils.getAll(sim);
      deck.cards.push(new LightningEnergy());
      sim.dispatch(new AttackAction(1, 'Recharge'));
      sim.dispatch(new ResolvePromptAction(lastAttachPrompt()!.id, []));
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should only accept a basic Lightning Energy card (not Rainbow, Fire or Double Colorless)', () => {
      const { deck } = TestUtils.getAll(sim);
      const rainbow = new RainbowEnergy();
      const fire = new FireEnergy();
      const dce = new DoubleColorlessEnergy();
      deck.cards.push(rainbow, fire, dce, new LightningEnergy());

      sim.dispatch(new AttackAction(1, 'Recharge'));
      const prompt = lastAttachPrompt()!;
      expect(prompt.validate([ { to: ACTIVE, card: rainbow } ])).toBe(false);
      expect(prompt.validate([ { to: ACTIVE, card: fire } ])).toBe(false);
      expect(prompt.validate([ { to: ACTIVE, card: dce } ])).toBe(false);
    });

    it('Should allow failing to find the card', () => {
      const { player, deck } = TestUtils.getAll(sim);
      deck.cards.push(new LightningEnergy());
      sim.dispatch(new AttackAction(1, 'Recharge'));
      sim.dispatch(new ResolvePromptAction(lastAttachPrompt()!.id, []));
      expect(player.active.energies.cards.length).toEqual(3);
    });

    it('Should attach at most one card, and only to Pikachu', () => {
      const { player, deck } = TestUtils.getAll(sim);
      player.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      const first = new LightningEnergy();
      const second = new LightningEnergy();
      deck.cards.push(first, second);

      sim.dispatch(new AttackAction(1, 'Recharge'));
      sim.dispatch(new ResolvePromptAction(lastAttachPrompt()!.id, [
        { to: BENCH, card: first },
        { to: ACTIVE, card: second }
      ]));

      expect(player.active.energies.cards.length).toEqual(4);
      expect(player.active.energies.cards).toContain(first);
      expect(player.bench[0].energies.cards).toEqual([]);
      expect(deck.cards).toContain(second);
    });

    it('Should do nothing with an empty deck', () => {
      const { player, deck } = TestUtils.getAll(sim);
      deck.cards = [];
      sim.dispatch(new AttackAction(1, 'Recharge'));
      expect(lastAttachPrompt()).toBeUndefined();
      expect(player.active.energies.cards.length).toEqual(3);
    });
  });

  describe('Thunderbolt', () => {
    it('Should do 50 damage and discard every Energy card attached', () => {
      TestUtils.setActive(sim, [ new PikachuPR4() ], [ CardType.LIGHTNING, CardType.LIGHTNING, CardType.LIGHTNING ]);
      const { player, opponent, discard } = TestUtils.getAll(sim);
      const dce = new DoubleColorlessEnergy();
      player.active.energies.cards.push(dce);

      sim.dispatch(new AttackAction(1, 'Thunderbolt'));
      expect(opponent.active.damage).toEqual(50);
      expect(player.active.energies.cards).toEqual([]);
      expect(discard.cards.length).toEqual(4);
      expect(discard.cards).toContain(dce);
    });

    it('Should apply Weakness', () => {
      const defending = new TestPokemon();
      defending.weakness = [ { type: CardType.LIGHTNING } ];
      TestUtils.setDefending(sim, [ defending ]);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Thunderbolt'));
      expect(opponent.active.damage).toEqual(100);
    });

    it('Should need three Lightning Energy', () => {
      TestUtils.setActive(sim, [ new PikachuPR4() ], [ CardType.LIGHTNING, CardType.LIGHTNING, CardType.COLORLESS ]);
      expect(() => sim.dispatch(new AttackAction(1, 'Thunderbolt'))).toThrow();
    });
  });
});

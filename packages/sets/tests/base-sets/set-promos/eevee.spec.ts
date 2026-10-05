import {
  AttackAction,
  CardTarget,
  CardType,
  ChooseCardsPrompt,
  ConfirmPrompt,
  GameMessage,
  PlayCardAction,
  PlayerType,
  Prompt,
  ResolvePromptAction,
  Simulator,
  SlotType,
  SpecialCondition,
  UseAbilityAction,
} from "@ptcg/common";

import { EeveePR11 } from "../../../src/base-sets/set-promos/eevee";
import { setPromos } from "../../../src/base-sets/set-promos";
import { Charmander } from "../../../src/base-sets/set-base/charmander";
import { Charmeleon } from "../../../src/base-sets/set-base/charmeleon";
import { Flareon } from "../../../src/base-sets/set-jungle/flareon";
import { Jolteon } from "../../../src/base-sets/set-jungle/jolteon";
import { Grimer } from "../../../src/base-sets/set-fossil/grimer";
import { Muk } from "../../../src/base-sets/set-fossil/muk";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

describe('Eevee PR11', () => {
  let sim: Simulator;
  let flareon: Flareon;
  let charmeleon: Charmeleon;

  const ACTIVE: CardTarget = { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.ACTIVE, index: 0 };
  const BENCH = (index: number): CardTarget => ({ player: PlayerType.BOTTOM_PLAYER, slot: SlotType.BENCH, index });

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    sim.store.state.turn = 5;
    const { player, deck } = TestUtils.getAll(sim);
    TestUtils.setActive(sim, [ new Charmander() ]);
    player.bench[0] = TestUtils.pokemonSlot([ new EeveePR11() ]);
    charmeleon = new Charmeleon();
    player.hand.cards = [ charmeleon ];
    flareon = new Flareon();
    deck.cards.splice(10, 0, flareon);
  });

  const unresolved = <T extends Prompt<any>>(type: new (...args: any[]) => T, playerId?: number): T[] =>
    TestUtils.getAll(sim).prompts
      .filter(p => p instanceof type && p.result === undefined && (playerId === undefined || p.playerId === playerId)) as T[];

  const evolveCharmander = (playerId = 1, target = ACTIVE) => {
    const { state } = TestUtils.getAll(sim);
    const owner = state.players.find(p => p.id === playerId)!;
    sim.dispatch(new PlayCardAction(playerId, owner.hand.cards.indexOf(charmeleon), target));
  };

  it('Should be registered as promo #11', () => {
    const card = setPromos.find(c => c.fullName === 'Eevee PR11') as EeveePR11;
    expect(card instanceof EeveePR11).toBe(true);
    expect(card.hp).toEqual(30);
    expect(card.retreat).toEqual([]);
  });

  describe('Bite', () => {
    it('Should do 20 damage, with Weakness', () => {
      TestUtils.setActive(sim, [ new EeveePR11() ], [ CardType.COLORLESS ]);
      const weak = new TestPokemon();
      weak.weakness = [ { type: CardType.COLORLESS } ];
      TestUtils.setDefending(sim, [ weak ]);
      sim.dispatch(new AttackAction(1, 'Bite'));
      expect(TestUtils.getAll(sim).opponent.active.damage).toEqual(40);
    });
  });

  describe('Chain Reaction', () => {
    it('Should not be usable as an activated power', () => {
      const { player } = TestUtils.getAll(sim);
      expect(() => sim.dispatch(new UseAbilityAction(1, 'Chain Reaction', TestUtils.target(sim, player.bench[0]))))
        .toThrow();
    });

    it('Should offer to evolve Eevee from the deck when another of your Pokemon evolves', () => {
      const { player, deck } = TestUtils.getAll(sim);
      evolveCharmander();
      expect(player.active.getPokemonCard()).toBe(charmeleon);

      const confirm = unresolved(ConfirmPrompt, player.id);
      expect(confirm.length).toEqual(1);
      expect(confirm[0].message).toEqual(GameMessage.WANT_TO_USE_ABILITY);
      sim.dispatch(new ResolvePromptAction(confirm[0].id, true));

      const choose = unresolved(ChooseCardsPrompt, player.id)[0];
      expect(choose.cards).toBe(deck);
      sim.dispatch(new ResolvePromptAction(choose.id, [ flareon ]));

      expect(player.bench[0].getPokemonCard()).toBe(flareon);
      expect(player.bench[0].getPokemons().length).toEqual(2);
      expect(deck.cards).not.toContain(flareon);
      expect(player.hand.cards).not.toContain(flareon);
      expect(TestUtils.getAll(sim).prompts.every(p => p.result !== undefined)).toBe(true);
    });

    it('Should count as evolving: effects on Eevee end', () => {
      const { player } = TestUtils.getAll(sim);
      player.bench[0].marker.addMarker('SOME_ATTACK_EFFECT', flareon);
      evolveCharmander();
      sim.dispatch(new ResolvePromptAction(unresolved(ConfirmPrompt)[0].id, true));
      sim.dispatch(new ResolvePromptAction(unresolved(ChooseCardsPrompt)[0].id, [ flareon ]));
      expect(player.bench[0].marker.markers).toEqual([]);
    });

    it('Should only accept a card that evolves from Eevee', () => {
      const { deck } = TestUtils.getAll(sim);
      const otherCharmeleon = new Charmeleon();
      deck.cards.push(otherCharmeleon);
      evolveCharmander();
      sim.dispatch(new ResolvePromptAction(unresolved(ConfirmPrompt)[0].id, true));
      const choose = unresolved(ChooseCardsPrompt)[0];
      expect(choose.validate([ otherCharmeleon ])).toBe(false);
      expect(choose.validate([ flareon ])).toBe(true);
      expect(choose.validate([])).toBe(true);
    });

    it('Should allow failing to find a card, and still shuffle', () => {
      const { player, deck } = TestUtils.getAll(sim);
      const bottom = deck.cards[deck.cards.length - 1];
      evolveCharmander();
      sim.dispatch(new ResolvePromptAction(unresolved(ConfirmPrompt)[0].id, true));
      sim.dispatch(new ResolvePromptAction(unresolved(ChooseCardsPrompt)[0].id, []));
      expect(player.bench[0].getPokemonCard() instanceof EeveePR11).toBe(true);
      expect(deck.cards[0]).toBe(bottom);
    });

    it('Should do nothing when declined', () => {
      const { player, deck } = TestUtils.getAll(sim);
      const before = deck.cards.slice();
      evolveCharmander();
      sim.dispatch(new ResolvePromptAction(unresolved(ConfirmPrompt)[0].id, false));
      expect(unresolved(ChooseCardsPrompt).length).toEqual(0);
      expect(player.bench[0].getPokemonCard() instanceof EeveePR11).toBe(true);
      expect(deck.cards).toEqual(before);
    });

    it('Should trigger when the opponent\'s Pokemon evolves (printed English text)', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      player.hand.cards = [];
      TestUtils.setActivePlayer(sim, opponent);
      opponent.active.pokemons.cards = [ new Charmander() ];
      opponent.hand.cards = [ charmeleon ];

      evolveCharmander(2);
      expect(opponent.active.getPokemonCard()).toBe(charmeleon);
      expect(unresolved(ConfirmPrompt, opponent.id).length).toEqual(0);
      const confirm = unresolved(ConfirmPrompt, player.id);
      expect(confirm.length).toEqual(1);

      sim.dispatch(new ResolvePromptAction(confirm[0].id, true));
      sim.dispatch(new ResolvePromptAction(unresolved(ChooseCardsPrompt, player.id)[0].id, [ flareon ]));
      expect(player.bench[0].getPokemonCard()).toBe(flareon);
    });

    it('Should not trigger when this Eevee itself evolves', () => {
      const { player } = TestUtils.getAll(sim);
      const handFlareon = new Flareon();
      player.hand.cards = [ handFlareon ];
      sim.dispatch(new PlayCardAction(1, 0, BENCH(0)));
      expect(player.bench[0].getPokemonCard()).toBe(handFlareon);
      expect(unresolved(ConfirmPrompt).length).toEqual(0);
    });

    it('Should not trigger while Eevee is Asleep, Confused or Paralyzed', () => {
      for (const condition of [ SpecialCondition.ASLEEP, SpecialCondition.CONFUSED, SpecialCondition.PARALYZED ]) {
        sim = TestUtils.createTestSimulator();
        sim.store.state.turn = 5;
        const { player } = TestUtils.getAll(sim);
        TestUtils.setActive(sim, [ new EeveePR11() ]);
        player.active.specialConditions = [ condition ];
        player.bench[0] = TestUtils.pokemonSlot([ new Charmander() ]);
        charmeleon = new Charmeleon();
        player.hand.cards = [ charmeleon ];
        TestUtils.getAll(sim).deck.cards.push(new Flareon());

        evolveCharmander(1, BENCH(0));
        expect(player.bench[0].getPokemonCard()).toBe(charmeleon);
        expect(unresolved(ConfirmPrompt).length).toEqual(0);
      }
    });

    it('Should trigger while Eevee is Poisoned', () => {
      const { player } = TestUtils.getAll(sim);
      TestUtils.setActive(sim, [ new EeveePR11() ]);
      player.active.specialConditions = [ SpecialCondition.POISONED ];
      player.bench[0] = TestUtils.pokemonSlot([ new Charmander() ]);
      evolveCharmander(1, BENCH(0));
      expect(unresolved(ConfirmPrompt).length).toEqual(1);
    });

    it('Should not trigger while Muk\'s Toxic Gas is active', () => {
      const { opponent } = TestUtils.getAll(sim);
      opponent.bench[0] = TestUtils.pokemonSlot([ new Grimer(), new Muk() ]);
      evolveCharmander();
      expect(unresolved(ConfirmPrompt).length).toEqual(0);
    });

    it('Should not evolve an Eevee that was put into play this turn', () => {
      const { player } = TestUtils.getAll(sim);
      player.bench[0].pokemonPlayedTurn = 5;
      evolveCharmander();
      expect(unresolved(ConfirmPrompt).length).toEqual(0);
    });

    it('Should not trigger with an empty deck', () => {
      TestUtils.getAll(sim).deck.cards = [];
      evolveCharmander();
      expect(unresolved(ConfirmPrompt).length).toEqual(0);
    });

    it('Should chain: an Eevee evolved by Chain Reaction triggers another Eevee', () => {
      const { player, deck } = TestUtils.getAll(sim);
      const secondEevee = new EeveePR11();
      player.bench[1] = TestUtils.pokemonSlot([ secondEevee ]);
      const jolteon = new Jolteon();
      deck.cards.splice(20, 0, jolteon);

      evolveCharmander();
      // Both Eevees are offered the triggering evolution
      const firstRound = unresolved(ConfirmPrompt);
      expect(firstRound.length).toEqual(2);

      // The bench[0] Eevee accepts first (whichever prompt is its, the first one resolved wins)
      sim.dispatch(new ResolvePromptAction(firstRound[0].id, true));
      sim.dispatch(new ResolvePromptAction(unresolved(ChooseCardsPrompt)[0].id, [ flareon ]));
      const evolvedSlot = player.bench.find(b => b.getPokemonCard() === flareon)!;
      expect(evolvedSlot).toBeDefined();

      // That evolution offers Chain Reaction again to the Eevee still in play
      const secondRound = unresolved(ConfirmPrompt);
      expect(secondRound.length).toEqual(2);
      sim.dispatch(new ResolvePromptAction(secondRound[0].id, false));
      sim.dispatch(new ResolvePromptAction(secondRound[1].id, true));
      sim.dispatch(new ResolvePromptAction(unresolved(ChooseCardsPrompt)[0].id, [ jolteon ]));

      expect(player.bench.filter(b => b.getPokemonCard() === flareon || b.getPokemonCard() === jolteon).length)
        .toEqual(2);
      expect(TestUtils.getAll(sim).prompts.every(p => p.result !== undefined)).toBe(true);
    });

    it('Should be harmless when its prompt is answered after Eevee has already evolved', () => {
      const { player } = TestUtils.getAll(sim);
      player.bench[1] = TestUtils.pokemonSlot([ new EeveePR11() ]);
      TestUtils.getAll(sim).deck.cards.push(new Jolteon());
      evolveCharmander();
      const [ first, second ] = unresolved(ConfirmPrompt);
      sim.dispatch(new ResolvePromptAction(first.id, true));
      sim.dispatch(new ResolvePromptAction(unresolved(ChooseCardsPrompt)[0].id, [ flareon ]));
      // Accepting the stale prompt of the Eevee that already evolved does nothing
      const evolvedFirst = player.bench.find(b => b.getPokemonCard() === flareon)!;
      const promptsBefore = TestUtils.getAll(sim).prompts.length;
      // 'second' may belong to either Eevee; answer every pending confirm with true
      for (const prompt of unresolved(ConfirmPrompt)) {
        sim.dispatch(new ResolvePromptAction(prompt.id, true));
        for (const choose of unresolved(ChooseCardsPrompt)) {
          sim.dispatch(new ResolvePromptAction(choose.id, []));
        }
      }
      expect(second).toBeDefined();
      expect(evolvedFirst.getPokemons().length).toEqual(2);
      expect(TestUtils.getAll(sim).prompts.length).toBeGreaterThanOrEqual(promptsBefore);
      expect(TestUtils.getAll(sim).prompts.every(p => p.result !== undefined)).toBe(true);
    });
  });
});

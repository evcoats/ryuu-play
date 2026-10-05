import {
  AttackAction,
  BotFlipMode,
  BotShuffleMode,
  CardType,
  CheckPokemonStatsEffect,
  PassTurnAction,
  PokemonSlot,
  ResolvePromptAction,
  SelectPrompt,
  Simulator,
} from "@ptcg/common";

import { CoolPorygonPR15 } from "../../../src/base-sets/set-promos/cool-porygon";
import { setPromos } from "../../../src/base-sets/set-promos";
import { Hitmonchan } from "../../../src/base-sets/set-base/hitmonchan";
import { changeType } from "../../../src/common";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

const option = (value: string) => changeType.PROMPT_OPTIONS.findIndex(o => o.value === value);

describe('Cool Porygon PR15', () => {
  let sim: Simulator;
  const colorless3 = [ CardType.COLORLESS, CardType.COLORLESS, CardType.COLORLESS ];

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new CoolPorygonPR15() ], colorless3);
    TestUtils.setDefending(sim, [ new Hitmonchan() ], [ CardType.FIGHTING ]);
  });

  const stats = (slot: PokemonSlot) => {
    const effect = new CheckPokemonStatsEffect(slot);
    sim.store.reduceEffect(sim.store.state, effect);
    return effect;
  };

  const selectPrompts = () =>
    TestUtils.getAll(sim).prompts.filter(p => p instanceof SelectPrompt && p.result === undefined) as SelectPrompt[];

  // Resistance prompt first, then the Defending Pokemon's Weakness
  const textureMagic = (resistance: string | null, weakness: string | null) => {
    sim.dispatch(new AttackAction(1, 'Texture Magic'));
    sim.dispatch(new ResolvePromptAction(selectPrompts()[0].id, resistance === null ? null : option(resistance)));
    const next = selectPrompts()[0];
    if (next !== undefined) {
      sim.dispatch(new ResolvePromptAction(next.id, weakness === null ? null : option(weakness)));
    }
  };

  it('Should be registered as promo #15', () => {
    const card = setPromos.find(c => c.fullName === 'Cool Porygon PR15') as CoolPorygonPR15;
    expect(card instanceof CoolPorygonPR15).toBe(true);
    expect(card.name).toEqual('Cool Porygon');
  });

  describe('Texture Magic', () => {
    it('Should change Cool Porygon\'s Resistance and the Defending Pokemon\'s Weakness', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      textureMagic('R', 'W');
      expect(stats(player.active).resistance).toEqual([ { type: CardType.FIRE, value: -30 } ]);
      expect(stats(opponent.active).weakness.map(w => w.type)).toEqual([ CardType.WATER ]);
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should not offer Colorless', () => {
      sim.dispatch(new AttackAction(1, 'Texture Magic'));
      expect(option('C')).toEqual(-1);
      expect(selectPrompts()[0].values.length).toEqual(changeType.PROMPT_OPTIONS.length);
    });

    it('Should let either change be declined', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      textureMagic(null, 'G');
      expect(stats(player.active).resistance).toEqual([ { type: CardType.PSYCHIC, value: -30 } ]);
      expect(stats(opponent.active).weakness.map(w => w.type)).toEqual([ CardType.GRASS ]);
    });

    it('Should not offer a Weakness change when the Defending Pokemon has no Weakness', () => {
      TestUtils.setDefending(sim, [ new TestPokemon() ]);
      sim.dispatch(new AttackAction(1, 'Texture Magic'));
      expect(selectPrompts().length).toEqual(1);
      sim.dispatch(new ResolvePromptAction(selectPrompts()[0].id, option('F')));
      expect(selectPrompts().length).toEqual(0);
      expect(stats(TestUtils.getAll(sim).opponent.active).weakness).toEqual([]);
    });

    it('Should affect damage: Fighting Resistance against Hitmonchan (20 x2 - 30 = 10)', () => {
      const { player } = TestUtils.getAll(sim);
      textureMagic('F', null);
      sim.dispatch(new AttackAction(2, 'Jab'));
      expect(player.active.damage).toEqual(10);
    });

    it('Should keep both changes across turns (no turn limit)', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      textureMagic('R', 'W');
      sim.dispatch(new PassTurnAction(2));
      sim.dispatch(new PassTurnAction(1));
      sim.dispatch(new PassTurnAction(2));
      expect(stats(player.active).resistance.map(r => r.type)).toEqual([ CardType.FIRE ]);
      expect(stats(opponent.active).weakness.map(w => w.type)).toEqual([ CardType.WATER ]);
    });

    it('Should end only Cool Porygon\'s change when Cool Porygon is benched', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      player.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      textureMagic('R', 'W');
      const porygon = player.active;
      player.switchPokemon(player.bench[0]);
      expect(stats(porygon).resistance.map(r => r.type)).toEqual([ CardType.PSYCHIC ]);
      expect(stats(opponent.active).weakness.map(w => w.type)).toEqual([ CardType.WATER ]);
    });

    it('Should end only the Defending Pokemon\'s change when it is benched', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      opponent.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      textureMagic('R', 'W');
      const defending = opponent.active;
      opponent.switchPokemon(opponent.bench[0]);
      expect(stats(defending).weakness.map(w => w.type)).toEqual([ CardType.PSYCHIC ]);
      expect(stats(player.active).resistance.map(r => r.type)).toEqual([ CardType.FIRE ]);
    });

    it('Should replace an earlier Texture Magic change rather than stack', () => {
      const { player } = TestUtils.getAll(sim);
      textureMagic('R', null);
      sim.dispatch(new PassTurnAction(2));
      textureMagic('W', null);
      expect(stats(player.active).resistance).toEqual([ { type: CardType.WATER, value: -30 } ]);
    });
  });

  describe('3-D Attack', () => {
    it('Should do 60 damage with 3 heads', () => {
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, '3-D Attack'));
      expect(opponent.active.damage).toEqual(60);
    });

    it('Should do nothing with 3 tails', () => {
      sim = TestUtils.createTestSimulator({ flipMode: BotFlipMode.ALL_TAILS, shuffleMode: BotShuffleMode.REVERSE });
      TestUtils.setActive(sim, [ new CoolPorygonPR15() ], colorless3);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, '3-D Attack'));
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should do 40 damage with 2 heads', () => {
      // Any 3 consecutive flips of a cyclic [H, H, T] give exactly 2 heads
      TestUtils.setFlipResults(sim, [ true, true, false ]);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, '3-D Attack'));
      expect(opponent.active.damage).toEqual(40);
    });

    it('Should apply Weakness to the total', () => {
      const weak = new TestPokemon();
      weak.weakness = [ { type: CardType.COLORLESS } ];
      TestUtils.setDefending(sim, [ weak ]);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, '3-D Attack'));
      expect(opponent.active.damage).toEqual(120);
    });
  });
});

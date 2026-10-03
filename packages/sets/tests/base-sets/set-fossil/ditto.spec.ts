import {
  CardType,
  CheckHpEffect,
  CheckPokemonStatsEffect,
  CheckPokemonTypeEffect,
  CheckRetreatCostEffect,
  PutDamageEffect,
  AttackEffect,
  Simulator,
  SpecialCondition,
  GamePhase,
  UsePowerEffect
} from "@ptcg/common";

import { Ditto } from "../../../src/base-sets/set-fossil/ditto";
import { Grimer } from "../../../src/base-sets/set-fossil/grimer";
import { Muk } from "../../../src/base-sets/set-fossil/muk";
import { Hitmonchan } from "../../../src/base-sets/set-base/hitmonchan";
import { MrMime } from "../../../src/base-sets/set-jungle/mr-mime";
import { setFossil } from "../../../src/base-sets/set-fossil";
import { TestUtils } from "../../test-utils";

describe('Ditto FO', () => {
  let sim: Simulator;

  beforeEach(() => {
    sim = TestUtils.createTestSimulator();
    TestUtils.setActive(sim, [ new Ditto() ], [ CardType.PSYCHIC, CardType.PSYCHIC ]);
  });

  const hp = () => {
    const { player } = TestUtils.getAll(sim);
    const effect = new CheckHpEffect(player, player.active);
    sim.store.reduceEffect(sim.store.state, effect);
    return effect.hp;
  };

  it('Should be registered in the Fossil set', () => {
    expect(setFossil.some(card => card.fullName === 'Ditto FO')).toBe(true);
  });

  it('Should copy the Defending Pokemon HP', () => {
    TestUtils.setDefending(sim, [ new Hitmonchan() ]);
    expect(hp()).toEqual(70);
  });

  it('Should copy the Defending Pokemon type, Weakness and retreat cost', () => {
    const { player } = TestUtils.getAll(sim);
    TestUtils.setDefending(sim, [ new Hitmonchan() ]);

    const types = new CheckPokemonTypeEffect(player.active);
    sim.store.reduceEffect(sim.store.state, types);
    expect(types.cardTypes).toEqual([ CardType.FIGHTING ]);

    const stats = new CheckPokemonStatsEffect(player.active);
    sim.store.reduceEffect(sim.store.state, stats);
    expect(stats.weakness.map(w => w.type)).toEqual([ CardType.PSYCHIC ]);
    expect(stats.resistance).toEqual([]);

    const retreat = new CheckRetreatCostEffect(player);
    sim.store.reduceEffect(sim.store.state, retreat);
    expect(retreat.cost.length).toEqual(2);
  });

  it('Should stop being a copy while Asleep, Confused or Paralyzed', () => {
    const { player } = TestUtils.getAll(sim);
    TestUtils.setDefending(sim, [ new Hitmonchan() ]);
    for (const condition of [ SpecialCondition.ASLEEP, SpecialCondition.CONFUSED, SpecialCondition.PARALYZED ]) {
      player.active.specialConditions = [ condition ];
      expect(hp()).toEqual(50);
    }
  });

  it('Should stop being a copy while Muk Toxic Gas is in play', () => {
    const { opponent } = TestUtils.getAll(sim);
    TestUtils.setDefending(sim, [ new Hitmonchan() ]);
    opponent.bench[0].pokemons.cards = [ new Grimer(), new Muk() ];
    expect(hp()).toEqual(50);
  });

  it('Should not be a copy while benched', () => {
    const { player } = TestUtils.getAll(sim);
    TestUtils.setDefending(sim, [ new Hitmonchan() ]);
    const ditto = new Ditto();
    player.bench[0].pokemons.cards = [ ditto ];
    const effect = new CheckHpEffect(player, player.bench[0]);
    sim.store.reduceEffect(sim.store.state, effect);
    expect(effect.hp).toEqual(50);
  });

  it('Should offer the copied card in-play Powers as well as its attacks', () => {
    // the prompt options are what the enableAbility flag controls
    const { player, opponent, prompts } = TestUtils.getAll(sim);
    const mrMime = new MrMime();
    TestUtils.setDefending(sim, [ mrMime ]);
    const ditto = player.active.getPokemonCard() as Ditto;

    sim.store.reduceEffect(sim.store.state, new UsePowerEffect(player, ditto.powers[0], ditto));
    const prompt: any = prompts[prompts.length - 1];
    expect(prompt.options.enableAbility.useWhenInPlay).toBe(true);
    expect(prompt.cards[0]).toBe(opponent.active.getPokemonCard());
  });

  it('Should copy a passive Pokemon Power of the card it is imitating', () => {
    // Mr. Mime Invisible Wall prevents 30 or more, and Ditto should have it too
    const { player, opponent } = TestUtils.getAll(sim);
    TestUtils.setDefending(sim, [ new MrMime() ]);

    const attack = opponent.active.getPokemonCard()!.attacks[0];
    const base = new AttackEffect(opponent, player, attack);
    const damage = new PutDamageEffect(base, 40);
    sim.store.state.phase = GamePhase.ATTACK;
    sim.store.reduceEffect(sim.store.state, damage);

    expect(damage.preventDefault).toBe(true);
  });

  it('Should not copy a passive Power while Asleep', () => {
    const { player, opponent } = TestUtils.getAll(sim);
    TestUtils.setDefending(sim, [ new MrMime() ]);
    player.active.specialConditions = [ SpecialCondition.ASLEEP ];

    const attack = opponent.active.getPokemonCard()!.attacks[0];
    const base = new AttackEffect(opponent, player, attack);
    const damage = new PutDamageEffect(base, 40);
    sim.store.state.phase = GamePhase.ATTACK;
    sim.store.reduceEffect(sim.store.state, damage);

    expect(damage.preventDefault).toBe(false);
  });

  it('Should terminate when both Actives are Ditto', () => {
    TestUtils.setDefending(sim, [ new Ditto() ]);
    expect(hp()).toEqual(50);
  });
});

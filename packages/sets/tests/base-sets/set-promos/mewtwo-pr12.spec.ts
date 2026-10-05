import {
  AttackAction,
  BotFlipMode,
  BotShuffleMode,
  CardTarget,
  CardType,
  ChoosePokemonPrompt,
  MoveEnergyPrompt,
  PlayerType,
  ResolvePromptAction,
  Simulator,
  SlotType,
} from "@ptcg/common";

import { MewtwoPR12 } from "../../../src/base-sets/set-promos/mewtwo-pr12";
import { Mewtwo } from "../../../src/base-sets/set-promos/mewtwo";
import { setPromos } from "../../../src/base-sets/set-promos";
import { PsychicEnergy } from "../../../src/base-sets/set-base/psychic-energy";
import { WaterEnergy } from "../../../src/base-sets/set-base/water-energy";
import { DoubleColorlessEnergy } from "../../../src/base-sets/set-base/double-colorless-energy";
import { Pluspower } from "../../../src/base-sets/set-base/pluspower";
import { Defender } from "../../../src/base-sets/set-base/defender";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

function psychicSensitive(weak: boolean): TestPokemon {
  const card = new TestPokemon();
  if (weak) {
    card.weakness = [ { type: CardType.PSYCHIC } ];
  } else {
    card.resistance = [ { type: CardType.PSYCHIC, value: -30 } ];
  }
  return card;
}

describe('Mewtwo PR12', () => {
  let sim: Simulator;
  const OPP_ACTIVE: CardTarget = { player: PlayerType.TOP_PLAYER, slot: SlotType.ACTIVE, index: 0 };
  const OPP_BENCH = (index: number): CardTarget => ({ player: PlayerType.TOP_PLAYER, slot: SlotType.BENCH, index });

  const setup = (flipMode = BotFlipMode.ALL_HEADS) => {
    sim = TestUtils.createTestSimulator({ flipMode, shuffleMode: BotShuffleMode.REVERSE });
    TestUtils.setActive(sim, [ new MewtwoPR12() ], [ CardType.PSYCHIC, CardType.PSYCHIC, CardType.PSYCHIC ]);
  };

  beforeEach(() => setup());

  const last = <T>(type: new (...args: any[]) => T): T | undefined => {
    const prompts = TestUtils.getAll(sim).prompts.filter(p => p instanceof type);
    return prompts[prompts.length - 1] as unknown as T | undefined;
  };

  it('Should be registered as promo #12, separate from Mewtwo PR (#3)', () => {
    const card = setPromos.find(c => c.fullName === 'Mewtwo PR12') as MewtwoPR12;
    expect(card instanceof MewtwoPR12).toBe(true);
    expect(card.hp).toEqual(60);
    expect(setPromos.find(c => c.fullName === 'Mewtwo PR') instanceof Mewtwo).toBe(true);
  });

  describe('Energy Control', () => {
    let water: WaterEnergy;

    beforeEach(() => {
      const { opponent } = TestUtils.getAll(sim);
      water = new WaterEnergy();
      opponent.active.energies.cards = [ water ];
      opponent.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
    });

    it('Should move a basic Energy card between the opponent\'s Pokemon on heads', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Energy Control'));
      const prompt = last(MoveEnergyPrompt)!;
      expect(prompt.playerId).toEqual(player.id);
      expect(prompt.playerType).toEqual(PlayerType.TOP_PLAYER);

      sim.dispatch(new ResolvePromptAction(prompt.id, [ { from: OPP_ACTIVE, to: OPP_BENCH(0), card: water } ]));
      expect(opponent.active.energies.cards).toEqual([]);
      expect(opponent.bench[0].energies.cards).toEqual([ water ]);
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should do nothing on tails', () => {
      setup(BotFlipMode.ALL_TAILS);
      const { opponent } = TestUtils.getAll(sim);
      opponent.active.energies.cards = [ new WaterEnergy() ];
      opponent.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      sim.dispatch(new AttackAction(1, 'Energy Control'));
      expect(last(MoveEnergyPrompt)).toBeUndefined();
      expect(opponent.active.energies.cards.length).toEqual(1);
    });

    it('Should not accept a Special Energy card', () => {
      const { opponent } = TestUtils.getAll(sim);
      const dce = new DoubleColorlessEnergy();
      opponent.active.energies.cards.push(dce);
      sim.dispatch(new AttackAction(1, 'Energy Control'));
      const prompt = last(MoveEnergyPrompt)!;
      expect(prompt.validate([ { from: OPP_ACTIVE, to: OPP_BENCH(0), card: dce } ])).toBe(false);
      expect(prompt.validate([ { from: OPP_ACTIVE, to: OPP_BENCH(0), card: water } ])).toBe(true);
    });

    it('Should move only one card, and never onto the same Pokemon or the attacker\'s side', () => {
      const { player, opponent } = TestUtils.getAll(sim);
      const second = new WaterEnergy();
      opponent.active.energies.cards.push(second);
      sim.dispatch(new AttackAction(1, 'Energy Control'));
      const prompt = last(MoveEnergyPrompt)!;
      sim.dispatch(new ResolvePromptAction(prompt.id, [
        { from: OPP_ACTIVE, to: OPP_BENCH(0), card: water },
        { from: OPP_ACTIVE, to: OPP_BENCH(0), card: second },
      ]));
      expect(opponent.bench[0].energies.cards).toEqual([ water ]);
      expect(opponent.active.energies.cards).toEqual([ second ]);
      expect(player.active.energies.cards.length).toEqual(3);
    });

    it('Should ignore a move onto the same Pokemon', () => {
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Energy Control'));
      sim.dispatch(new ResolvePromptAction(last(MoveEnergyPrompt)!.id, [ { from: OPP_ACTIVE, to: OPP_ACTIVE, card: water } ]));
      expect(opponent.active.energies.cards).toEqual([ water ]);
    });

    it('Should do nothing when the opponent has only one Pokemon', () => {
      const { opponent } = TestUtils.getAll(sim);
      opponent.bench[0] = TestUtils.pokemonSlot([]);
      sim.dispatch(new AttackAction(1, 'Energy Control'));
      expect(last(MoveEnergyPrompt)).toBeUndefined();
    });

    it('Should do nothing when the opponent has no basic Energy attached', () => {
      const { opponent } = TestUtils.getAll(sim);
      opponent.active.energies.cards = [ new DoubleColorlessEnergy() ];
      sim.dispatch(new AttackAction(1, 'Energy Control'));
      expect(last(MoveEnergyPrompt)).toBeUndefined();
    });
  });

  describe('Telekinesis', () => {
    const choose = (target: 'active' | number) => {
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Telekinesis'));
      const prompt = last(ChoosePokemonPrompt)!;
      expect(prompt.playerType).toEqual(PlayerType.TOP_PLAYER);
      expect(prompt.slots).toEqual([ SlotType.ACTIVE, SlotType.BENCH ]);
      const slot = target === 'active' ? opponent.active : opponent.bench[target];
      sim.dispatch(new ResolvePromptAction(prompt.id, [ slot ]));
    };

    it('Should do 30 to the Defending Pokemon without Weakness', () => {
      TestUtils.setDefending(sim, [ psychicSensitive(true) ]);
      choose('active');
      expect(TestUtils.getAll(sim).opponent.active.damage).toEqual(30);
    });

    it('Should do 30 to the Defending Pokemon without Resistance', () => {
      TestUtils.setDefending(sim, [ psychicSensitive(false) ]);
      choose('active');
      expect(TestUtils.getAll(sim).opponent.active.damage).toEqual(30);
    });

    it('Should do 30 to a Benched Pokemon without Weakness, and nothing to the Defending Pokemon', () => {
      const { opponent } = TestUtils.getAll(sim);
      opponent.bench[2] = TestUtils.pokemonSlot([ psychicSensitive(true) ]);
      choose(2);
      expect(opponent.bench[2].damage).toEqual(30);
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should still apply PlusPower (after Weakness and Resistance) to the Defending Pokemon', () => {
      TestUtils.setDefending(sim, [ psychicSensitive(true) ]);
      TestUtils.getAll(sim).player.active.trainers.cards = [ new Pluspower() ];
      choose('active');
      expect(TestUtils.getAll(sim).opponent.active.damage).toEqual(40);
    });

    it('Should still apply Defender on a Benched target', () => {
      const { opponent } = TestUtils.getAll(sim);
      opponent.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      opponent.bench[0].trainers.cards = [ new Defender() ];
      choose(0);
      expect(opponent.bench[0].damage).toEqual(10);
    });

    it('Should not ignore Weakness for other attacks (flag does not leak)', () => {
      const weak = psychicSensitive(true);
      TestUtils.setDefending(sim, [ weak ]);
      choose('active');
      // A fresh Mewtwo PR #3 Psyburn next: normal Weakness applies
      sim = TestUtils.createTestSimulator();
      TestUtils.setActive(sim, [ new Mewtwo() ], [ CardType.PSYCHIC, CardType.PSYCHIC, CardType.PSYCHIC ]);
      TestUtils.setDefending(sim, [ weak ]);
      TestUtils.getAll(sim).player.active.energies.cards.push(new PsychicEnergy());
      sim.dispatch(new AttackAction(1, 'Psyburn'));
      expect(TestUtils.getAll(sim).opponent.active.damage).toEqual(80);
    });
  });
});

import {
  AttackAction,
  BotFlipMode,
  BotShuffleMode,
  CardType,
  ChoosePokemonPrompt,
  PlayerType,
  ResolvePromptAction,
  Simulator,
  SlotType,
} from "@ptcg/common";

import { MeowthPR10 } from "../../../src/base-sets/set-promos/meowth";
import { setPromos } from "../../../src/base-sets/set-promos";
import { Pluspower } from "../../../src/base-sets/set-base/pluspower";
import { TestPokemon } from "../../test-cards/test-pokemon";
import { TestUtils } from "../../test-utils";

function weakToColorless(): TestPokemon {
  const card = new TestPokemon();
  card.weakness = [ { type: CardType.COLORLESS } ];
  return card;
}

describe('Meowth PR10', () => {
  let sim: Simulator;

  const setup = (flipMode: BotFlipMode) => {
    sim = TestUtils.createTestSimulator({ flipMode, shuffleMode: BotShuffleMode.REVERSE });
    TestUtils.setActive(sim, [ new MeowthPR10() ], [ CardType.COLORLESS, CardType.COLORLESS ]);
    TestUtils.setDefending(sim, [ weakToColorless() ]);
  };

  const choosePrompts = () => TestUtils.getAll(sim).prompts.filter(p => p instanceof ChoosePokemonPrompt) as ChoosePokemonPrompt[];

  it('Should be registered as promo #10', () => {
    expect(setPromos.some(c => c.fullName === 'Meowth PR10')).toBe(true);
  });

  describe('Cat Punch', () => {
    it('Should do 20 damage to the Defending Pokemon on heads, with Weakness', () => {
      setup(BotFlipMode.ALL_HEADS);
      const { opponent } = TestUtils.getAll(sim);
      opponent.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      sim.dispatch(new AttackAction(1, 'Cat Punch'));
      expect(opponent.active.damage).toEqual(40);
      expect(opponent.bench[0].damage).toEqual(0);
      expect(choosePrompts().length).toEqual(0);
    });

    it('Should apply Resistance on heads', () => {
      setup(BotFlipMode.ALL_HEADS);
      const resistant = new TestPokemon();
      resistant.resistance = [ { type: CardType.COLORLESS, value: -30 } ];
      TestUtils.setDefending(sim, [ resistant ]);
      sim.dispatch(new AttackAction(1, 'Cat Punch'));
      expect(TestUtils.getAll(sim).opponent.active.damage).toEqual(0);
    });

    it('Should let the opponent choose a Benched Pokemon on tails, 20 damage without Weakness', () => {
      setup(BotFlipMode.ALL_TAILS);
      const { opponent } = TestUtils.getAll(sim);
      opponent.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      opponent.bench[1] = TestUtils.pokemonSlot([ weakToColorless() ]);
      sim.dispatch(new AttackAction(1, 'Cat Punch'));

      const prompt = choosePrompts()[0];
      expect(prompt).toBeDefined();
      expect(prompt.playerId).toEqual(opponent.id);
      expect(prompt.playerType).toEqual(PlayerType.BOTTOM_PLAYER);
      expect(prompt.slots).toEqual([ SlotType.BENCH ]);

      sim.dispatch(new ResolvePromptAction(prompt.id, [ opponent.bench[1] ]));
      expect(opponent.bench[1].damage).toEqual(20);
      expect(opponent.bench[0].damage).toEqual(0);
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should not add PlusPower to the Benched damage', () => {
      setup(BotFlipMode.ALL_TAILS);
      const { player, opponent } = TestUtils.getAll(sim);
      player.active.trainers.cards = [ new Pluspower() ];
      opponent.bench[0] = TestUtils.pokemonSlot([ new TestPokemon() ]);
      sim.dispatch(new AttackAction(1, 'Cat Punch'));
      sim.dispatch(new ResolvePromptAction(choosePrompts()[0].id, [ opponent.bench[0] ]));
      expect(opponent.bench[0].damage).toEqual(20);
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should do nothing on tails when the opponent has no Benched Pokemon', () => {
      setup(BotFlipMode.ALL_TAILS);
      const { opponent } = TestUtils.getAll(sim);
      sim.dispatch(new AttackAction(1, 'Cat Punch'));
      expect(choosePrompts().length).toEqual(0);
      expect(opponent.active.damage).toEqual(0);
    });

    it('Should add PlusPower on heads (Defending Pokemon)', () => {
      setup(BotFlipMode.ALL_HEADS);
      const { player, opponent } = TestUtils.getAll(sim);
      player.active.trainers.cards = [ new Pluspower() ];
      sim.dispatch(new AttackAction(1, 'Cat Punch'));
      expect(opponent.active.damage).toEqual(50);
    });
  });
});

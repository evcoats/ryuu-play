import {
  Attack,
  AttackEffect,
  ChooseAttackPrompt,
  Effect,
  GameLog,
  GameMessage,
  PokemonCard,
  State,
  StateUtils,
  StoreLike,
} from '@ptcg/common';

import { CommonAttack } from '../common.interfaces';

export const metronome: CommonAttack = function(
  self: PokemonCard,
  store: StoreLike,
  state: State,
  effect: Effect
) {

  return {
    use: (attackEffect: AttackEffect) => {
      const player = attackEffect.player;
      const opponent = StateUtils.getOpponent(state, player);

      // Choose an opponent's Pokemon attack
      const pokemonCard = opponent.active.getPokemonCard();
      if (pokemonCard === undefined || pokemonCard.attacks.length === 0) {
        return state;
      }

      // Metronome can't copy Metronome: against another Clefairy / Clefable the copy would
      // prompt again with the same choice, without end. Whatever a chain of copies ends on can
      // be copied directly, so nothing else is lost.
      const blocked = pokemonCard.attacks
        .filter(a => a.name === 'Metronome')
        .map(a => ({ index: 0, name: a.name }));
      if (blocked.length === pokemonCard.attacks.length) {
        return state;
      }

      return store.prompt(
        state,
        new ChooseAttackPrompt(player.id, GameMessage.CHOOSE_ATTACK_TO_COPY, [pokemonCard], {
          allowCancel: true,
          blocked,
        }),
        result => {
          if (result !== null) {
            const attack = result as Attack;
            store.log(state, GameLog.LOG_PLAYER_COPIES_ATTACK, { name: player.name, attack: attack.name });
            const copiedAttackEffect = new AttackEffect(player, opponent, attack);
            store.reduceEffect(state, copiedAttackEffect);
            store.waitPrompt(state, () => {
              attackEffect.damage = copiedAttackEffect.damage;
            });
          }
        }
      );
    }
  };

};

export class Rules {

  public formatName = '';

  public firstTurnDrawCard = true;

  public firstTurnUseSupporter = true;
  
  public noPrizeForFossil = true;

  // Trainer cards tagged as Fossils may be chosen as starting Pokemon. Off for the Base-era
  // rules, where Mysterious Fossil is a Trainer in hand and a hand without a Basic mulligans.
  public fossilsAsStarters = true;

  // Cards the opponent may draw for each mulligan (1 today; 2 in the Base-era rules).
  public mulliganDrawCards = 1;

  // Confusion as in the Base-era rules (2000). A Confused Pokemon that flips tails when it attacks
  // attacks itself for 20 damage: its own Weakness and Resistance apply, and so do damage effects
  // such as Defender. Retreating it takes a coin flip after the Retreat Cost is paid; on tails it
  // stays Active and can't try again that turn. Off (the later rules): 30 damage with no Weakness
  // or Resistance, and no flip to retreat.
  public baseEraConfusion = false;

  constructor(init: Partial<Rules> = {}) {
    Object.assign(this, init);
  }

}

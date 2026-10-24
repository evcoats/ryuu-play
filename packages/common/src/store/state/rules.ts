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

  constructor(init: Partial<Rules> = {}) {
    Object.assign(this, init);
  }

}

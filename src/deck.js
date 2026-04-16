// Характеристики карт
export const COLORS = ['green', 'red', 'purple'];
export const SHAPES = ['rectangle', 'oval', 'wave'];
export const COUNTS = [1, 2, 3];
export const FILLS = ['empty', 'solid', 'striped'];

export class Card {
  constructor(color, shape, count, fill) {
    this.color = color;
    this.shape = shape;
    this.count = count;
    this.fill = fill;
    this.id = `${color}-${shape}-${count}-${fill}`;
  }
  equals(other) { return this.id === other.id; }
}

export function generateDeck() {
  const deck = [];
  for (const color of COLORS)
    for (const shape of SHAPES)
      for (const count of COUNTS)
        for (const fill of FILLS)
          deck.push(new Card(color, shape, count, fill));
  return deck;
}

export function shuffleDeck(deck) {
  const s = [...deck];
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

function checkAttr(a, b, c) {
  return (a === b && b === c) || (a !== b && b !== c && a !== c);
}

export function isValidSet(c1, c2, c3) {
  return checkAttr(c1.color, c2.color, c3.color) &&
         checkAttr(c1.shape, c2.shape, c3.shape) &&
         checkAttr(c1.count, c2.count, c3.count) &&
         checkAttr(c1.fill, c2.fill, c3.fill);
}

export function findAllSets(cards) {
  const sets = [];
  for (let i = 0; i < cards.length - 2; i++)
    for (let j = i + 1; j < cards.length - 1; j++)
      for (let k = j + 1; k < cards.length; k++)
        if (isValidSet(cards[i], cards[j], cards[k]))
          sets.push([cards[i], cards[j], cards[k]]);
  return sets;
}

export function hasSetOnBoard(cards) { return findAllSets(cards).length > 0; }

export function findRandomSet(cards) {
  const all = findAllSets(cards);
  return all.length === 0 ? null : all[Math.floor(Math.random() * all.length)];
}

// Сериализация/десериализация для передачи через Ably
export function serializeCard(card) { return card.id; }

export function deserializeCard(id) {
  const [color, shape, count, fill] = id.split('-');
  return new Card(color, shape, parseInt(count), fill);
}

export function deserializeCards(ids) { return ids.map(deserializeCard); }

// Создать начальное состояние игры (сериализованное)
export function createInitialGameState() {
  const deck = shuffleDeck(generateDeck());
  const board = deck.splice(0, 12);
  return {
    deckIds: deck.map(c => c.id),
    boardIds: board.map(c => c.id),
    scores: { player1: 0, player2: 0 },
    errors: { player1: 0, player2: 0 },
    setTimes: { player1: [], player2: [] },
    startTime: Date.now(),
    lastSetTime: Date.now(),
    gameOver: false,
    version: 0, // optimistic lock
  };
}

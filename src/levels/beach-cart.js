import { beachCart, deckChair } from '../obstacles/index.js';

// Boardwalk, section 4: an ice cream cart, then a deck chair. Ollie each one, grind the cart's top edge
// (CART GRIND) or the chair's (CHAIR SLIDE), or slappy the low chair with the finger held.
export default {
  id: 'beach-cart',
  name: 'Ice Cream Cart',
  obstacles: [beachCart({ x: 330 }), deckChair({ x: 700 })],
};

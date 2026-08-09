/* Calm King — handcrafted levels.
 *
 * Map legend (7 rows x 7 chars):
 *   .  open floor        #  wall
 *   E  the gate (exit)   o  cradle  — pieces stack here, and it catches rollers
 *   ~  slick ice         — anything standing on it slides once the board leans
 *   x  fragile floor     — gives way when the last piece steps off it
 *   > < ^ v  one-way ledge — may only be entered moving the way it points
 *   d  portcullis        — passable only while every plate is loaded
 *   1 2 4  pressure plate — needs that much weight standing on it
 *   L  locked block      — a wall until a royal walks into it carrying a key,
 *                          which spends the key and leaves plain floor
 *
 * The key itself is a piece (`{ type: 'key' }`), not a map character. It
 * weighs 1, nothing but the King or Queen can shift it, and it is picked up
 * by walking onto it — from then on its weight travels with whoever has it.
 *
 * pivot is a column index; torque = sum of weight * (col - pivot).
 * capacity is the torque the frame can hold. |torque| >= capacity tips the board.
 *
 * `par` holds the crown targets: three crowns at `three` moves or fewer,
 * two crowns at `two` or fewer, one crown for finishing at all.
 * Those numbers come from tools/verify.mjs, which brute-forces every level.
 */
(function (root) {
  'use strict';

  var LEVELS = [
    {
      id: 1,
      chapter: 1,
      title: 'The Quiet Gate',
      teach: 'Click the King, then a lit tile. Walk him to the gate.',
      idea: 'Selection, movement, and the fact that the board answers you.',
      capacity: 10,
      map: [
        '#######',
        '#######',
        '#.....#',
        '#....E#',
        '#.....#',
        '#######',
        '#######'
      ],
      pieces: [{ id: 'k', type: 'king', col: 1, row: 3 }],
      par: { three: 4, two: 6 }
    },

    {
      id: 2,
      chapter: 1,
      title: 'A Little Lean',
      teach: 'Every piece has weight. Watch the frame as the King walks.',
      idea: 'Distance from the pivot changes the tilt. Still perfectly safe.',
      capacity: 9,
      map: [
        '#######',
        '#######',
        '#.....#',
        '#####.#',
        '#.....E',
        '#######',
        '#######'
      ],
      pieces: [{ id: 'k', type: 'king', col: 1, row: 2 }],
      par: { three: 7, two: 10 }
    },

    {
      id: 3,
      chapter: 1,
      title: 'The Counterweight',
      teach: 'You can move any piece, not only the King. ' +
             'Click the stone \u2014 or press Tab to cycle through the pieces.',
      teachUntil: 'other',
      idea: 'Walking straight to the gate tips the board. Move the stone first.',
      capacity: 8,
      map: [
        '#######',
        '#######',
        '#.....#',
        '#######',
        '#.....E',
        '#######',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 4 },
        { id: 's', type: 'stone', col: 4, row: 2 }
      ],
      par: { three: 6, two: 8 }
    },

    {
      id: 4,
      chapter: 1,
      title: 'Farther Matters More',
      teach: 'Weight matters. Distance from the centre matters just as much.',
      idea: 'One light barrel out at the rim outweighs the statue standing near it.',
      capacity: 8,
      map: [
        '#######',
        '#####.#',
        '#######',
        '#....E#',
        '#######',
        '.......',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'v', type: 'statue', col: 5, row: 1 },
        { id: 'b', type: 'barrel', col: 3, row: 5 }
      ],
      par: { three: 7, two: 10 }
    },

    {
      id: 5,
      chapter: 1,
      title: 'The Heavy Stone',
      teach: 'The thing in your way may be the thing holding you up.',
      idea: 'Take the long way round so you can shove the iron the useful direction.',
      capacity: 6,
      map: [
        '#######',
        '#######',
        '#.....#',
        '#.###.#',
        '#.....E',
        '#######',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 4 },
        { id: 'i', type: 'iron', col: 3, row: 4 }
      ],
      par: { three: 10, two: 14 }
    },

    {
      id: 6,
      chapter: 1,
      title: 'Share the Load',
      teach: 'A cradle will hold more than one piece. Their weight adds up.',
      teachUntil: 'stack',
      idea: 'One barrel at the rim is not enough. Two barrels in one cradle are.',
      capacity: 7,
      map: [
        '#######',
        '#####.#',
        '#######',
        '#.....E',
        '#######',
        'o......',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'v', type: 'statue', col: 5, row: 1 },
        { id: 'a', type: 'barrel', col: 2, row: 5 },
        { id: 'b', type: 'barrel', col: 4, row: 5 }
      ],
      par: { three: 9, two: 13 }
    },

    {
      id: 7,
      chapter: 1,
      title: 'The Push',
      teach: 'Walk a piece into another and it shoves it along. One move, two pieces.',
      teachUntil: 'push',
      idea: 'The stone can only go east, and the King is going east anyway.',
      capacity: 12,
      map: [
        '#######',
        '#####.#',
        '####.##',
        '#.....E',
        '#######',
        'o......',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'v', type: 'statue', col: 5, row: 1 },
        { id: 's', type: 'stone', col: 2, row: 3 },
        { id: 'b', type: 'barrel', col: 3, row: 5 }
      ],
      par: { three: 9, two: 13 }
    },

    {
      id: 8,
      chapter: 1,
      title: 'Back Before Forward',
      teach: 'Sometimes the safest move is backward.',
      idea: 'The gate is east. The only road out of this chamber runs west.',
      capacity: 11,
      map: [
        '#######',
        '#######',
        '......#',
        '#.#####',
        '#.....E',
        '#######',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 5, row: 2 },
        { id: 's', type: 'stone', col: 2, row: 2 }
      ],
      par: { three: 11, two: 15 }
    },

    {
      id: 9,
      chapter: 1,
      title: 'Edge of the Kingdom',
      teach: 'Careful is not the same as lost. A leaning board can still be saved.',
      idea: 'The frame will go critical on the way through. Know how you get back.',
      capacity: 7,
      map: [
        '#######',
        '#.....#',
        '#.###.#',
        '#.....#',
        '#.###.#',
        '#.....E',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'i', type: 'iron', col: 5, row: 1 },
        { id: 's', type: 'stone', col: 3, row: 3 },
        { id: 'b', type: 'barrel', col: 5, row: 5 }
      ],
      par: { three: 13, two: 18 }
    },

    {
      id: 10,
      chapter: 1,
      title: 'The First Trial',
      teach: '',
      idea: 'Everything so far, in one chamber.',
      capacity: 7,
      map: [
        '#######',
        '#.....#',
        '#.#.#.#',
        'o.....E',
        '#.#.#.#',
        '#.....#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 5 },
        { id: 'v', type: 'statue', col: 5, row: 1 },
        { id: 'i', type: 'iron', col: 3, row: 3 },
        { id: 'b', type: 'barrel', col: 2, row: 5 },
        { id: 's', type: 'stone', col: 4, row: 1 }
      ],
      par: { three: 9, two: 13 }
    },

    {
      id: 11,
      chapter: 2,
      title: 'The Rolling Court',
      teach: 'A marble will not stand still on a leaning board. A cradle catches it.',
      teachUntil: 'slide',
      idea: 'Secure the marble before the board leans, or it runs away with the level.',
      capacity: 10,
      map: [
        '#######',
        'o.....o',
        '#######',
        '#.....E',
        '#######',
        '#.....#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'm', type: 'marble', col: 4, row: 1, w: 2 },
        { id: 'i', type: 'iron', col: 5, row: 5 }
      ],
      par: { three: 8, two: 11 }
    },

    {
      id: 12,
      chapter: 2,
      title: 'Stone and Silence',
      teach: 'Statues never move. Everything else has to answer for them.',
      idea: 'The iron can only travel west while the King is holding down the east.',
      capacity: 6,
      map: [
        '#######',
        '#.....#',
        '#.###.#',
        'o.....E',
        '#.###.#',
        '#.....#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'v', type: 'statue', col: 4, row: 1 },
        { id: 'w', type: 'statue', col: 4, row: 5 },
        { id: 'i', type: 'iron', col: 3, row: 3 },
        { id: 'b', type: 'barrel', col: 2, row: 5 }
      ],
      par: { three: 15, two: 21 }
    },

    {
      id: 13,
      chapter: 2,
      title: "The King's Long Walk",
      teach: 'Ice holds nothing. Whatever stands on it travels downhill with the board.',
      teachUntil: 'slide',
      idea: 'The King cannot walk the ice. Set the lean and let the board carry him home.',
      capacity: 6,
      map: [
        '#######',
        'o.....#',
        '#.###.#',
        '#.~~~~E',
        '#.###.#',
        '#.....#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 5 },
        { id: 'm', type: 'marble', col: 4, row: 1, w: 2 },
        { id: 'b', type: 'barrel', col: 2, row: 1 },
        { id: 'i', type: 'iron', col: 5, row: 5 },
        { id: 's', type: 'stone', col: 2, row: 5 }
      ],
      par: { three: 10, two: 14 }
    },

    /* ------------------------------------------- chapter II: loose ground */

    {
      id: 14,
      chapter: 2,
      title: 'No Way Back',
      teach: 'An arrow is a one-way ledge. Whatever crosses it cannot come back.',
      teachUntil: 'oneway',
      idea: 'The iron has to go the long way round, because the short way only runs east.',
      capacity: 6,
      map: [
        '#######',
        '#######',
        '#.....#',
        '#.###.#',
        '#..>..E',
        '#######',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 4 },
        { id: 'i', type: 'iron', col: 4, row: 4 }
      ],
      par: { three: 11, two: 15 }
    },

    {
      id: 15,
      chapter: 2,
      title: 'The Wrong Side',
      teach: '',
      idea: 'The stone is trapped east of the ledge. Only the barrel can reach the rim.',
      capacity: 6,
      map: [
        '#######',
        '#.....#',
        '#######',
        '#.....E',
        '#######',
        '#.>...#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'b', type: 'barrel', col: 3, row: 1 },
        { id: 's', type: 'stone', col: 4, row: 5 }
      ],
      par: { three: 7, two: 10 }
    },

    {
      id: 16,
      chapter: 2,
      title: 'Thin Floors',
      teach: 'Cracked floor gives way the moment the last piece steps off it.',
      teachUntil: 'break',
      idea: 'Two travellers going opposite ways, and exactly two crossings.',
      capacity: 6,
      map: [
        '#######',
        '#######',
        '#..xx.#',
        '#.###.#',
        '#..xx.E',
        '#######',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 4 },
        { id: 's', type: 'stone', col: 5, row: 2 }
      ],
      par: { three: 8, two: 11 }
    },

    {
      id: 17,
      chapter: 2,
      title: 'Carry It With You',
      teach: 'Push a piece and you cross together. Send it ahead alone and the floor goes with it.',
      idea: 'The stone keeps the bridge alive only while the King is right behind it.',
      capacity: 7,
      map: [
        '#######',
        '#######',
        '#E#####',
        '..xx..#',
        '#######',
        '.......',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 5, row: 3 },
        { id: 's', type: 'stone', col: 4, row: 3 },
        { id: 'i', type: 'iron', col: 1, row: 5 }
      ],
      par: { three: 8, two: 11 }
    },

    {
      id: 18,
      chapter: 2,
      title: 'The Long Way Round',
      teach: '',
      idea: 'The iron must walk the whole ring, shoving everything ahead of it.',
      capacity: 5,
      map: [
        '#######',
        '#.....#',
        '#.###.#',
        '#.###.#',
        '#.###.#',
        '#..>..E',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 5 },
        { id: 'i', type: 'iron', col: 4, row: 5 },
        { id: 's', type: 'stone', col: 2, row: 1 },
        { id: 'b', type: 'barrel', col: 4, row: 1 }
      ],
      par: { three: 12, two: 17 }
    },

    {
      id: 19,
      chapter: 2,
      title: 'Steady Underfoot',
      teach: 'Ice only holds while the meter reads Steady.',
      idea: 'Level the board before the first step, or the ice takes the decision from you.',
      capacity: 10,
      map: [
        '#######',
        '#####.#',
        '#######',
        '#.~~~.E',
        '#######',
        '.......',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'v', type: 'statue', col: 5, row: 1 },
        { id: 'b', type: 'barrel', col: 3, row: 5 }
      ],
      par: { three: 6, two: 8 }
    },

    {
      id: 20,
      chapter: 2,
      title: 'The Second Trial',
      teach: '',
      idea: 'One ring, one crossing that crumbles, and a marble that will not wait.',
      capacity: 5,
      map: [
        '#######',
        'o..xx.#',
        '#.###.#',
        '#.###.#',
        '#.###.#',
        '#..>..E',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 5 },
        { id: 'i', type: 'iron', col: 4, row: 5 },
        { id: 'm', type: 'marble', col: 2, row: 1, w: 2 }
      ],
      par: { three: 12, two: 17 }
    },

    /* ------------------------------------------ chapter III: locked halls */

    {
      id: 21,
      chapter: 3,
      title: 'The Weighted Gate',
      teach: 'Weight on a plate lifts the portcullis. Holding a gate open costs you balance.',
      teachUntil: 'gate',
      idea: 'The plate sits out at the rim, so the gate is never free.',
      capacity: 9,
      map: [
        '#######',
        '#....1#',
        '#.#####',
        '#..d..E',
        '#######',
        '#######',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'b', type: 'barrel', col: 2, row: 1 }
      ],
      par: { three: 8, two: 11 }
    },

    {
      id: 22,
      chapter: 3,
      title: 'Do Not Move That',
      teach: 'A gate stays up only while its plate stays loaded.',
      idea: 'The barrel is already doing its job. Find your counterweight somewhere else.',
      capacity: 6,
      map: [
        '#######',
        '#....1#',
        '#.#####',
        '#..d..E',
        '#.#####',
        '.......',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'b', type: 'barrel', col: 5, row: 1 },
        { id: 's', type: 'stone', col: 3, row: 5 }
      ],
      par: { three: 7, two: 10 }
    },

    {
      id: 23,
      chapter: 3,
      title: 'The Iron Key',
      teach: 'The number stamped on a plate is the weight it needs.',
      idea: 'Only the iron is heavy enough, and the plate sits where the iron is worth nothing.',
      capacity: 8,
      map: [
        '#######',
        '#..4..#',
        '#.#####',
        '#..d..E',
        '#.#####',
        '.......',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'i', type: 'iron', col: 3, row: 5 },
        { id: 's', type: 'stone', col: 4, row: 5 }
      ],
      par: { three: 15, two: 21 }
    },

    {
      id: 24,
      chapter: 3,
      title: 'Heavy Enough',
      teach: '',
      idea: 'The barrel is nearer, but it will never be heavy enough. The stone walks the long way.',
      capacity: 10,
      map: [
        '#######',
        '#...2##',
        '#.#####',
        '#..d..E',
        '#.#####',
        '.......',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'b', type: 'barrel', col: 1, row: 1 },
        { id: 's', type: 'stone', col: 4, row: 5 }
      ],
      par: { three: 19, two: 27 }
    },

    {
      id: 25,
      chapter: 3,
      title: 'The Short Hall',
      teach: '',
      idea: 'The gate only has to be up at the moment you step under it.',
      capacity: 8,
      map: [
        '#######',
        '#######',
        '#...2.#',
        '#.#####',
        '#..d..E',
        '#######',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 4 },
        { id: 's', type: 'stone', col: 3, row: 2 }
      ],
      par: { three: 7, two: 10 }
    },

    {
      id: 26,
      chapter: 3,
      title: 'Two Locks',
      teach: 'Every plate on the board must be loaded before anything opens.',
      idea: 'Two plates, and only one piece light enough for the near one.',
      capacity: 9,
      map: [
        '#######',
        '#1..2.#',
        '#.#####',
        '#..d..E',
        '#.#####',
        '.......',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'i', type: 'iron', col: 2, row: 5 },
        { id: 'b', type: 'barrel', col: 4, row: 5 },
        { id: 's', type: 'stone', col: 5, row: 5 }
      ],
      par: { three: 17, two: 24 }
    },

    {
      id: 27,
      chapter: 3,
      title: 'One Trip Only',
      teach: '',
      idea: 'Whatever you send up to that plate is never coming back west.',
      capacity: 9,
      map: [
        '#######',
        '#.>..2#',
        '#.#####',
        '#..d..E',
        '#.#####',
        '.......',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 's', type: 'stone', col: 2, row: 5 },
        { id: 'i', type: 'iron', col: 4, row: 5 }
      ],
      par: { three: 16, two: 22 }
    },

    {
      id: 28,
      chapter: 3,
      title: 'Across and Staying',
      teach: '',
      idea: 'The floor to the plate holds for one crossing, so the stone is committed for good.',
      capacity: 9,
      map: [
        '#######',
        '#.xx.2#',
        '#.#####',
        '#..d..E',
        '#.#####',
        '.......',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 's', type: 'stone', col: 1, row: 1 },
        { id: 'i', type: 'iron', col: 4, row: 5 }
      ],
      par: { three: 11, two: 15 }
    },

    {
      id: 29,
      chapter: 3,
      title: 'Every Door Costs',
      teach: '',
      idea: 'A crumbling bridge east, a ledge west, and a gate that wants paying for.',
      capacity: 8,
      map: [
        '#######',
        '#.xx.2#',
        '#.#####',
        '#..d..E',
        '#.#####',
        '#.<....',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 's', type: 'stone', col: 1, row: 1 },
        { id: 'i', type: 'iron', col: 4, row: 5 },
        { id: 'b', type: 'barrel', col: 6, row: 5 }
      ],
      par: { three: 12, two: 17 }
    },

    {
      id: 30,
      chapter: 3,
      title: 'The Whole Kingdom',
      teach: '',
      idea: 'Everything the kingdom has taught you, in one room, with nothing to spare.',
      capacity: 6,
      map: [
        '#######',
        'o..x..#',
        '#.##..#',
        '#.##4.E',
        '#.##..#',
        '#..d..#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 5 },
        { id: 'i', type: 'iron', col: 2, row: 1 },
        { id: 's', type: 'stone', col: 5, row: 5 }
      ],
      par: { three: 28, two: 39 }
    },

    /* ------------------------------------------ chapter IV: the brass keys */

    {
      id: 31,
      chapter: 4,
      title: 'The Key and the Block',
      teach: 'A locked block will not shift for anything. Walk a royal onto the key to ' +
             'pick it up, then into the block to spend it.',
      teachUntil: 'lock',
      idea: 'The key is behind you, the gate is in front, and the key weighs ' +
            'something.',
      capacity: 7,
      map: [
        '#######',
        '#######',
        '#.....#',
        '#....LE',
        '#.....#',
        '#######',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 4, row: 3 },
        { id: 'y', type: 'key', col: 1, row: 3 },
        { id: 'i', type: 'iron', col: 2, row: 3 }
      ],
      par: { three: 10, two: 14 }
    },

    {
      id: 32,
      chapter: 4,
      title: 'The Gate Behind You',
      teach: 'Only the King and Queen can lift a key. Nothing else on the board will ' +
             'even nudge it.',
      teachUntil: 'key',
      idea: 'Home is west now. Everything the kingdom taught you about leaning is ' +
            'backwards.',
      capacity: 13,
      map: [
        '#######',
        '#.#.#.#',
        '#.....#',
        'EL.....',
        '#.....#',
        '#.#.#.#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 5, row: 3 },
        { id: 'y', type: 'key', col: 3, row: 1 },
        { id: 'i', type: 'iron', col: 1, row: 1 },
        { id: 'v', type: 'statue', col: 1, row: 5 }
      ],
      par: { three: 12, two: 17 }
    },

    {
      id: 33,
      chapter: 4,
      title: 'The Four Arms',
      teach: '',
      idea: 'The gate is up the north arm. The weight that gets you there lives out ' +
            'on the others.',
      capacity: 4,
      map: [
        '###E###',
        '###L###',
        '#.....#',
        '.......',
        '#.....#',
        '###.###',
        '###.###'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 0, row: 3 },
        { id: 'y', type: 'key', col: 5, row: 4 },
        { id: 'i', type: 'iron', col: 4, row: 2 },
        { id: 'b', type: 'barrel', col: 3, row: 4 }
      ],
      par: { three: 14, two: 20 }
    },

    {
      id: 34,
      chapter: 4,
      title: 'Winding In',
      teach: '',
      idea: 'The road curls inward, and the plank on the way is good for one ' +
            'crossing.',
      capacity: 5,
      map: [
        '#######',
        '#.....#',
        '#.###.#',
        '#.#E#.#',
        '#.#L#.#',
        '#x..#.#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'y', type: 'key', col: 2, row: 1 },
        { id: 'i', type: 'iron', col: 5, row: 5 },
        { id: 's', type: 'stone', col: 3, row: 1 }
      ],
      par: { three: 15, two: 21 }
    },

    {
      id: 35,
      chapter: 4,
      title: 'Two Shores',
      teach: '',
      idea: 'The key is on the wrong shore, and the only bridge runs through the ' +
            'block.',
      capacity: 6,
      map: [
        '#######',
        '#..#..#',
        '#..#..#',
        '#..L..E',
        '#..#..#',
        '#..#..#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'y', type: 'key', col: 1, row: 5 },
        { id: 'i', type: 'iron', col: 5, row: 2 },
        { id: 'b', type: 'barrel', col: 1, row: 3 }
      ],
      par: { three: 16, two: 22 }
    },

    {
      id: 36,
      chapter: 4,
      title: 'The Neck',
      teach: '',
      idea: 'The room narrows to one cold tile, and you come back heavier than you ' +
            'went.',
      capacity: 4,
      map: [
        '#######',
        '#.....#',
        '#.....#',
        '##.~.##',
        '###L###',
        '###.###',
        '###E###'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'y', type: 'key', col: 4, row: 3 },
        { id: 'i', type: 'iron', col: 3, row: 5 },
        { id: 'm', type: 'marble', col: 4, row: 1, w: 2 }
      ],
      par: { three: 16, two: 22 }
    },

    {
      id: 37,
      chapter: 4,
      title: 'Among the Pillars',
      teach: '',
      idea: 'Two cradles, one marble, and a block that wants your hands full.',
      capacity: 6,
      map: [
        '#######',
        '#....o#',
        '#.#.#.#',
        '#....LE',
        '#.#.#.#',
        '#o....#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'y', type: 'key', col: 5, row: 5 },
        { id: 'i', type: 'iron', col: 3, row: 4 },
        { id: 'm', type: 'marble', col: 5, row: 4, w: 2 }
      ],
      par: { three: 18, two: 25 }
    },

    {
      id: 38,
      chapter: 4,
      title: 'Down the Stair',
      teach: '',
      idea: 'Every step down the stair is a step further out from the post.',
      capacity: 12,
      map: [
        '#######',
        '#..####',
        '#..####',
        '##.L###',
        '###..##',
        '####..E',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'y', type: 'key', col: 2, row: 1 },
        { id: 'i', type: 'iron', col: 3, row: 4 },
        { id: 'b', type: 'barrel', col: 1, row: 2 }
      ],
      par: { three: 20, two: 28 }
    },

    {
      id: 39,
      chapter: 4,
      title: 'Between the Teeth',
      teach: '',
      idea: 'Three deep teeth. Whatever you leave standing in one is staying there.',
      capacity: 6,
      map: [
        '#######',
        '#..L..#',
        '#.#.#.#',
        '#.#.#.#',
        '#.#.#.E',
        '#.#.#.#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'y', type: 'key', col: 1, row: 5 },
        { id: 'i', type: 'iron', col: 4, row: 1 },
        { id: 's', type: 'stone', col: 3, row: 5 }
      ],
      par: { three: 20, two: 28 }
    },

    {
      id: 40,
      chapter: 4,
      title: 'The Third Trial',
      teach: '',
      idea: 'A plate, a portcullis and a block, down three shafts that never line up.',
      capacity: 9,
      map: [
        '#######',
        '#2#...#',
        '#.#.#d#',
        '#...#.#',
        '#.#...#',
        '#.#.#L#',
        '#...#.E'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'y', type: 'key', col: 4, row: 1 },
        { id: 'i', type: 'iron', col: 1, row: 6 },
        { id: 's', type: 'stone', col: 5, row: 6 }
      ],
      par: { three: 21, two: 29 }
    },

    /* --------------------------------------- chapter V: the Queen's road */

    {
      id: 41,
      chapter: 5,
      title: 'The Queen',
      teach: 'The Queen travels with you now. The gate holds them both — and it is not ' +
             'over until both are standing in it.',
      teachUntil: 'royal',
      idea: 'She weighs almost nothing, which is the whole of her problem.',
      capacity: 4,
      map: [
        '#######',
        '#.....#',
        '#.###.#',
        '#.###.E',
        '#.###.#',
        '#.....#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'q', type: 'queen', col: 3, row: 1 },
        { id: 'i', type: 'iron', col: 5, row: 2 },
        { id: 'b', type: 'barrel', col: 1, row: 4 }
      ],
      par: { three: 15, two: 21 }
    },

    {
      id: 42,
      chapter: 5,
      title: 'Every Crown Costs',
      teach: '',
      idea: 'A plate, a portcullis, a block and one key, for two people who both have ' +
            'to get through all of it.',
      capacity: 12,
      map: [
        '#######',
        '#.#2#.#',
        '#.....#',
        '#..d.LE',
        '#.....#',
        '#.#.#.#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'q', type: 'queen', col: 1, row: 4 },
        { id: 'y', type: 'key', col: 3, row: 5 },
        { id: 'i', type: 'iron', col: 2, row: 4 }
      ],
      par: { three: 14, two: 20 }
    },

    {
      id: 43,
      chapter: 5,
      title: 'After You',
      teach: '',
      idea: 'The floor holds for one of them. Decide early which one.',
      capacity: 13,
      map: [
        '#######',
        '#..#..#',
        '#...x##',
        '#.##..#',
        '##x..##',
        '#..#..E',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'q', type: 'queen', col: 2, row: 5 },
        { id: 'i', type: 'iron', col: 2, row: 2 },
        { id: 's', type: 'stone', col: 2, row: 1 }
      ],
      par: { three: 15, two: 21 }
    },

    {
      id: 44,
      chapter: 5,
      title: 'The Long Slide',
      teach: '',
      idea: 'Set the lean and the ice delivers her. Getting him across is the hard ' +
            'part.',
      capacity: 4,
      map: [
        '#######',
        'o....4#',
        '#.#.#.#',
        '#.~~~.#',
        '#.#.#d#',
        '#.....E',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 5 },
        { id: 'q', type: 'queen', col: 5, row: 2 },
        { id: 'i', type: 'iron', col: 5, row: 3 },
        { id: 's', type: 'stone', col: 1, row: 4 }
      ],
      par: { three: 16, two: 22 }
    },

    {
      id: 45,
      chapter: 5,
      title: 'Separate Roads',
      teach: '',
      idea: 'Both ledges drop. Whoever goes down first is not coming back to help.',
      capacity: 7,
      map: [
        '#######',
        '#.....#',
        '####v##',
        '#.....#',
        '##v####',
        '#.....E',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'q', type: 'queen', col: 3, row: 5 },
        { id: 'i', type: 'iron', col: 2, row: 1 },
        { id: 's', type: 'stone', col: 5, row: 3 }
      ],
      par: { three: 17, two: 24 }
    },

    {
      id: 46,
      chapter: 5,
      title: 'Two Crowns, One Frame',
      teach: '',
      idea: 'Whichever of them moves, the other one pays for it.',
      capacity: 10,
      map: [
        '#######',
        '#2....#',
        '#....##',
        '##....#',
        '#.....#',
        '#....dE',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 2, row: 1 },
        { id: 'q', type: 'queen', col: 1, row: 5 },
        { id: 'i', type: 'iron', col: 5, row: 4 },
        { id: 'v', type: 'statue', col: 1, row: 4 }
      ],
      par: { three: 18, two: 25 }
    },

    {
      id: 47,
      chapter: 5,
      title: 'One Trip, Two Crowns',
      teach: '',
      idea: 'The gate is in the north wall and the marble is already leaning that ' +
            'way.',
      capacity: 12,
      map: [
        '###E###',
        '#..L..#',
        '#.###.#',
        '#.....#',
        '#.###.#',
        '#o....#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 5 },
        { id: 'q', type: 'queen', col: 3, row: 5 },
        { id: 'y', type: 'key', col: 1, row: 2 },
        { id: 'm', type: 'marble', col: 1, row: 1, w: 2 }
      ],
      par: { three: 19, two: 27 }
    },

    {
      id: 48,
      chapter: 5,
      title: 'Her Weight in Nothing',
      teach: '',
      idea: 'The plate will not notice her standing on it, and the iron is wanted ' +
            'elsewhere.',
      capacity: 4,
      map: [
        '#######',
        '#4#.#o#',
        '#.#.#.#',
        '#.....#',
        '#..d..#',
        '#..#..E',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 3 },
        { id: 'q', type: 'queen', col: 1, row: 4 },
        { id: 'i', type: 'iron', col: 5, row: 1 },
        { id: 'b', type: 'barrel', col: 1, row: 2 }
      ],
      par: { three: 20, two: 28 }
    },

    {
      id: 49,
      chapter: 5,
      title: 'Up the Shaft',
      teach: '',
      idea: 'One key between them, and only one of them can be carrying it.',
      capacity: 5,
      map: [
        '#######',
        '#..#..#',
        '#..#..#',
        '#..#..#',
        '#..L..#',
        '#..E..#',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 1, row: 1 },
        { id: 'q', type: 'queen', col: 1, row: 4 },
        { id: 'y', type: 'key', col: 4, row: 1 },
        { id: 'i', type: 'iron', col: 5, row: 3 }
      ],
      par: { three: 21, two: 29 }
    },

    {
      id: 50,
      chapter: 5,
      title: 'The Calm King',
      teach: '',
      idea: 'Everything the kingdom has, and two crowns to bring home through it.',
      capacity: 10,
      map: [
        '#######',
        '#.....#',
        '#.###.#',
        '#2#.#L#',
        '#.#.#d#',
        '#...#.E',
        '#######'
      ],
      pieces: [
        { id: 'k', type: 'king', col: 5, row: 2 },
        { id: 'q', type: 'queen', col: 2, row: 5 },
        { id: 'y', type: 'key', col: 1, row: 5 },
        { id: 'i', type: 'iron', col: 3, row: 5 }
      ],
      par: { three: 32, two: 45 }
    }
  ];


  var CHAPTERS = [
    { n: 1, title: 'The Quiet Kingdom', note: 'Weight, distance, and a board that answers' },
    { n: 2, title: 'Loose Ground',      note: 'Floors that slide, crumble, and only go one way' },
    { n: 3, title: 'The Locked Halls',  note: 'Gates that want paying for' },
    { n: 4, title: 'The Brass Keys',    note: 'Blocks that only a royal hand can open' },
    { n: 5, title: "The Queen's Road",  note: 'Two crowns, one frame, one gate' }
  ];

  root.CK = root.CK || {};
  root.CK.LEVELS = LEVELS;
  root.CK.CHAPTERS = CHAPTERS;
})(typeof globalThis !== 'undefined' ? globalThis : this);

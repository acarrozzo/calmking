/* Calm King — handcrafted levels.
 *
 * Map legend (7 rows x 7 chars):
 *   .  open floor        #  wall
 *   E  the gate (exit)   o  cradle  — pieces stack here, and it catches rollers
 *   ~  slick ice         — anything standing on it slides once the board leans
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
    }
  ];

  root.CK = root.CK || {};
  root.CK.LEVELS = LEVELS;
})(typeof globalThis !== 'undefined' ? globalThis : this);

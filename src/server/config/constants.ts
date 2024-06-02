import { MsDuration } from '../../shared/models/MsDuration'
import { Color } from '../../shared/utils/Color'
import type { Dict } from '../../shared/utils/fp'

import type { ChampionLevel_ } from '../models/theQuest/ChampionLevel'

export const constants = {
  emptyChar: '\u200B',

  emojis: {
    calls: '🔔', // :bell:
    link: '🔗', // :link:
    play: '▶️', // :arrow_forward:
    pause: '⏸️', // :pause_button:
    next: '⏩', // :fast_forward:
    stop: '⏹️', // :stop_button:
    birthday: '🎂', // :birthday:
    tada: '🎉', // :tada:
    cry: '😢', // :cry:

    characters: characters(),

    masteries: {
      5: ':maitrise5:',
      6: ':maitrise6:',
      7: ':maitrise7:',
      8: ':maitrise8:',
      9: ':maitrise9:',
      10: ':maitrise10:',
    } satisfies Dict<`${ChampionLevel_}`, string>,
  } as const,

  messagesColor: Color.darkred,

  cdnBase: 'https://dl.blbl.ch/cdn',

  // webapp
  account: {
    cookie: {
      name: 'userAccount',
      ttl: MsDuration.days(30),
    },
  },
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function characters() {
  return {
    a: '🇦',
    b: '🇧',
    c: '🇨',
    d: '🇩',
    e: '🇪',
    f: '🇫',
    g: '🇬',
    h: '🇭',
    i: '🇮',
    j: '🇯',
    k: '🇰',
    l: '🇱',
    m: '🇲',
    n: '🇳',
    o: '🇴',
    p: '🇵',
    q: '🇶',
    r: '🇷',
    s: '🇸',
    t: '🇹',
    u: '🇺',
    v: '🇻',
    w: '🇼',
    x: '🇽',
    y: '🇾',
    z: '🇿',
    0: '0️⃣',
    1: '1️⃣',
    2: '2️⃣',
    3: '3️⃣',
    4: '4️⃣',
    5: '5️⃣',
    6: '6️⃣',
    7: '7️⃣',
    8: '8️⃣',
    9: '9️⃣',
    10: '🔟',
    '#': '#️⃣',
    '*': '*️⃣',
    '!': '❗',
    '?': '❓',
  } as const
}

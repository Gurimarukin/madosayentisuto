import { MsDuration } from '../shared/models/MsDuration'
import { Color } from '../shared/utils/Color'

import { Activity } from './models/botState/Activity'

export const constants = {
  emptyChar: '\u200B',

  emojis: {
    calls: '🔔', // :bell:
    link: '🔗', // :link:
    play: '▶️', // :arrow_forward:
    pause: '⏸️', // :pause_button:
    next: '⏩', // :fast_forward:
    birthday: '🎂', // :birthday:
    tada: '🎉', // :tada:

    characters: emojiCharacters(),
  } as const,

  messagesColor: Color.darkred,

  defaultActivity: Activity.of('PLAYING', 'hisser les voiles...'),

  pollGraphWidth: 20, // chars

  dbRetryDelay: MsDuration.seconds(10),

  logsLimit: 5000,

  // kicks/bans
  fetchLogsLimit: 30,
  networkTolerance: MsDuration.seconds(4),

  itsFriday: {
    day: 5,
    hourRange: {
      start: 14,
      end: 17,
    },

    videoUrl:
      'https://cdn.discordapp.com/attachments/636626556734930948/909046875804545064/cestvrai.mp4',
    // PeerTube:  https://tube.fede.re/w/gAfpve8szQ5TtiPfRqkNEi
    // thumbnail: https://cdn.discordapp.com/attachments/636626556734930948/909048276957945886/unknown.png
    imageUrl:
      'https://cdn.discordapp.com/attachments/849299103362973777/969617031487975454/unknown.png',
  },

  // webapp
  rateLimiterLifeTime: MsDuration.days(1),
  account: {
    tokenTtl: MsDuration.days(30),
    cookie: {
      name: 'userAccount',
      ttl: MsDuration.days(30),
    },
  },
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function emojiCharacters() {
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

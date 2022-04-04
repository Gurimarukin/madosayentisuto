import type { ColorResolvable } from 'discord.js'

import { MsDuration } from '../shared/models/MsDuration'

import { Activity } from './models/botState/Activity'

const darkred: ColorResolvable = '#8b0000'

const dimgray: ColorResolvable = '#686a66'
const lightseagreen: ColorResolvable = '#00a4a8'
const goldenrod: ColorResolvable = '#c8a800'
const tomato: ColorResolvable = '#f54234'

export const Colors = { darkred, dimgray, lightseagreen, goldenrod, tomato }

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

  messagesColor: darkred,

  defaultActivity: Activity.of('PLAYING', 'hisser les voiles...'),

  itsFridayUrl:
    'https://cdn.discordapp.com/attachments/636626556734930948/909046875804545064/cestvrai.mp4',
  // PeerTube:  https://tube.fede.re/w/gAfpve8szQ5TtiPfRqkNEi
  // thumbnail: https://cdn.discordapp.com/attachments/636626556734930948/909048276957945886/unknown.png

  pollGraphWidth: 20, // chars

  // kicks/bans
  fetchLogsLimit: 30,
  networkTolerance: MsDuration.seconds(4),

  itsFriday: {
    day: 5,
    hourRange: {
      start: 14,
      end: 17,
    },
  },

  // webapp
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

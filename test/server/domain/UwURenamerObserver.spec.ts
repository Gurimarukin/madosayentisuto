/* eslint-disable functional/no-expression-statements */
import type { List } from '../../../src/shared/utils/fp'
import { Maybe } from '../../../src/shared/utils/fp'

import { isValidUwU, uwuRename } from '../../../src/server/domain/UwURenamerObserver'

import { expectT } from '../../expectT'

type Member = {
  user: string
  actual: string // actual nickname (current from the server), all of them should be valid
  expected?: string | null // expected nickname, if different from actual
}

const members: List<Member> = [
  { user: '🔥PoZZe🔥', actual: 'PoZUwUZe', expected: '🔥POwOZZe🔥' },
  { user: 'AgentDys', actual: 'AgentDysUwU', expected: 'AgentDyUwUs' },
  { user: 'Alzxx', actual: 'AlzxxUwU' },
  { user: 'AranaTalie', actual: 'HUwU Talie', expected: 'AranaTaliUwU' },
  { user: 'ArChAnGe', actual: 'ArChAnGUwU' },
  { user: 'Bushinryu', actual: 'BUwUshinryUwU', expected: 'BushinryUwU' },
  { user: 'Cair0n', actual: 'CairUwUn', expected: 'CairOwOn' },
  { user: 'Chabal', actual: 'ChabalUwU' },
  { user: 'ChevreOketchuP', actual: 'ChevurUwU', expected: 'ChevreOketchUwUP' },
  { user: 'Claudibul', actual: 'ClaudibUwUl' },
  { user: 'clotilde.__.bocquet', actual: 'clotildUwU', expected: 'clotilde.__.bocqUwUet' },
  { user: 'Dagga', actual: 'DaggUwU' },
  { user: 'Darling', actual: 'DarlUwUng', expected: 'DarlingUwU' },
  { user: 'Erewon', actual: 'ErewOwOn' },
  { user: 'Fortuninja', actual: 'FortUwUninja' },
  { user: 'Gaboby18', actual: 'InteUwUr Professionnel', expected: 'GabobyUwU18' },
  { user: 'Gahuma', actual: 'GahUwUma' },
  { user: 'Gamixis', actual: 'GamixUwU', expected: 'GamixisUwU' },
  { user: 'Glawurt', actual: 'GlawUwUrt' },
  { user: 'GRAMSINATOR', actual: 'NUwUggers Have Souls', expected: 'GRAMSINATOwOR' },
  { user: 'Grim', actual: 'GrUwUm', expected: 'GrimUwU' },
  { user: 'Gurimarukin', actual: 'GUwUrimarUwUkin', expected: 'GurimarUwUkin' },
  { user: 'Gwen-O', actual: 'Gwen-UwU', expected: 'Gwen-OwO' },
  { user: 'Héra', actual: 'HérUwU' },
  { user: 'hildi', actual: 'hildUwU' },
  { user: 'ily', actual: 'ilUwU', expected: 'ilyUwU' },
  { user: 'Jean Plank', actual: 'Jean Plank UwU' }, // actual: null
  { user: 'Jean PRANK 2', actual: 'GertrUwUde la rancunière', expected: 'Jean PRANK 2 UwU' },
  { user: 'Jean PRANK', actual: 'Jean PRANK UwU' }, // actual: null
  { user: 'jekseinth', actual: 'I go GUwUtroll Olaf', expected: 'jekseinthUwU' },
  { user: 'jeunebambou', actual: 'jeunebambUwU', expected: 'jeunebamboUwU' },
  { user: 'JoshuFlex', actual: 'JoshUwUFlex' },
  { user: 'Julien', actual: 'GanzsthUwUl', expected: 'JUwUlien' },
  { user: 'Kryspr', actual: 'KryUwUspr' },
  { user: 'Leikyn', actual: 'LeikUwUyn', expected: 'LeikyUwUn' },
  { user: 'Leukos', actual: 'LeUwUkos' },
  { user: 'Lieft 🍃', actual: 'LiUwUft 🍃', expected: 'Lieft 🍃 UwU' },
  { user: 'Lilith', actual: 'LapinoUwU de terre 🌍🐇💕', expected: 'LilithUwU' },
  { user: 'Loleux', actual: 'LoleUwUx' },
  { user: 'Loukidouloum', actual: 'LUwUkidouloum', expected: 'LoukidouloUwUm' },
  { user: 'Lyanstos', actual: 'Le ClOwOne', expected: 'LyUwUanstos' },
  { user: 'magret2koinkoin', actual: 'magrUwUt2koinkoin', expected: 'magret2koinkOwOin' },
  { user: 'Marco_Zamshire', actual: 'ZamshirUwU', expected: 'MarcOwO_Zamshire' },
  { user: 'Masson', actual: 'ArthUwUr(prénom)2000(naissance)', expected: 'MassOwOn' },
  { user: 'mat793__', actual: 'mat79UwU3_', expected: 'mat793__UwU' },
  { user: 'MorikoNeko', actual: 'MorinOwONekOwO', expected: 'MorikoNekOwO' },
  { user: 'Ngoc Loan', actual: 'doUwUwie', expected: 'Ngoc LOwOan' },
  { user: 'Nimiia', actual: 'NimiiUwU' },
  { user: 'NOUMAX', actual: 'NOUwUMAX' },
  { user: 'Olwyn', actual: 'OwOlwyn' },
  { user: 'Oncle Ray', actual: "L'avocat de la RUWU", expected: 'OwOncle Ray' },
  { user: 'p4x640🪐', actual: 'p4UwU640🪐', expected: 'p4x64OwO🪐' },
  { user: 'PIAIRRE', actual: 'PIAIRRUwU' },
  { user: 'Pikachuzzz⚜', actual: 'PikachUwUzzz⚜' },
  { user: 'Pouet', actual: 'PoUwUet' },
  // { user: 'Pwaak', actual: 'PwUwUk' }, // TODO
  { user: 'Rouge Gorge', actual: 'Pile UwU Face', expected: 'RoUwUge Gorge' },
  { user: 'schizo-fred', actual: 'Frais-UwU-Derrick', expected: 'schizOwO-fred' },
  { user: 'Scotch', actual: 'ScUwUtch', expected: 'ScOwOtch' },
  { user: 'sevdu71', actual: 'sevdUwU71' },
  { user: 'SmAll.-', actual: 'SmAll.-UwU' },
  { user: 'Styrale', actual: 'Mestre ChÔwÔmeur', expected: 'StyUwUrale' },
  { user: 'Sultry', actual: 'SUwUltry' },
  { user: 'TGrozner', actual: 'TGrOwOzner' },
  { user: 'Thek', actual: 'SuicUwUne', expected: 'ThekUwU' },
  { user: 'Toti', actual: 'TOwOti' },
  { user: 'Un Peu Late.', actual: 'UwU Peu Late.', expected: 'UwUn Peu Late.' },
  { user: 'Undernead', actual: 'UwUndernead' },
  { user: 'Vectaar', actual: 'VectaarUwU' },
  { user: 'Vivikrokgar', actual: 'VUwUkrokgar', expected: 'VivikrOwOkgar' },
  { user: 'Ysle', actual: 'UwUsle' },
  { user: 'zHopii', actual: 'zHopiUwUi', expected: 'zHOwOpii' },
  { user: 'Zouvae', actual: 'ZoUwUvae' },
]

describe('isValidUwU', () => {
  members.forEach(({ user, actual }) => {
    it(`should ${JSON.stringify(user)} - ${JSON.stringify(actual)}`, () => {
      expectT(isValidUwU(actual)).toStrictEqual(true)
    })
  })
})

describe('renameUwU', () => {
  members.forEach(({ user, actual, expected }) => {
    it(`should ${JSON.stringify(user)} - ${JSON.stringify(actual)}`, () => {
      expectT(uwuRename(user)).toStrictEqual(
        expected === undefined ? Maybe.some(actual) : Maybe.fromNullable(expected),
      )
    })
  })
})

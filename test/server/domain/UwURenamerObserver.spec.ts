import { DiscordUserId } from '../../../src/shared/models/DiscordUserId'
import type { List } from '../../../src/shared/utils/fp'

import { UwURenamerObserver } from '../../../src/server/domain/UwURenamerObserver'

type Member = {
  readonly id: string
  readonly user: string
  readonly nick: string | null
}

const members: List<Member> = [
  { id: '01', user: '🔥PoZZe🔥', nick: 'PoZUwUZe' },
  { id: '02', user: 'AgentDys', nick: 'AgentDysUwU' },
  { id: '03', user: 'Alzxx', nick: 'AlzxxUwU' },
  { id: '04', user: 'AranaTalie', nick: 'HUwU Talie' },
  { id: '05', user: 'ArChAnGe', nick: 'ArChAnGUwU' },
  { id: '06', user: 'Bushinryu', nick: 'BUwUshinryUwU' },
  { id: '07', user: 'Cair0n', nick: 'CairUwUn' },
  { id: '08', user: 'Chabal', nick: 'ChabalUwU' },
  { id: '09', user: 'ChevreOketchuP', nick: 'ChevurUwU' },
  { id: '10', user: 'Claudibul', nick: 'ClaudibUwUl' },
  { id: '11', user: 'clotilde.__.bocquet', nick: 'clotildUwU' },
  { id: '12', user: 'Dagga', nick: 'DaggUwU' },
  { id: '13', user: 'Darling', nick: 'DarlUwUng' },
  { id: '14', user: 'Erewon', nick: 'ErewOwOn' },
  { id: '15', user: 'Fortuninja', nick: 'FortUwUninja' },
  { id: '16', user: 'Gaboby18', nick: 'InteUwUr Professionnel' },
  { id: '17', user: 'Gahuma', nick: 'GahUwUma' },
  { id: '18', user: 'Gamixis', nick: 'GamixUwU' },
  { id: '19', user: 'Glawurt', nick: 'GlawUwUrt' },
  { id: '20', user: 'GRAMSINATOR', nick: 'NUwUggers Have Souls' },
  { id: '21', user: 'Grim', nick: 'GrUwUm' },
  { id: '22', user: 'Gurimarukin', nick: 'GUwUrimarUwUkin' },
  { id: '23', user: 'Gwen-O', nick: 'Gwen-UwU' },
  { id: '24', user: 'Héra', nick: 'HérUwU' },
  { id: '25', user: 'hildi', nick: 'hildUwU' },
  { id: '26', user: 'ily', nick: 'ilUwU' },
  { id: '27', user: 'Jean Plank', nick: null },
  { id: '28', user: 'Jean PRANK 2', nick: 'GertrUwUde la rancunière' },
  { id: '29', user: 'Jean PRANK', nick: null },
  { id: '30', user: 'jekseinth', nick: 'I go GUwUtroll Olaf' },
  { id: '31', user: 'jeunebambou', nick: 'jeunebambUwU' },
  { id: '32', user: 'JoshuFlex', nick: 'JoshUwUFlex' },
  { id: '33', user: 'Julien', nick: 'GanzsthUwUl' },
  { id: '34', user: 'Kryspr', nick: 'KrUwUspr' },
  { id: '35', user: 'Leikyn', nick: 'LeikUwUyn' },
  { id: '36', user: 'Leukos', nick: 'LeUwUkos' },
  { id: '37', user: 'Lieft 🍃', nick: 'LiUwUft 🍃' },
  { id: '38', user: 'Lilith', nick: 'LapinoUwU de terre 🌍🐇💕' },
  { id: '39', user: 'Loleux', nick: 'LoleUwUx' },
  { id: '40', user: 'Loukidouloum', nick: 'LUwUkidouloum' },
  { id: '41', user: 'Lyanstos', nick: 'Le ClOwOne' },
  { id: '42', user: 'magret2koinkoin', nick: 'magrUwUt2koinkoin' },
  { id: '43', user: 'Marco_Zamshire', nick: 'ZamshirUwU' },
  { id: '44', user: 'Masson', nick: 'ArthUwUr(prénom)2000(naissance)' },
  { id: '45', user: 'mat793__', nick: 'mat79UwU3_' },
  { id: '46', user: 'MorikoNeko', nick: 'MorinOwONekOwO' },
  { id: '47', user: 'Ngoc Loan', nick: 'doUwUwie' },
  { id: '48', user: 'Nimiia', nick: 'NimiiUwU' },
  { id: '49', user: 'NOUMAX', nick: 'NOUwUMAX' },
  { id: '50', user: 'Olwyn', nick: 'OlUwUyn' },
  { id: '51', user: 'Oncle Ray', nick: "L'avocat de la RUWU" },
  { id: '52', user: 'p4x640🪐', nick: 'p4UwU640🪐' },
  { id: '53', user: 'PIAIRRE', nick: 'PIAIRRUwU' },
  { id: '54', user: 'Pikachuzzz⚜', nick: 'PikachUwUz🔱' },
  { id: '55', user: 'Pouet', nick: 'PoUwUet' },
  { id: '56', user: 'Pwaak', nick: 'PwUwUk' },
  { id: '57', user: 'Rouge Gorge', nick: 'Pile UwU Face' },
  { id: '58', user: 'schizo-fred', nick: 'Frais-UwU-Derrick' },
  { id: '59', user: 'Scotch', nick: 'ScUwUtch' },
  { id: '60', user: 'sevdu71', nick: 'sevdUwU71' },
  { id: '61', user: 'SmAll.-', nick: 'SmAll.-UwU' },
  { id: '62', user: 'Styrale', nick: 'Mestre ChÔwÔmeur' },
  { id: '63', user: 'Sultry', nick: 'SUwUltry' },
  { id: '64', user: 'TGrozner', nick: 'TGrOwOzner' },
  { id: '65', user: 'Thek', nick: 'SuicUwUne' },
  { id: '66', user: 'Toti', nick: 'TOwOti' },
  { id: '67', user: 'Un Peu Late.', nick: 'UwU Peu Late.' },
  { id: '68', user: 'Undernead', nick: 'UwUndernead' },
  { id: '69', user: 'Vectaar', nick: 'VectaarUwU' },
  { id: '70', user: 'Vivikrokgar', nick: 'VUwUkrokgar' },
  { id: '71', user: 'Ysle', nick: 'UwUsle' },
  { id: '72', user: 'zHopii', nick: 'zHopiUwUi' },
  { id: '73', user: 'Zouvae', nick: 'ZoUwUvae' },
]

describe('isValidUwU', () => {
  // eslint-disable-next-line functional/no-expression-statement
  members.forEach(({ id, user, nick }) => {
    it(`should ${id} ${JSON.stringify(user)} - ${JSON.stringify(nick)}`, () => {
      expect(
        UwURenamerObserver.isValidUwU([
          DiscordUserId.wrap('27'), // Jean Plank
          DiscordUserId.wrap('29'), // Jean PRANK
        ])({ id, user: { username: user }, nickname: nick }),
      ).toStrictEqual(true)
    })
  })
})

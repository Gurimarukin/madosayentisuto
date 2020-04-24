import { Command } from './Command'
import { Commands } from './Commands'
import { Opts } from './Opts'
import { pipe } from '../utils/fp'

type AdminTextChannel = Commands.CallsSubscribe | Commands.CallsUnsubscribe

const callsSubscribe = Command('subscribe')(Opts.pure(Commands.CallsSubscribe))
const callsUnsubscribe = Command('unsubscribe')(Opts.pure(Commands.CallsUnsubscribe))

export namespace Cli {
  export const adminTextChannel: Command<AdminTextChannel> = Command('calls')(
    pipe(
      Opts.subcommand<AdminTextChannel>(callsSubscribe),
      Opts.orElse(() => Opts.subcommand<AdminTextChannel>(callsUnsubscribe))
    )
  )
}

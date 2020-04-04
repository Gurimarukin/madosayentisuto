import Discord from 'discord.js'

export type AppEvent = AppEvent.Message

export namespace AppEvent {
  export const short = (event: AppEvent): any => {
    switch (event.name) {
      case 'dm-message':
      case 'guild-message':
        return `"${event.name}": "${event.message.content}"`
    }
  }

  /**
   * Message
   */
  export type Message =
    | { name: 'dm-message'; message: Discord.Message }
    | { name: 'guild-message'; message: Discord.Message }

  export namespace Message {
    export const dmMessage = (message: Discord.Message): AppEvent.Message => ({
      name: 'dm-message',
      message
    })
    export const guildMessage = (message: Discord.Message): AppEvent.Message => ({
      name: 'guild-message',
      message
    })
  }
}

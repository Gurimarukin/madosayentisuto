module.exports = {
  mode: 'jit',
  content: ['./src/**/*.{html,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray1: '#202225',
        gray2: '#2f3136',
        gray3: '#36393f',
        gray4: '#dcddde',
        // Discord theme
        discordBlurple: '#5865f2',
        discordGreen: '#57f287',
        discordYellow: '#fee75c',
        discordFuchsia: '#eb459e',
        discordRed: '#ed4245',
      },
    },
  },
  plugins: [],
}

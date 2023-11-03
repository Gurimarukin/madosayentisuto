import { createEnum } from '../../utils/createEnum'

type PlaylistType = typeof PlaylistType.T

const PlaylistType = createEnum('elevator', 'heimerLoco')

export { PlaylistType }

#!/usr/bin/env bash
cd "$(dirname $0)"
CMD="$1"

if [[ "$CMD" == "start" ]]; then

  docker-compose up
  docker-compose logs -f -t

elif [[ "$CMD" == "stop" ]]; then

  docker-compose stop

elif [[ "$CMD" == "clean" ]]; then

  docker-compose down -v
  rm -R .docker-data 2> /dev/null

elif [[ "$CMD" == "mongo-shell" ]]; then

  docker exec -it madosayentisuto-mongo mongo

else

  echo "Usage: $0 start|stop|clean|mongo-shell"
  exit 1

fi

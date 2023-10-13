# Madosayentisuto

Node 18+

---

    cp .env.example .env
    # change needed values

## Deploy

    yarn install
    yarn run build
    node dist/src/server/index.js

## Dev

    dev/docker.sh start

    mongo -u user -p password --authenticationDatabase admin madosayentisuto

    yarn install
    yarn run ~server
    yarn run ~client # in other shell

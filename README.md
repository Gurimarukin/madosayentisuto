# Madosayentisuto

Node 20+

---

    cp .env.example .env
    # change needed values

## Deploy

    yarn install
    yarn build
    yarn _node tsbuild/src/server/index.js

## Dev

    dev/docker.sh start

    mongo -u user -p password --authenticationDatabase admin madosayentisuto

    yarn install
    yarn ~server
    yarn ~client # in other shell

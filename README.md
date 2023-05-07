# Madosayentisuto

Node 18+

---

    cp conf/server/local.example.conf.json conf/server/local.conf.json
    cp conf/client/.env.example conf/client/.env
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

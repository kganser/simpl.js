#!/bin/bash

if [ ! -x $1 ]; then echo 'bad executable'; exit 1; fi

$1 --remote-debugging-port=8122 --enable-logging=stderr --port=8123 &
PID=$!
while test -z "$TOKEN"; do
  sleep 1
  TOKEN=`curl -s localhost:8123/token`
  AUTH="Authorization: Bearer $TOKEN"
done
curl localhost:8123/restore -H "$AUTH" -d 'scope=full' -so /dev/null
curl localhost:8123/apps/test/1 -H "$AUTH" -X PUT --data-binary @test.js -so /dev/null
curl localhost:8123/apps/test/1/dependencies -H "$AUTH" -d '{"name":"http","version":0}' -so /dev/null
curl localhost:8123/apps/test/1/dependencies -H "$AUTH" -d '{"name":"string","version":0}' -so /dev/null
curl localhost:8123/apps/test/1/config -H "$AUTH" -X PUT -d '{"port":8124,"apiPort":8123,"debuggerPort":8122}' -so /dev/null
curl localhost:8123/action -H "$AUTH" -d "{\"command\":\"run\",\"app\":\"test\",\"version\":1}" -so /dev/null
sleep 1
mkdir -p reports/test.js
curl localhost:8124/results -so reports/test.js/junit.xml
curl localhost:8124/log -so reports/test.js/log.txt
curl localhost:8124/screenshot-code -so reports/test.js/screenshot-code.png
curl localhost:8124/screenshot-docs -so reports/test.js/screenshot-docs.png
curl localhost:8124/screenshot-config -so reports/test.js/screenshot-config.png
curl localhost:8124/screenshot-log -so reports/test.js/screenshot-log.png
kill $PID
wait $PID

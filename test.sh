#!/bin/bash

if [ ! -x $1 ]; then echo 'bad executable'; exit 1; fi

$1 --remote-debugging-port=8122 --enable-logging=stderr --port=8123 &
PID=$!
while test -z "$TOKEN"; do
  sleep 1
  TOKEN=`curl -s localhost:8123/token`
done
curl localhost:8123/restore -d "scope=full&token=$TOKEN" -so /dev/null
curl localhost:8123/apps/test/1?token=$TOKEN -X PUT --data-binary @test.js -so /dev/null
curl localhost:8123/apps/test/1/dependencies?token=$TOKEN -d '{"name":"http","version":0}' -so /dev/null
curl localhost:8123/apps/test/1/dependencies?token=$TOKEN -d '{"name":"string","version":0}' -so /dev/null
curl localhost:8123/apps/test/1/config?token=$TOKEN -X PUT -d '{"port":8124,"apiPort":8123,"debuggerPort":8122}' -so /dev/null
curl localhost:8123/action -d "{\"command\":\"run\",\"app\":\"test\",\"version\":1,\"token\":\"$TOKEN\"}" -so /dev/null
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

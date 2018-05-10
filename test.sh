#!/bin/bash

if [ ! -x $1 ]; then echo 'bad executable'; exit 1; fi

$1 --disable-gpu --enable-logging=stderr --port=8123 --debug &
PID=$!
sleep 1
TOKEN=`curl -s localhost:8123/token`
curl localhost:8123/restore -d "scope=full&token=$TOKEN" -so /dev/null
curl localhost:8123/apps/test/1?token=$TOKEN -X PUT --data-binary @test.js -so /dev/null
curl localhost:8123/apps/test/1/dependencies?token=$TOKEN -d '{"name":"http","version":0}' -so /dev/null
curl localhost:8123/apps/test/1/config?token=$TOKEN -X PUT -d '{"port":8124,"apiPort":8123}' -so /dev/null
curl localhost:8123/action -d "{\"command\":\"run\",\"app\":\"test\",\"version\":1,\"token\":\"$TOKEN\"}" -so /dev/null
sleep 1
mkdir -p reports
curl localhost:8124 -so reports/junit.xml
kill $PID
wait $PID

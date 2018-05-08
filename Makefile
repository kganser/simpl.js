chrome:
	mkdir -p build/chrome; \
	cp -R src build/chrome/src; \
	cd build/chrome/src; \
	sed -i '' '/"node",/d' manifest.json; \
	zip -qr ../simpljs .; \
	cd ..; \
	rm -rf src
linux:
	mkdir -p build/linux tmp; \
	test -f tmp/nwjs-sdk-v0.29.2-linux.tar.gz || curl -# https://dl.nwjs.io/v0.29.2/nwjs-sdk-v0.29.2-linux-x64.tar.gz -o tmp/nwjs-sdk-v0.29.2-linux.tar.gz; \
	tar -xf tmp/nwjs-sdk-v0.29.2-linux.tar.gz; \
	mv tmp/nwjs-sdk-v0.29.2-linux-x64 build/linux/Simpl.js; \
	cp -R src/ build/linux/Simpl.js/package.nw
macos:
	mkdir -p build/macos tmp; \
	rm -rf build/macos/* tmp/nwjs-sdk-v0.29.2-osx-x64; \
	test -f tmp/nwjs-sdk-v0.29.2-osx.zip || curl -# https://dl.nwjs.io/v0.29.2/nwjs-sdk-v0.29.2-osx-x64.zip -o tmp/nwjs-sdk-v0.29.2-osx.zip; \
	unzip -q tmp/nwjs-sdk-v0.29.2-osx.zip -d tmp; \
	mv -f tmp/nwjs-sdk-v0.29.2-osx-x64/nwjs.app build/macos/Simpl.js.app; \
	rm -rf tmp/nwjs-sdk-v0.29.2-osx-x64; \
	mkdir -p build/macos/Simpl.js.app/Contents/Resources/app.nw; \
	cp -R src/ build/macos/Simpl.js.app/Contents/Resources/app.nw; \
	cp assets/simpljs.icns build/macos/Simpl.js.app/Contents/Resources/app.icns; \
	touch build/macos/Simpl.js.app
test:
	if [ `uname` = 'Darwin' ]; then \
	  if [ ! -x build/macos/Simpl.js.app/Contents/MacOS/nwjs ]; then \
	    echo 'ERROR: run `make macos` first'; \
	    exit 1; \
	  fi; \
	  build/macos/Simpl.js.app/Contents/MacOS/nwjs --disable-gpu --enable-logging=stderr --port=8123 --debug & \
	  pid=$$!; \
	else \
	  if [ ! -x build/linux/Simpl.js/nw ]; then \
	    echo 'ERROR: run `make linux` first'; \
	    exit 1; \
	  fi; \
	  /usr/bin/xvfb-run build/linux/Simpl.js/nw --disable-gpu --enable-logging=stderr --port=8123 --debug & \
	  pid=$$!; \
	fi; \
	sleep 1; \
	token=`curl -s localhost:8123/token`; \
	curl localhost:8123/restore -d "scope=full&token=$$token" -so /dev/null; \
	curl localhost:8123/apps/test/1?token=$$token -X PUT --data-binary @test.js -so /dev/null; \
	curl localhost:8123/apps/test/1/dependencies?token=$$token -d '{"name":"http","version":0}' -so /dev/null; \
	curl localhost:8123/apps/test/1/config?token=$$token -X PUT -d '{"port":8124,"apiPort":8123}' -so /dev/null; \
	curl localhost:8123/action -d "{\"command\":\"run\",\"app\":\"test\",\"version\":1,\"token\":\"$$token\"}" -so /dev/null; \
	sleep 1; \
	mkdir -p reports; \
	curl localhost:8124 -so reports/junit.xml; \
	kill $$pid; \
	wait $$pid
clean:
	rm -rf build tmp

PHONY: chrome linux macos test

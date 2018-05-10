chrome:
	mkdir -p build/chrome
	cp -R src build/chrome/src
	cd build/chrome/src; sed -i '' '/"node",/d' manifest.json; zip -qr ../simpljs .; cd ..; rm -rf src
linux:
	mkdir -p build/linux tmp
	test -f tmp/nwjs-sdk-v0.29.2-linux.tar.gz || curl -# https://dl.nwjs.io/v0.29.2/nwjs-sdk-v0.29.2-linux-x64.tar.gz -o tmp/nwjs-sdk-v0.29.2-linux.tar.gz
	tar -C tmp -xf tmp/nwjs-sdk-v0.29.2-linux.tar.gz
	mv tmp/nwjs-sdk-v0.29.2-linux-x64 build/linux/Simpl.js
	cp -R src/ build/linux/Simpl.js/package.nw
macos:
	mkdir -p build/macos tmp
	rm -rf build/macos/* tmp/nwjs-sdk-v0.29.2-osx-x64
	test -f tmp/nwjs-sdk-v0.29.2-osx.zip || curl -# https://dl.nwjs.io/v0.29.2/nwjs-sdk-v0.29.2-osx-x64.zip -o tmp/nwjs-sdk-v0.29.2-osx.zip
	unzip -q tmp/nwjs-sdk-v0.29.2-osx.zip -d tmp
	mv -f tmp/nwjs-sdk-v0.29.2-osx-x64/nwjs.app build/macos/Simpl.js.app
	rm -rf tmp/nwjs-sdk-v0.29.2-osx-x64
	mkdir -p build/macos/Simpl.js.app/Contents/Resources/app.nw
	cp -R src/ build/macos/Simpl.js.app/Contents/Resources/app.nw
	cp assets/simpljs.icns build/macos/Simpl.js.app/Contents/Resources/app.icns
	touch build/macos/Simpl.js.app
test:
	if [ `uname` = 'Darwin' ]; then ./test.sh build/macos/Simpl.js.app/Contents/MacOS/nwjs; \
	else xvfb-run ./test.sh build/linux/Simpl.js/nw; fi
clean:
	rm -rf build tmp

PHONY: chrome linux macos test

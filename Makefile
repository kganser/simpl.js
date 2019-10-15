nwver := v0.41.2
nwurl := https://dl.nwjs.io/$(nwver)

all: chrome linux macos windows

chrome:
	mkdir -p build/chrome
	cp -R src build/chrome/src
	cd build/chrome/src; sed -i '' '/"node",/d' manifest.json; zip -yrq ../simpljs .; cd ..; rm -rf src
linux:
	mkdir -p build/linux tmp
	rm -rf build/linux/* tmp/nwjs-sdk-$(nwver)-linux-x64
	test -f tmp/nwjs-sdk-$(nwver)-linux.tar.gz || curl -# --retry 10 $(nwurl)/nwjs-sdk-$(nwver)-linux-x64.tar.gz -o tmp/nwjs-sdk-$(nwver)-linux.tar.gz
	tar -C tmp -xf tmp/nwjs-sdk-$(nwver)-linux.tar.gz
	mv tmp/nwjs-sdk-$(nwver)-linux-x64 build/linux/Simpl.js
	cp -R src/ build/linux/Simpl.js/package.nw
	#tar -C build/linux -czf build/linux/Simpl.js.tar.gz Simpl.js
macos:
	mkdir -p build/macos tmp
	rm -rf build/macos/* tmp/nwjs-sdk-$(nwver)-osx-x64
	test -f tmp/nwjs-sdk-$(nwver)-osx.zip || curl -# --retry 10 $(nwurl)/nwjs-sdk-$(nwver)-osx-x64.zip -o tmp/nwjs-sdk-$(nwver)-osx.zip
	unzip -q tmp/nwjs-sdk-$(nwver)-osx.zip -d tmp
	mv -f tmp/nwjs-sdk-$(nwver)-osx-x64/nwjs.app build/macos/Simpl.js.app
	rm -rf tmp/nwjs-sdk-$(nwver)-osx-x64
	mkdir -p build/macos/Simpl.js.app/Contents/Resources/app.nw
	cp -R src/ build/macos/Simpl.js.app/Contents/Resources/app.nw
	cp assets/simpljs.icns build/macos/Simpl.js.app/Contents/Resources/app.icns
	touch build/macos/Simpl.js.app
	#cd build/macos; zip -yrq Simpl.js.zip Simpl.js.app
windows:
	mkdir -p build/windows tmp
	rm -rf build/windows/* tmp/nwjs-sdk-$(nwver)-win-x64
	test -f tmp/nwjs-sdk-$(nwver)-win.zip || curl -# --retry 10 $(nwurl)/nwjs-sdk-$(nwver)-win-x64.zip -o tmp/nwjs-sdk-$(nwver)-win.zip
	unzip -q tmp/nwjs-sdk-$(nwver)-win.zip -d tmp
	mv -f tmp/nwjs-sdk-$(nwver)-win-x64 build/windows/Simpl.js
	cp -R src/ build/windows/Simpl.js/package.nw
	#cd build/windows; zip -yrq Simpl.js.zip Simpl.js
docker: build/linux/Simpl.js
	cp -p docker/launch.sh build/linux/Simpl.js/
	docker build -t kganser/simpljs:`sed -n 's/^ *"version": "\([^"]*\)", */\1/p' build/linux/Simpl.js/package.nw/manifest.json` -f docker/Dockerfile build/linux
clean:
	rm -rf build tmp

.PHONY: all chrome linux macos windows docker

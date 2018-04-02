chrome:
	mkdir -p build/chrome
	tar -czC src -f build/chrome/simpljs.zip .
linux:
	mkdir -p build/linux
	echo TODO
#	curl -# https://dl.nwjs.io/v0.29.2/nwjs-sdk-v0.29.2-linux-x64.tar.gz | tar xz

macos:
	mkdir -p build/macos
	curl -# https://dl.nwjs.io/v0.29.2/nwjs-v0.29.2-osx-x64.zip -o build/macos/nw.zip
	unzip -q build/macos/nw.zip -d build/macos
	mv build/macos/nwjs-v0.29.2-osx-x64/nwjs.app build/macos/simpljs.app
	rm -rf build/macos/nw.zip build/macos/nwjs-v0.29.2-osx-x64
	mkdir -p build/macos/simpljs.app/Contents/Resources/app.nw
	cp -R src/ build/macos/simpljs.app/Contents/Resources/app.nw

clean:
	rm -rf build

PHONY: chrome linux macos

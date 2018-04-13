chrome:
	mkdir -p build/chrome
	cd src; zip -qr ../build/chrome/simpljs .
linux:
	mkdir -p build/linux; \
	cd build/linux; \
	test -f nwjs-sdk-v0.29.2.tar.gz || curl -# https://dl.nwjs.io/v0.29.2/nwjs-sdk-v0.29.2-linux-x64.tar.gz -o nwjs-sdk-v0.29.2.tar.gz; \
	tar -xf nwjs-sdk-v0.29.2.tar.gz; \
	mv nwjs-sdk-v0.29.2-linux-x64 Simpl.js; \
        cp -R ../../src/ Simpl.js/package.nw
macos:
	mkdir -p build/macos; \
	cd build/macos; \
	test -f nwjs-sdk-v0.29.2.zip || curl -# https://dl.nwjs.io/v0.29.2/nwjs-sdk-v0.29.2-osx-x64.zip -o nwjs-sdk-v0.29.2.zip; \
	unzip -q nwjs-sdk-v0.29.2.zip; \
	mv nwjs-sdk-v0.29.2-osx-x64/nwjs.app Simpl.js.app; \
	rm -rf nwjs-sdk-v0.29.2-osx-x64; \
	mkdir -p Simpl.js.app/Contents/Resources/app.nw; \
	cp -R ../../src/ Simpl.js.app/Contents/Resources/app.nw; \
	cp ../../assets/simpljs.icns Simpl.js.app/Contents/Resources/app.icns; \
	touch Simpl.js.app
test: linux
	echo TODO
clean:
	rm -rf build

PHONY: chrome linux macos test

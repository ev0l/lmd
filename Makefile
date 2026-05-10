.PHONY: build build-js build-swift dev clean

build: build-js build-swift

build-js:
	cd editor-src && npm install --silent && node build.js

build-swift:
	swift build -c release

dev:
	cd editor-src && npm install --silent && node build.js --watch &
	swift build

clean:
	rm -rf .build
	rm -rf editor-src/node_modules
	rm -f Sources/lmd/Resources/editor.bundle.js

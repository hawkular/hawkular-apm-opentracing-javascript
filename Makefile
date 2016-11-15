
.PHONY: lint test publish clean

node_modules: package.json
	npm install

lint: node_modules
	npm run lint

test: lint
	npm run test
	npm run coverage

publish: test
	@if [ $(shell git symbolic-ref --short -q HEAD) = "master" ]; then exit 0; else \
		echo "Current git branch does not appear to be 'master'. Refusing to publish."; \
		exit 1; \
	fi
	npm version $(VERSION)
	npm whoami
	npm publish
	@echo 'Please do `git push --follow-tags` manually!'

clean:
	rm -rf node_modules


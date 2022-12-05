up:
	docker compose --file ./docker-compose.dev.yml up

test:
	docker compose --file ./docker-compose.dev.yml exec app npm run test

lint:
	docker compose --file ./docker-compose.dev.yml exec app npm run lint:fix

format:
	docker compose --file ./docker-compose.dev.yml exec app npm run format:write

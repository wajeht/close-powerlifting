deploy:
	./deploy.sh

up:
	docker compose --file ./docker-compose.dev.yml up

up-d:
	docker compose --file ./docker-compose.dev.yml up -d

log:
	docker compose --file ./docker-compose.dev.yml logs -f

down:
	docker compose --file ./docker-compose.dev.yml down

clean:
	docker compose --file ./docker-compose.dev.yml down --rmi all

wipe:
	docker system prune -a --volumes

test:
	docker compose --file ./docker-compose.dev.yml exec app npm run test

lint:
	docker compose --file ./docker-compose.dev.yml exec app npm run lint:fix

format:
	docker compose --file ./docker-compose.dev.yml exec app npm run format:write

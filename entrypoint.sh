echo "Applying database migrations..."
npm run migration:run

echo "Starting application..."
exec "$@"
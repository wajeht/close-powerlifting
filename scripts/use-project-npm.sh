#!/bin/sh

set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
package_manager=$(node -p "require('$repo_root/package.json').packageManager")

case "$package_manager" in
  npm@*) ;;
  *)
    echo "Unsupported packageManager: $package_manager" >&2
    exit 1
    ;;
esac

required_version=${package_manager#npm@}
current_version=$(npm --version)

if [ "$current_version" != "$required_version" ]; then
  npm install --global "$package_manager"
fi

actual_version=$(npm --version)

if [ "$actual_version" != "$required_version" ]; then
  echo "Expected npm $required_version, found $actual_version" >&2
  exit 1
fi

echo "Using npm $actual_version"
